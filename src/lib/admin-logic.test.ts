import { describe, expect, it } from "vitest";
import type { BadgeRule } from "./badge-definitions";
import { safeCell, toCsv } from "./csv-export";
import { isoWeekKey, isoWeekRange } from "./dates";
import { validatePost } from "./post-edit";
import { applyRuleFields, ruleFields } from "./rule-edit";
import { EDITABLE_SETTINGS, parseSetting, sameSetting, settingToText, shapeError } from "./settings-edit";
import { SETTING_DEFAULTS } from "./settings-defaults";

describe("isoWeekRange", () => {
  it("returns Monday to Sunday of an ISO week and matches isoWeekKey", () => {
    expect(isoWeekRange("2026-W30")).toEqual({ from: "2026-07-20", to: "2026-07-26" });
    expect(isoWeekRange("2026-W01")).toEqual({ from: "2025-12-29", to: "2026-01-04" });
    expect(isoWeekRange("2026-W53")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
    for (const day of ["2026-07-20", "2026-07-26", "2026-01-01", "2027-01-03"]) {
      const range = isoWeekRange(isoWeekKey(day))!;
      expect(day >= range.from && day <= range.to).toBe(true);
    }
  });
  it("rejects malformed keys", () => {
    expect(isoWeekRange("2026-30")).toBeNull();
    expect(isoWeekRange("")).toBeNull();
  });
});

describe("settings editor", () => {
  it("only offers the settings the time machine does not own", () => {
    expect(EDITABLE_SETTINGS).not.toContain("simulatedToday");
    expect(EDITABLE_SETTINGS).not.toContain("lastProcessedDate");
    expect(EDITABLE_SETTINGS).not.toContain("launchDate");
    expect(EDITABLE_SETTINGS).toContain("points");
    expect(EDITABLE_SETTINGS).toContain("rankDownCooldownDays");
  });

  it("parses numbers, text and JSON for each kind of setting", () => {
    expect(parseSetting("graceDays", " 10 ")).toEqual({ ok: true, value: 10 });
    expect(parseSetting("matchingReminderMonthDay", "10-15")).toEqual({ ok: true, value: "10-15" });
    const points = { ...SETTING_DEFAULTS.points, oneTimePerDollar: 2 };
    expect(parseSetting("points", JSON.stringify(points))).toEqual({ ok: true, value: points });
  });

  it("explains what is wrong", () => {
    expect(parseSetting("graceDays", "")).toMatchObject({ ok: false });
    expect(parseSetting("graceDays", "abc")).toMatchObject({ ok: false, error: expect.stringContaining("number") });
    expect(parseSetting("graceDays", "-3")).toMatchObject({ ok: false });
    expect(parseSetting("graceDays", "0")).toMatchObject({ ok: false, error: expect.stringContaining("1 day") });
    expect(parseSetting("matchingReminderMonthDay", "13-40")).toMatchObject({ ok: false, error: expect.stringContaining("MM-DD") });
    expect(parseSetting("points", "{not json")).toEqual({ ok: false, error: "Not valid JSON" });
    expect(parseSetting("points", JSON.stringify({ oneTimePerDollar: 1 }))).toMatchObject({ ok: false, error: expect.stringContaining("missing") });
    expect(parseSetting("points", JSON.stringify({ ...SETTING_DEFAULTS.points, bogus: 1 }))).toMatchObject({ ok: false, error: expect.stringContaining("not a known") });
  });

  it("keeps tiers and milestones in increasing order", () => {
    const tiers = { recurring: 20, silver: 50, gold: 40, platinum: 250, diamond: 500 };
    expect(parseSetting("recurringTiers", JSON.stringify(tiers))).toMatchObject({ ok: false, error: expect.stringContaining("increase") });
    expect(parseSetting("orgMilestones", "[200000, 100000]")).toMatchObject({ ok: false });
    expect(parseSetting("orgMilestones", "[100000, 200000]")).toEqual({ ok: true, value: [100000, 200000] });
    expect(parseSetting("orgMilestones", '["x"]')).toMatchObject({ ok: false });
  });

  it("round-trips every default through the text form", () => {
    for (const key of EDITABLE_SETTINGS) {
      const result = parseSetting(key, settingToText(SETTING_DEFAULTS[key]));
      expect(result, key).toEqual({ ok: true, value: SETTING_DEFAULTS[key] });
    }
  });

  it("compares setting values, not text: CRLF line endings and key order do not count as a change", () => {
    const current = SETTING_DEFAULTS.points;
    const asTyped = settingToText(current).replace(/\n/g, "\r\n"); // what a browser submits
    const parsed = parseSetting("points", asTyped);
    expect(parsed.ok && sameSetting(parsed.value, current)).toBe(true);
    const reordered = parseSetting("points", JSON.stringify(Object.fromEntries(Object.entries(current).reverse())));
    expect(reordered.ok && sameSetting(reordered.value, current)).toBe(true);
    expect(sameSetting({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameSetting([1, 2], [2, 1])).toBe(false);
    expect(sameSetting(7, 7)).toBe(true);
  });

  it("shapeError compares structure with a template", () => {
    expect(shapeError({ a: 1 }, { a: 2 })).toBeNull();
    expect(shapeError({ a: 1 }, { a: "x" })).toContain("number");
    expect(shapeError([{ usd: 1, key: "k" }], [{ usd: 5, key: "z" }])).toBeNull();
    expect(shapeError([{ usd: 1, key: "k" }], [{ usd: "5", key: "z" }])).toContain("[0].usd");
  });
});

describe("badge rule editor", () => {
  it("offers the thresholds of each rule type, and nothing for rules without any", () => {
    expect(ruleFields({ type: "lifetime_total", usd: 250 })).toEqual([{ key: "usd", kind: "number", value: 250 }]);
    expect(ruleFields({ type: "streak", months: 6 }).map((f) => f.key)).toEqual(["months"]);
    expect(ruleFields({ type: "recurring_tier", tier: "gold" })[0]).toMatchObject({ kind: "choice", value: "gold" });
    expect(ruleFields({ type: "donor_of_month" })).toEqual([]);
    expect(ruleFields({ type: "manual" })).toEqual([]);
  });

  it("applies valid values, keeping the rule's type", () => {
    const result = applyRuleFields({ type: "lifetime_total", usd: 250 }, { usd: "300" });
    expect(result).toEqual({ ok: true, rule: { type: "lifetime_total", usd: 300 } });
    const tier = applyRuleFields({ type: "recurring_tier", tier: "gold" }, { tier: "platinum" });
    expect(tier).toEqual({ ok: true, rule: { type: "recurring_tier", tier: "platinum" } });
    const full: BadgeRule = { type: "full_spectrum", programs: ["becas"] };
    expect(applyRuleFields(full, {})).toEqual({ ok: true, rule: full });
  });

  it("rejects nonsense", () => {
    expect(applyRuleFields({ type: "lifetime_total", usd: 250 }, { usd: "-5" })).toMatchObject({ ok: false });
    expect(applyRuleFields({ type: "lifetime_total", usd: 250 }, { usd: "abc" })).toMatchObject({ ok: false });
    expect(applyRuleFields({ type: "streak", months: 6 }, { months: "2.5" })).toMatchObject({ ok: false, error: expect.stringContaining("whole") });
    expect(applyRuleFields({ type: "monthly_top_pct", pct: 10 }, { pct: "150" })).toMatchObject({ ok: false });
    expect(applyRuleFields({ type: "recurring_tier", tier: "gold" }, { tier: "mythic" })).toMatchObject({ ok: false });
    expect(applyRuleFields({ type: "program", program: "becas" }, { program: "nope" })).toMatchObject({ ok: false });
  });
});

describe("validatePost", () => {
  const news = { kind: "news", titleEs: "Hola", titleEn: "Hi", bodyEs: "Cuerpo", bodyEn: "Body", publishedAt: "" };
  const campaign = {
    ...news, kind: "campaign", campaign: "Sismo-2026", goalAmount: "9500", startDate: "2026-08-01", endDate: "2026-12-31",
  };

  it("accepts a news post and defaults the date to today", () => {
    const r = validatePost(news, "2026-07-17");
    expect(r).toMatchObject({ ok: true, post: { kind: "news", publishedAt: "2026-07-17", campaign: null, goalAmount: null } });
  });

  it("accepts a campaign and normalises its slug", () => {
    const r = validatePost(campaign, "2026-07-17");
    expect(r).toMatchObject({ ok: true, post: { kind: "campaign", campaign: "sismo-2026", goalAmount: 9500, endDate: "2026-12-31" } });
  });

  it("reports each problem against its field, in both languages", () => {
    const r = validatePost({ ...news, titleEn: " ", bodyEs: "" }, "2026-07-17");
    expect(r).toEqual({ ok: false, errors: { titleEn: "required", bodyEs: "required" } });
    const bad = validatePost({ ...campaign, campaign: "Bad Slug!", goalAmount: "0", endDate: "2026-07-01" }, "2026-07-17");
    expect(bad).toMatchObject({ ok: false, errors: { campaign: expect.any(String), goalAmount: expect.any(String), endDate: "must be after the start" } });
    expect(validatePost({ ...news, publishedAt: "2026-02-30" }, "2026-07-17")).toMatchObject({ ok: false, errors: { publishedAt: "invalid date" } });
  });
});

describe("csv export", () => {
  it("neutralises formula injection and keeps numbers", () => {
    expect(safeCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(safeCell("+1")).toBe("'+1");
    expect(safeCell("-2")).toBe("'-2");
    expect(safeCell("@cmd")).toBe("'@cmd");
    expect(safeCell("Ana")).toBe("Ana");
    expect(safeCell(42)).toBe(42);
    expect(safeCell(null)).toBe("");
  });

  it("quotes commas and quotes and ends with a newline", () => {
    const csv = toCsv(["name", "amount"], [{ name: 'García, "Ana"', amount: 12.5 }, { name: "=evil()", amount: 0 }]);
    expect(csv).toBe('name,amount\n"García, ""Ana""",12.5\n\'=evil(),0\n');
  });
});
