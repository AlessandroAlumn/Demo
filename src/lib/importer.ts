// CSV importer shared by `npm run import` and the backoffice upload page (PLAN.md section 4.3).
//
// - donations.csv is cumulative: rows are upserted by donation_id, so importing the same file twice
//   changes nothing, and a file with only the newest rows works too.
// - subscriptions.csv is a snapshot: it replaces all subscriptions.
// - Every row is validated. Invalid rows are skipped and reported with their row number; the valid
//   rows are still imported.
// - Donors are derived from the donation rows.
// - `dryRun: true` computes the same report without writing anything (the backoffice preview).

import type { PrismaClient } from "@prisma/client";
import Papa from "papaparse";
import {
  DONATION_STATUSES,
  FREQUENCIES,
  PAYMENT_METHODS,
  PROGRAMS,
  SUBSCRIPTION_STATUSES,
} from "./constants";

export type ImportIssue = {
  file: "donations" | "subscriptions";
  /** Line number in the CSV file (the header is line 1). */
  row: number;
  field?: string;
  message: string;
};

export type ImportSection = {
  /** Data rows found in the file. */
  total: number;
  /** Rows that passed validation. */
  valid: number;
  new: number;
  updated: number;
  unchanged: number;
  /** Subscriptions only: rows removed because they are not in the new snapshot. */
  removed: number;
  issues: ImportIssue[];
};

export type ImportReport = {
  dryRun: boolean;
  donations: ImportSection;
  subscriptions: ImportSection;
  donors: { new: number; updated: number };
};

export type ImportInput = { donationsCsv?: string; subscriptionsCsv?: string };

type DonationInput = {
  id: string;
  donorId: string;
  email: string;
  name: string;
  date: string;
  amountUsd: number;
  method: string;
  program: string;
  campaign: string | null;
  status: string;
  subscriptionId: string | null;
  referredBy: string | null;
};

type SubscriptionInput = {
  id: string;
  donorId: string;
  amountUsd: number;
  frequency: string;
  startDate: string;
  endDate: string | null;
  status: string;
};

const DONATION_COLUMNS = [
  "donation_id", "donor_id", "email", "name", "date", "amount_usd", "method",
  "program", "campaign", "status", "subscription_id", "referred_by",
];
const SUBSCRIPTION_COLUMNS = [
  "subscription_id", "donor_id", "amount_usd", "frequency", "start_date", "end_date", "status",
];

const emptySection = (): ImportSection => ({
  total: 0, valid: 0, new: 0, updated: 0, unchanged: 0, removed: 0, issues: [],
});

const isIsoDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const oneOf = (allowed: readonly string[], value: string) => allowed.includes(value);
const nullIfEmpty = (s: string | undefined) => (s && s.trim() !== "" ? s.trim() : null);

function parseCsv(
  text: string,
  file: ImportIssue["file"],
  required: string[],
  section: ImportSection,
): Record<string, string>[] | null {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const missing = required.filter((c) => !parsed.meta.fields?.includes(c));
  if (missing.length > 0) {
    section.issues.push({
      file,
      row: 1,
      message: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
    });
    return null;
  }
  for (const err of parsed.errors) {
    // Papa reports a 0-based data row index; +2 gives the file line (header is line 1).
    section.issues.push({ file, row: (err.row ?? 0) + 2, message: err.message });
  }
  section.total = parsed.data.length;
  return parsed.data;
}

function validateDonations(
  records: Record<string, string>[],
  section: ImportSection,
): DonationInput[] {
  const valid: DonationInput[] = [];
  const seen = new Map<string, number>();

  records.forEach((rec, i) => {
    const row = i + 2;
    const problems: Omit<ImportIssue, "file" | "row">[] = [];
    const get = (k: string) => (rec[k] ?? "").trim();

    const id = get("donation_id");
    if (!id) problems.push({ field: "donation_id", message: "Required" });
    else if (seen.has(id)) {
      problems.push({
        field: "donation_id",
        message: `Duplicate of row ${seen.get(id)} in the same file`,
      });
    }
    if (!get("donor_id")) problems.push({ field: "donor_id", message: "Required" });
    if (!get("name")) problems.push({ field: "name", message: "Required" });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(get("email"))) {
      problems.push({ field: "email", message: `Not a valid email: "${get("email")}"` });
    }
    if (!isIsoDate(get("date"))) {
      problems.push({ field: "date", message: `Not a valid YYYY-MM-DD date: "${get("date")}"` });
    }
    const amount = Number(get("amount_usd"));
    if (get("amount_usd") === "" || !Number.isFinite(amount) || amount <= 0) {
      problems.push({ field: "amount_usd", message: `Must be a number above 0: "${get("amount_usd")}"` });
    }
    if (!oneOf(PAYMENT_METHODS, get("method"))) {
      problems.push({ field: "method", message: `Must be one of ${PAYMENT_METHODS.join(", ")}: "${get("method")}"` });
    }
    if (!oneOf(PROGRAMS, get("program"))) {
      problems.push({ field: "program", message: `Must be one of ${PROGRAMS.join(", ")}: "${get("program")}"` });
    }
    if (!oneOf(DONATION_STATUSES, get("status"))) {
      problems.push({ field: "status", message: `Must be one of ${DONATION_STATUSES.join(", ")}: "${get("status")}"` });
    }

    if (problems.length > 0) {
      for (const p of problems) section.issues.push({ file: "donations", row, ...p });
      return;
    }
    seen.set(id, row);
    valid.push({
      id,
      donorId: get("donor_id"),
      email: get("email"),
      name: get("name"),
      date: get("date"),
      amountUsd: Math.round(amount * 100) / 100,
      method: get("method"),
      program: get("program"),
      campaign: nullIfEmpty(rec.campaign),
      status: get("status"),
      subscriptionId: nullIfEmpty(rec.subscription_id),
      referredBy: nullIfEmpty(rec.referred_by),
    });
  });

  section.valid = valid.length;
  return valid;
}

function validateSubscriptions(
  records: Record<string, string>[],
  knownDonors: Set<string>,
  section: ImportSection,
): SubscriptionInput[] {
  const valid: SubscriptionInput[] = [];
  const seen = new Map<string, number>();

  records.forEach((rec, i) => {
    const row = i + 2;
    const problems: Omit<ImportIssue, "file" | "row">[] = [];
    const get = (k: string) => (rec[k] ?? "").trim();

    const id = get("subscription_id");
    if (!id) problems.push({ field: "subscription_id", message: "Required" });
    else if (seen.has(id)) {
      problems.push({ field: "subscription_id", message: `Duplicate of row ${seen.get(id)} in the same file` });
    }
    if (!get("donor_id")) problems.push({ field: "donor_id", message: "Required" });
    else if (!knownDonors.has(get("donor_id"))) {
      problems.push({ field: "donor_id", message: `Unknown donor "${get("donor_id")}" (no donations for them)` });
    }
    const amount = Number(get("amount_usd"));
    if (get("amount_usd") === "" || !Number.isFinite(amount) || amount <= 0) {
      problems.push({ field: "amount_usd", message: `Must be a number above 0: "${get("amount_usd")}"` });
    }
    if (!oneOf(FREQUENCIES, get("frequency"))) {
      problems.push({ field: "frequency", message: `Must be one of ${FREQUENCIES.join(", ")}: "${get("frequency")}"` });
    }
    if (!isIsoDate(get("start_date"))) {
      problems.push({ field: "start_date", message: `Not a valid YYYY-MM-DD date: "${get("start_date")}"` });
    }
    if (get("end_date") !== "" && !isIsoDate(get("end_date"))) {
      problems.push({ field: "end_date", message: `Not a valid YYYY-MM-DD date: "${get("end_date")}"` });
    }
    if (!oneOf(SUBSCRIPTION_STATUSES, get("status"))) {
      problems.push({ field: "status", message: `Must be one of ${SUBSCRIPTION_STATUSES.join(", ")}: "${get("status")}"` });
    }

    if (problems.length > 0) {
      for (const p of problems) section.issues.push({ file: "subscriptions", row, ...p });
      return;
    }
    seen.set(id, row);
    valid.push({
      id,
      donorId: get("donor_id"),
      amountUsd: Math.round(amount * 100) / 100,
      frequency: get("frequency"),
      startDate: get("start_date"),
      endDate: nullIfEmpty(rec.end_date),
      status: get("status"),
    });
  });

  section.valid = valid.length;
  return valid;
}

const sameDonation = (a: DonationInput, b: DonationInput) =>
  a.donorId === b.donorId && a.date === b.date && a.amountUsd === b.amountUsd &&
  a.method === b.method && a.program === b.program && a.campaign === b.campaign &&
  a.status === b.status && a.subscriptionId === b.subscriptionId && a.referredBy === b.referredBy;

const sameSubscription = (a: SubscriptionInput, b: SubscriptionInput) =>
  a.donorId === b.donorId && a.amountUsd === b.amountUsd && a.frequency === b.frequency &&
  a.startDate === b.startDate && a.endDate === b.endDate && a.status === b.status;

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

type DonorState = { name: string; email: string; firstDonationDate: string; referredBy: string | null };

/** Donor fields derived from donation rows (file) combined with the earliest dates already in the DB. */
function deriveDonors(
  rows: DonationInput[],
  dbMinSucceeded: Map<string, string>,
  dbMinAll: Map<string, string>,
): Map<string, DonorState> {
  const byDonor = new Map<string, DonationInput[]>();
  for (const r of rows) {
    if (!byDonor.has(r.donorId)) byDonor.set(r.donorId, []);
    byDonor.get(r.donorId)!.push(r);
  }
  const out = new Map<string, DonorState>();
  for (const [donorId, list] of byDonor) {
    // Latest row wins for name/email (ties: the later row in the file).
    let latest = list[0];
    let earliest = list[0];
    for (const r of list) {
      if (r.date >= latest.date) latest = r;
      if (r.date < earliest.date) earliest = r;
    }
    const succeeded = list.filter((r) => r.status === "succeeded").map((r) => r.date);
    const minSucceeded = [...succeeded, dbMinSucceeded.get(donorId)].filter(Boolean) as string[];
    const minAll = [...list.map((r) => r.date), dbMinAll.get(donorId)].filter(Boolean) as string[];
    const pool = minSucceeded.length > 0 ? minSucceeded : minAll;
    const referredBy =
      [...list].sort((a, b) => a.date.localeCompare(b.date)).find((r) => r.referredBy)?.referredBy ?? null;
    out.set(donorId, {
      name: latest.name,
      email: latest.email,
      firstDonationDate: pool.reduce((m, d) => (d < m ? d : m)),
      referredBy,
    });
  }
  return out;
}

async function dbMinDates(db: PrismaClient) {
  const [succeeded, all] = await Promise.all([
    db.donation.groupBy({ by: ["donorId"], where: { status: "succeeded" }, _min: { date: true } }),
    db.donation.groupBy({ by: ["donorId"], _min: { date: true } }),
  ]);
  const toMap = (rows: { donorId: string; _min: { date: string | null } }[]) =>
    new Map(rows.filter((r) => r._min.date).map((r) => [r.donorId, r._min.date!] as const));
  return { succeeded: toMap(succeeded), all: toMap(all) };
}

export async function runImport(
  db: PrismaClient,
  input: ImportInput,
  options: { dryRun?: boolean } = {},
): Promise<ImportReport> {
  const dryRun = options.dryRun ?? false;
  const report: ImportReport = {
    dryRun,
    donations: emptySection(),
    subscriptions: emptySection(),
    donors: { new: 0, updated: 0 },
  };

  // ---- parse + validate (no database access yet) ----
  const donationRecords = input.donationsCsv
    ? parseCsv(input.donationsCsv, "donations", DONATION_COLUMNS, report.donations)
    : null;
  const donations = donationRecords ? validateDonations(donationRecords, report.donations) : [];

  const subscriptionRecords = input.subscriptionsCsv
    ? parseCsv(input.subscriptionsCsv, "subscriptions", SUBSCRIPTION_COLUMNS, report.subscriptions)
    : null;

  // ---- donations + donors ----
  const existingDonations = new Map(
    (await db.donation.findMany()).map((d) => [
      d.id,
      {
        id: d.id, donorId: d.donorId, email: "", name: "", date: d.date, amountUsd: d.amountUsd,
        method: d.method, program: d.program, campaign: d.campaign, status: d.status,
        subscriptionId: d.subscriptionId, referredBy: d.referredBy,
      } satisfies DonationInput,
    ]),
  );
  const toCreate: DonationInput[] = [];
  const toUpdate: DonationInput[] = [];
  for (const d of donations) {
    const existing = existingDonations.get(d.id);
    if (!existing) toCreate.push(d);
    else if (sameDonation(existing, d)) report.donations.unchanged++;
    else toUpdate.push(d);
  }
  report.donations.new = toCreate.length;
  report.donations.updated = toUpdate.length;

  const existingDonors = new Map((await db.donor.findMany()).map((d) => [d.id, d]));
  const before = await dbMinDates(db);

  // Pre-write estimate (dry run): merge the file's dates with what is already stored.
  const estimate = deriveDonors(donations, before.succeeded, before.all);
  const countDonorChanges = (states: Map<string, DonorState>) => {
    let created = 0;
    let updated = 0;
    for (const [id, s] of states) {
      const e = existingDonors.get(id);
      if (!e) created++;
      else if (
        e.name !== s.name || e.email !== s.email ||
        e.firstDonationDate !== s.firstDonationDate || (e.referredBy ?? null) !== s.referredBy
      ) updated++;
    }
    return { new: created, updated };
  };
  report.donors = countDonorChanges(estimate);

  // Donors known after this import (for subscription validation).
  const knownDonors = new Set<string>([...existingDonors.keys(), ...estimate.keys()]);
  const subscriptions = subscriptionRecords
    ? validateSubscriptions(subscriptionRecords, knownDonors, report.subscriptions)
    : [];

  const existingSubs = new Map(
    (await db.subscription.findMany()).map((s) => [
      s.id,
      {
        id: s.id, donorId: s.donorId, amountUsd: s.amountUsd, frequency: s.frequency,
        startDate: s.startDate, endDate: s.endDate, status: s.status,
      } satisfies SubscriptionInput,
    ]),
  );
  if (subscriptionRecords) {
    const incoming = new Set(subscriptions.map((s) => s.id));
    for (const s of subscriptions) {
      const e = existingSubs.get(s.id);
      if (!e) report.subscriptions.new++;
      else if (sameSubscription(e, s)) report.subscriptions.unchanged++;
      else report.subscriptions.updated++;
    }
    report.subscriptions.removed = [...existingSubs.keys()].filter((id) => !incoming.has(id)).length;
  }

  if (dryRun) return report;

  // ---- write ----
  await db.$transaction(
    async (tx) => {
      // Donors first (donations reference them). first-gift dates are fixed up after the donations land.
      const newDonors = [...estimate].filter(([id]) => !existingDonors.has(id));
      for (const part of chunk(newDonors, 500)) {
        await tx.donor.createMany({
          data: part.map(([id, s]) => ({ id, ...s })),
        });
      }

      for (const part of chunk(toCreate, 500)) {
        await tx.donation.createMany({
          data: part.map(({ email: _email, name: _name, ...d }) => d),
        });
      }
      for (const d of toUpdate) {
        const { id, email: _email, name: _name, ...data } = d;
        await tx.donation.update({ where: { id }, data });
      }

      // Recompute derived donor fields from the stored donations.
      const after = await dbMinDates(tx as unknown as PrismaClient);
      const finalStates = deriveDonors(donations, after.succeeded, after.all);
      for (const [id, s] of finalStates) {
        const e = existingDonors.get(id);
        if (
          e &&
          (e.name !== s.name || e.email !== s.email ||
            e.firstDonationDate !== s.firstDonationDate || (e.referredBy ?? null) !== s.referredBy)
        ) {
          await tx.donor.update({ where: { id }, data: s });
        } else if (!e) {
          await tx.donor.update({ where: { id }, data: s });
        }
      }

      if (subscriptionRecords) {
        await tx.subscription.deleteMany();
        for (const part of chunk(subscriptions, 500)) {
          await tx.subscription.createMany({ data: part });
        }
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  // Report what was actually written for donors.
  report.donors = countDonorChanges(estimate);
  return report;
}

/** Plain-text summary for the CLI. */
export function formatReport(report: ImportReport): string {
  const lines: string[] = [];
  lines.push(report.dryRun ? "Import preview (nothing was written)" : "Import finished");
  const section = (label: string, s: ImportSection, showRemoved: boolean) => {
    if (s.total === 0 && s.issues.length === 0) return;
    lines.push(
      `${label}: ${s.total} rows, ${s.valid} valid | new ${s.new}, updated ${s.updated}, unchanged ${s.unchanged}` +
        (showRemoved ? `, removed ${s.removed}` : "") +
        (s.issues.length ? ` | ${s.issues.length} problem${s.issues.length > 1 ? "s" : ""}` : ""),
    );
    for (const issue of s.issues.slice(0, 20)) {
      lines.push(`  line ${issue.row}${issue.field ? ` [${issue.field}]` : ""}: ${issue.message}`);
    }
    if (s.issues.length > 20) lines.push(`  … and ${s.issues.length - 20} more`);
  };
  section("Donations", report.donations, false);
  section("Subscriptions", report.subscriptions, true);
  lines.push(`Donors: new ${report.donors.new}, updated ${report.donors.updated}`);
  return lines.join("\n");
}
