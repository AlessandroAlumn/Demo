"use server";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { runImport, type ImportInput, type ImportReport } from "@/lib/importer";
import { getDemoState } from "@/lib/pipeline";

const MAX_ISSUES_SHOWN = 50;

export type ImportState =
  | { stage: "idle" }
  | { stage: "error"; error: "noFiles" | "expired" | "failed" }
  | { stage: "preview"; token: string; fileNames: { donations?: string; subscriptions?: string }; report: ImportReport; issueTotals: { donations: number; subscriptions: number } }
  | { stage: "done"; report: ImportReport; issueTotals: { donations: number; subscriptions: number } };

const uploadDir = (token: string) => join(tmpdir(), "alumnusb-uploads", token);
const validToken = (t: string) => /^[0-9a-f-]{36}$/.test(t);

/** A long list of row problems is trimmed for display; the totals are kept. */
function trimmed(report: ImportReport) {
  const issueTotals = { donations: report.donations.issues.length, subscriptions: report.subscriptions.issues.length };
  return {
    issueTotals,
    report: {
      ...report,
      donations: { ...report.donations, issues: report.donations.issues.slice(0, MAX_ISSUES_SHOWN) },
      subscriptions: { ...report.subscriptions, issues: report.subscriptions.issues.slice(0, MAX_ISSUES_SHOWN) },
    },
  };
}

async function readFiles(token: string): Promise<ImportInput> {
  const input: ImportInput = {};
  for (const [key, file] of [["donationsCsv", "donations.csv"], ["subscriptionsCsv", "subscriptions.csv"]] as const) {
    try {
      input[key] = await readFile(join(uploadDir(token), file), "utf8");
    } catch {
      /* that file was not uploaded */
    }
  }
  return input;
}

/** Step 1: validates the uploaded files and shows what would change. Nothing is written yet. */
export async function previewImportAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await assertAdmin();
  const token = randomUUID();
  const fileNames: { donations?: string; subscriptions?: string } = {};
  const input: ImportInput = {};

  for (const [field, key] of [["donations", "donationsCsv"], ["subscriptions", "subscriptionsCsv"]] as const) {
    const file = formData.get(field);
    if (file instanceof File && file.size > 0) {
      input[key] = await file.text();
      fileNames[field] = file.name;
    }
  }
  if (!input.donationsCsv && !input.subscriptionsCsv) return { stage: "error", error: "noFiles" };

  try {
    const report = await runImport(db, input, { dryRun: true });
    await mkdir(uploadDir(token), { recursive: true });
    if (input.donationsCsv) await writeFile(join(uploadDir(token), "donations.csv"), input.donationsCsv);
    if (input.subscriptionsCsv) await writeFile(join(uploadDir(token), "subscriptions.csv"), input.subscriptionsCsv);
    return { stage: "preview", token, fileNames, ...trimmed(report) };
  } catch {
    return { stage: "error", error: "failed" };
  }
}

/** Step 2: runs the import for the files that were previewed (valid rows only; invalid ones are skipped). */
export async function confirmImportAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await assertAdmin();
  const token = String(formData.get("token") ?? "");
  if (!validToken(token)) return { stage: "error", error: "expired" };
  const input = await readFiles(token);
  if (!input.donationsCsv && !input.subscriptionsCsv) return { stage: "error", error: "expired" };

  try {
    const report = await runImport(db, input);
    const { today } = await getDemoState(db);
    const t = trimmed(report);
    await db.setting.upsert({
      where: { key: "lastImport" },
      update: { value: { at: new Date().toISOString(), demoDate: today, report: t.report, issueTotals: t.issueTotals } as never },
      create: { key: "lastImport", value: { at: new Date().toISOString(), demoDate: today, report: t.report, issueTotals: t.issueTotals } as never },
    });
    await rm(uploadDir(token), { recursive: true, force: true });
    revalidatePath("/", "layout");
    return { stage: "done", ...t };
  } catch {
    return { stage: "error", error: "failed" };
  }
}
