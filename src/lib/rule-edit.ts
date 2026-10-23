// Edits a badge's machine-readable rule from simple form fields: only the thresholds can change, never
// the rule's type (which decides how the engine evaluates it).

import type { BadgeRule } from "./badge-definitions";
import { PROGRAMS, SOCIAL_NETWORKS } from "./constants";

export type RuleField =
  | { key: string; kind: "number"; value: number }
  | { key: string; kind: "choice"; value: string; options: readonly string[] };

const TIERS = ["recurring", "silver", "gold", "platinum", "diamond"] as const;

/** The editable fields of a rule (empty for rules without thresholds, like Donor of the Month). */
export function ruleFields(rule: BadgeRule): RuleField[] {
  switch (rule.type) {
    case "lifetime_total":
      return [{ key: "usd", kind: "number", value: rule.usd }];
    case "streak":
      return [{ key: "months", kind: "number", value: rule.months }];
    case "years_donated":
    case "matching_streak":
      return [{ key: "years", kind: "number", value: rule.years }];
    case "monthly_top_n":
    case "yearly_top_n":
      return [{ key: "n", kind: "number", value: rule.n }];
    case "monthly_top_pct":
      return [{ key: "pct", kind: "number", value: rule.pct }];
    case "referral":
      return [{ key: "count", kind: "number", value: rule.count }];
    case "recurring_tier":
      return [{ key: "tier", kind: "choice", value: rule.tier, options: TIERS }];
    case "program":
      return [{ key: "program", kind: "choice", value: rule.program, options: PROGRAMS }];
    case "social_follow":
      return [{ key: "network", kind: "choice", value: rule.network, options: SOCIAL_NETWORKS }];
    default:
      return [];
  }
}

export type RuleResult = { ok: true; rule: BadgeRule } | { ok: false; error: string };

/** Applies submitted field values to a rule, validating each one. */
export function applyRuleFields(rule: BadgeRule, values: Record<string, string>): RuleResult {
  const next: Record<string, unknown> = { ...rule };
  for (const field of ruleFields(rule)) {
    const raw = (values[field.key] ?? "").trim();
    if (field.kind === "number") {
      const n = Number(raw);
      if (raw === "" || !Number.isFinite(n) || n <= 0) return { ok: false, error: `${field.key} must be a number above 0` };
      if (field.key === "pct" && n > 100) return { ok: false, error: "pct must be 100 or less" };
      if (["months", "years", "n", "count"].includes(field.key) && !Number.isInteger(n)) {
        return { ok: false, error: `${field.key} must be a whole number` };
      }
      next[field.key] = n;
    } else {
      if (!field.options.includes(raw)) return { ok: false, error: `${field.key} must be one of ${field.options.join(", ")}` };
      next[field.key] = raw;
    }
  }
  return { ok: true, rule: next as BadgeRule };
}
