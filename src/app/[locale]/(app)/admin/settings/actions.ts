"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadSettings, saveSetting } from "@/lib/settings";
import { EDITABLE_SETTINGS, parseSetting, sameSetting } from "@/lib/settings-edit";
import type { AppSettings } from "@/lib/settings-defaults";

export type SettingsState =
  | { status: "idle" }
  | { status: "saved"; changed: string[] }
  | { status: "error"; errors: Record<string, string> };

/** Saves every changed setting, or none if any value is invalid. */
export async function saveSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await assertAdmin();
  const current = await loadSettings(db);
  const errors: Record<string, string> = {};
  const updates: [keyof AppSettings, unknown][] = [];

  for (const key of EDITABLE_SETTINGS) {
    const raw = formData.get(key);
    if (typeof raw !== "string") continue;
    const parsed = parseSetting(key, raw);
    if (!parsed.ok) errors[key] = parsed.error;
    // Compare values, not text: browsers send text areas with CRLF line endings.
    else if (!sameSetting(parsed.value, current[key])) updates.push([key, parsed.value]);
  }
  if (Object.keys(errors).length > 0) return { status: "error", errors };

  for (const [key, value] of updates) await saveSetting(db, key, value as never);
  revalidatePath("/", "layout");
  return { status: "saved", changed: updates.map(([k]) => k) };
}
