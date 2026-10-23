// Validation for the settings editor in the backoffice. The shape of each setting is the shape of its
// default: a number stays a number, an object keeps its keys, a list keeps its element shape.

import { SETTING_DEFAULTS, type AppSettings, type SettingKey } from "./settings-defaults";

/** Settings the time machine owns: shown, never edited by hand. */
export const READ_ONLY_SETTINGS: SettingKey[] = ["simulatedToday", "lastProcessedDate", "launchDate"];

export const EDITABLE_SETTINGS = (Object.keys(SETTING_DEFAULTS) as SettingKey[]).filter(
  (k) => !READ_ONLY_SETTINGS.includes(k),
);

export type SettingResult = { ok: true; value: unknown } | { ok: false; error: string };

const kind = (v: unknown) => (Array.isArray(v) ? "array" : v === null ? "null" : typeof v);

/** Checks `value` has the same structure as `template`. Returns an error message, or null. */
export function shapeError(template: unknown, value: unknown, path = ""): string | null {
  const here = path || "value";
  if (kind(template) === "array") {
    if (!Array.isArray(value)) return `${here} must be a list`;
    const sample = (template as unknown[])[0];
    if (sample === undefined) return null;
    for (const [i, item] of value.entries()) {
      const err = shapeError(sample, item, `${here}[${i}]`);
      if (err) return err;
    }
    return null;
  }
  if (kind(template) === "object") {
    if (kind(value) !== "object") return `${here} must be an object`;
    const t = template as Record<string, unknown>;
    const v = value as Record<string, unknown>;
    for (const key of Object.keys(t)) {
      if (!(key in v)) return `${here}.${key} is missing`;
      const err = shapeError(t[key], v[key], `${here}.${key}`);
      if (err) return err;
    }
    const extra = Object.keys(v).find((k) => !(k in t));
    return extra ? `${here}.${extra} is not a known field` : null;
  }
  if (kind(template) !== kind(value)) return `${here} must be a ${kind(template)}`;
  if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) return `${here} must be a number of 0 or more`;
  return null;
}

/**
 * Turns the text typed in the form into a value for `key`, or says what is wrong.
 * Numbers and text are typed directly; objects and lists are JSON.
 */
export function parseSetting(key: SettingKey, raw: string): SettingResult {
  const template = SETTING_DEFAULTS[key];
  const text = raw.trim();
  let value: unknown;

  if (typeof template === "number") {
    if (text === "") return { ok: false, error: "Enter a number" };
    value = Number(text);
  } else if (typeof template === "string") {
    value = text;
  } else {
    try {
      value = JSON.parse(text);
    } catch {
      return { ok: false, error: "Not valid JSON" };
    }
  }

  const error = shapeError(template, value);
  if (error) return { ok: false, error };

  // setting-specific rules
  if (key === "matchingReminderMonthDay" && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(value))) {
    return { ok: false, error: "Use MM-DD, for example 09-01" };
  }
  if (key === "recurringTiers") {
    const t = value as AppSettings["recurringTiers"];
    if (!(t.recurring < t.silver && t.silver < t.gold && t.gold < t.platinum && t.platinum < t.diamond)) {
      return { ok: false, error: "Tiers must increase: recurring < silver < gold < platinum < diamond" };
    }
  }
  if (key === "orgMilestones") {
    const list = value as number[];
    if (list.some((n, i) => i > 0 && n <= list[i - 1])) return { ok: false, error: "Milestones must be in increasing order" };
  }
  if (key === "graceDays" && Number(value) < 1) return { ok: false, error: "Grace period must be at least 1 day" };
  return { ok: true, value };
}

const stable = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`
      : JSON.stringify(v);

/** True if two setting values are equal, whatever the key order or the formatting they were typed in. */
export const sameSetting = (a: unknown, b: unknown) => stable(a) === stable(b);

/** How a value is shown in an input: scalars as text, structures as pretty JSON. */
export const settingToText = (value: unknown): string =>
  typeof value === "number" || typeof value === "string" ? String(value) : JSON.stringify(value, null, 2);
