import { describe, expect, it } from "vitest";
import {
  currentMonthlyAmount,
  nextTier,
  recurringSummary,
  recurringTier,
  streakAsOf,
  subscriptionState,
} from "./subscriptions";
import { DEFAULT_ENGINE_SETTINGS as S, type DonationRec, type SubscriptionRec } from "./types";

let n = 0;
const charge = (subId: string, date: string, status: "succeeded" | "failed" = "succeeded", amount = 25): DonationRec => ({
  id: `c${++n}`, donorId: "D1", date, amountUsd: amount, method: "card", program: "becas",
  campaign: null, status, subscriptionId: subId,
});
const monthlySub = (id = "S1", start = "2026-01-10", extra: Partial<SubscriptionRec> = {}): SubscriptionRec => ({
  id, donorId: "D1", amountUsd: 25, frequency: "monthly", startDate: start, endDate: null, ...extra,
});
/** Successful monthly charges on the 10th for each listed month number of 2026. */
const monthlyCharges = (subId: string, months: number[]) =>
  months.map((m) => charge(subId, `2026-${String(m).padStart(2, "0")}-10`));

describe("subscriptionState", () => {
  const sub = monthlySub();

  it("is active while charges succeed", () => {
    const rows = monthlyCharges("S1", [1, 2, 3, 4, 5, 6]);
    expect(subscriptionState(sub, rows, "2026-06-25", S)).toMatchObject({ status: "active", lastSuccessDate: "2026-06-10" });
  });

  it("is not started before its start date and cancelled from its end date", () => {
    expect(subscriptionState(sub, [], "2026-01-09", S).status).toBe("not_started");
    const ended = monthlySub("S1", "2026-01-10", { endDate: "2026-04-10" });
    const rows = monthlyCharges("S1", [1, 2, 3]);
    expect(subscriptionState(ended, rows, "2026-04-09", S).status).toBe("active");
    expect(subscriptionState(ended, rows, "2026-04-10", S).status).toBe("cancelled");
  });

  it("enters a 7-day grace period on a failed charge, then goes inactive (User4's timeline)", () => {
    const rows = [...monthlyCharges("S1", [1, 2, 3, 4, 5, 6, 7]), charge("S1", "2026-08-03", "failed")];
    const at = (date: string) => subscriptionState(sub, rows, date, S);
    expect(at("2026-08-03")).toMatchObject({ status: "grace", failureStart: "2026-08-03", graceDaysLeft: 7 });
    expect(at("2026-08-08")).toMatchObject({ status: "grace", graceDaysLeft: 2 });
    expect(at("2026-08-09")).toMatchObject({ status: "grace", graceDaysLeft: 1 });
    expect(at("2026-08-10")).toMatchObject({ status: "inactive", graceDaysLeft: 0 });
    expect(at("2026-09-30").status).toBe("inactive");
  });

  it("recovers when a retry succeeds inside the grace period (User3's timeline)", () => {
    const rows = [...monthlyCharges("S1", [1, 2, 3, 4, 5, 6]), charge("S1", "2026-07-15", "failed"), charge("S1", "2026-07-19")];
    expect(subscriptionState(sub, rows, "2026-07-16", S).status).toBe("grace");
    expect(subscriptionState(sub, rows, "2026-07-18", S)).toMatchObject({ status: "grace", graceDaysLeft: 4 });
    expect(subscriptionState(sub, rows, "2026-07-19", S).status).toBe("active");
  });

  it("only counts the first failure of a streak of failures for the grace period", () => {
    const rows = [...monthlyCharges("S1", [1, 2]), charge("S1", "2026-03-10", "failed"), charge("S1", "2026-03-14", "failed")];
    expect(subscriptionState(sub, rows, "2026-03-14", S)).toMatchObject({ failureStart: "2026-03-10", graceDaysLeft: 3 });
  });

  it("treats 35+ days without a successful charge as a failure even with no failed row", () => {
    const rows = monthlyCharges("S1", [1, 2, 3, 4, 5, 6]); // last success 2026-06-10
    expect(subscriptionState(sub, rows, "2026-07-15", S).status).toBe("active"); // 35 days
    expect(subscriptionState(sub, rows, "2026-07-16", S)).toMatchObject({
      status: "grace", failureStart: "2026-07-16", graceDaysLeft: 7,
    });
    expect(subscriptionState(sub, rows, "2026-07-23", S).status).toBe("inactive");
  });

  it("uses a 370-day window for annual plans", () => {
    const annual = monthlySub("A1", "2026-09-15", { frequency: "annual", amountUsd: 600 });
    const rows = [charge("A1", "2026-09-15", "succeeded", 600)];
    expect(subscriptionState(annual, rows, "2027-09-20", S).status).toBe("active");
    expect(subscriptionState(annual, rows, "2027-09-21", S).status).toBe("grace");
  });

  it("flags a subscription with no charge at all once the window passes its start date", () => {
    expect(subscriptionState(sub, [], "2026-02-14", S).status).toBe("active"); // 35 days after the start
    expect(subscriptionState(sub, [], "2026-02-15", S)).toMatchObject({ status: "grace", graceDaysLeft: 7 });
    expect(subscriptionState(sub, [], "2026-03-01", S).status).toBe("inactive");
  });
});

describe("streakAsOf", () => {
  const sub = monthlySub();
  const streak = (rows: DonationRec[], date: string, subs = [sub]) => streakAsOf(subs, rows, date, S);

  it("counts consecutive months, and keeps counting before this month's charge lands", () => {
    const rows = monthlyCharges("S1", [1, 2, 3, 4, 5, 6]);
    expect(streak(rows, "2026-06-15")).toBe(6);
    expect(streak(rows, "2026-07-05")).toBe(6); // July's charge (the 10th) has not happened yet
    expect(streak([...rows, charge("S1", "2026-07-10")], "2026-07-12")).toBe(7);
  });

  it("starts the 24-month streak count on the 24th monthly charge (User2)", () => {
    const user2 = monthlySub("S2", "2024-09-10");
    const rows: DonationRec[] = [];
    for (let i = 0; i < 24; i++) {
      const total = 2024 * 12 + 8 + i;
      rows.push(charge("S2", `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-10`));
    }
    expect(streak(rows, "2026-08-09", [user2])).toBe(23);
    expect(streak(rows, "2026-08-10", [user2])).toBe(24);
  });

  it("breaks on a skipped month", () => {
    expect(streak(monthlyCharges("S1", [1, 2, 4, 5, 6]), "2026-06-20")).toBe(3);
  });

  it("is 0 with no recurring charges, and 0 once a whole month is missed", () => {
    expect(streak([], "2026-06-20", [])).toBe(0);
    expect(streak(monthlyCharges("S1", [1, 2, 3]), "2026-06-20")).toBe(0);
  });

  it("keeps the streak, uncounted, while a failure is inside its grace period", () => {
    const rows = [...monthlyCharges("S1", [1, 2, 3, 4, 5, 6]), charge("S1", "2026-07-10", "failed")];
    expect(streak(rows, "2026-07-12")).toBe(6);
    // a failure on the 30th leaves the next month's first days with nothing charged yet
    const late = [...monthlyCharges("S1", [1, 2, 3, 4, 5, 6]), charge("S1", "2026-07-30", "failed")];
    expect(streak(late, "2026-08-02")).toBe(6);
  });

  it("adds the failed month once the retry succeeds inside grace", () => {
    const rows = [...monthlyCharges("S1", [1, 2, 3, 4, 5, 6]), charge("S1", "2026-07-30", "failed"), charge("S1", "2026-08-03")];
    expect(streak(rows, "2026-08-04")).toBe(8); // Jan..Jun + July (fixed) + August
  });

  it("resets when the grace period expires, and a late fix starts a new streak at 1", () => {
    const failed = [...monthlyCharges("S1", [1, 2, 3, 4, 5, 6, 7]), charge("S1", "2026-08-03", "failed")];
    expect(streak(failed, "2026-08-09")).toBe(7);
    expect(streak(failed, "2026-08-10")).toBe(0);
    const lateFix = [...failed, charge("S1", "2026-08-20")];
    expect(streak(lateFix, "2026-08-21")).toBe(1);
  });

  it("covers every month of an annual plan, up to this month", () => {
    const annual = monthlySub("A1", "2026-09-15", { frequency: "annual", amountUsd: 600 });
    const rows = [charge("A1", "2026-09-15", "succeeded", 600)];
    expect(streakAsOf([annual], rows, "2026-09-20", S)).toBe(1);
    expect(streakAsOf([annual], rows, "2026-12-01", S)).toBe(4);
  });

  it("carries the streak across a plan change (new subscription replaces the old one)", () => {
    const oldPlan = monthlySub("S1", "2026-01-15", { endDate: "2026-10-15" });
    const newPlan = monthlySub("S2", "2026-10-15");
    const rows = [
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => charge("S1", `2026-${String(m).padStart(2, "0")}-15`)),
      charge("S2", "2026-10-15"), charge("S2", "2026-11-15"),
    ];
    expect(streakAsOf([oldPlan, newPlan], rows, "2026-11-20", S)).toBe(11);
  });
});

describe("amount, tiers and summary", () => {
  const tiers = S.recurringTiers;

  it("maps a monthly amount to a tier", () => {
    expect(recurringTier(19.99, tiers)).toBeNull();
    expect(recurringTier(20, tiers)).toBe("recurring");
    expect(recurringTier(49.99, tiers)).toBe("recurring");
    expect(recurringTier(50, tiers)).toBe("silver");
    expect(recurringTier(100, tiers)).toBe("gold");
    expect(recurringTier(250, tiers)).toBe("platinum");
    expect(recurringTier(500, tiers)).toBe("diamond");
  });

  it("tells how far the next tier is", () => {
    expect(nextTier(45, tiers)).toEqual({ tier: "silver", threshold: 50, gap: 5 });
    expect(nextTier(0, tiers)).toEqual({ tier: "recurring", threshold: 20, gap: 20 });
    expect(nextTier(600, tiers)).toBeNull();
  });

  it("sums active and in-grace subscriptions, normalising annual plans, ignoring inactive and cancelled", () => {
    const subs = [
      monthlySub("S1", "2026-01-10", { amountUsd: 30 }),
      monthlySub("S2", "2026-01-10", { amountUsd: 50 }),
      monthlySub("S3", "2026-01-10", { amountUsd: 100 }),
      monthlySub("A1", "2026-01-10", { frequency: "annual", amountUsd: 600 }),
    ];
    const state = (subscriptionId: string, status: "active" | "grace" | "inactive" | "cancelled") => ({
      subscriptionId, status, lastSuccessDate: null, failureStart: null, graceDaysLeft: null,
    });
    expect(
      currentMonthlyAmount(subs, [state("S1", "active"), state("S2", "grace"), state("S3", "inactive"), state("A1", "active")]),
    ).toBe(130); // 30 + 50 + 600/12
    expect(currentMonthlyAmount(subs, [state("S1", "cancelled")])).toBe(0);
  });

  it("summarises a donor in grace", () => {
    const sub = monthlySub("S1", "2026-01-10", { amountUsd: 100 });
    const rows = [...[1, 2, 3, 4, 5, 6].map((m) => charge("S1", `2026-0${m}-10`, "succeeded", 100)), charge("S1", "2026-07-10", "failed", 100)];
    const summary = recurringSummary([sub], rows, "2026-07-12", S);
    expect(summary).toMatchObject({ overall: "grace", tier: "gold", monthlyAmount: 100, streak: 6, graceDaysLeft: 5 });
    expect(summary.next).toMatchObject({ tier: "platinum", gap: 150 });
  });
});
