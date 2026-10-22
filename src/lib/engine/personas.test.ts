// Runs the engine over the generated mock data and checks the persona timelines promised in
// PLAN.md section 5 (the data from scripts/personas.ts).

import { beforeAll, describe, expect, it } from "vitest";
import { generateMockData } from "../../../scripts/generate-mock-data";
import { referralEvents } from "./points";
import { computeAllMonthlyPoints, computeRankings, currentPeriod, rankPeriod } from "./rankings";
import { recurringSummary, streakAsOf } from "./subscriptions";
import {
  buildHistories,
  DEFAULT_ENGINE_SETTINGS as S,
  type DonationRec,
  type DonorHistory,
  type EngagementEvent,
  type SubscriptionRec,
} from "./types";

let histories: Map<string, DonorHistory>;
let events: EngagementEvent[];

const id = (n: number) => `D${String(n).padStart(4, "0")}`;
const history = (n: number) => histories.get(id(n))!;
const summary = (n: number, date: string) =>
  recurringSummary(history(n).subscriptions, history(n).donations, date, S);

beforeAll(() => {
  const data = generateMockData();
  const donations: DonationRec[] = data.donations.map((d) => ({
    id: d.id, donorId: d.donorId, date: d.date, amountUsd: d.amountUsd, method: d.method,
    program: d.program, campaign: d.campaign || null, status: d.status,
    subscriptionId: d.subscriptionId || null,
  }));
  const subscriptions: SubscriptionRec[] = data.subscriptions.map((s) => ({
    id: s.id, donorId: s.donorId, amountUsd: s.amountUsd, frequency: s.frequency,
    startDate: s.startDate, endDate: s.endDate || null,
  }));
  histories = buildHistories(donations, subscriptions);

  // referred_by sits on the first donation row of each referred donor
  const referredBy = new Map<string, string>();
  for (const d of data.donations) if (d.referredBy && !referredBy.has(d.donorId)) referredBy.set(d.donorId, d.referredBy);
  events = referralEvents(
    data.donors.map((d) => ({ id: d.id, referredBy: referredBy.get(d.id) ?? null })),
    histories,
  );
});

describe("persona subscriptions", () => {
  it("User2 reaches a 24-month streak on 2026-08-10", () => {
    expect(summary(2, "2026-08-09").streak).toBe(23);
    expect(summary(2, "2026-08-10").streak).toBe(24);
    expect(summary(2, "2026-07-01")).toMatchObject({ tier: "recurring", monthlyAmount: 25, overall: "active" });
  });

  it("User3 (Gold) is in grace after the July 15 failure and recovers on the 19th without losing the streak", () => {
    expect(summary(3, "2026-07-14").overall).toBe("active");
    expect(summary(3, "2026-07-15")).toMatchObject({ overall: "grace", graceDaysLeft: 7, tier: "gold", streak: 6 });
    expect(summary(3, "2026-07-18")).toMatchObject({ overall: "grace", graceDaysLeft: 4 });
    expect(summary(3, "2026-07-19")).toMatchObject({ overall: "active", streak: 7, tier: "gold" });
    expect(summary(3, "2026-12-31").streak).toBe(12);
  });

  it("User4 loses the streak when grace expires on Aug 10, and restarts at $100 on Oct 5", () => {
    expect(summary(4, "2026-08-02")).toMatchObject({ overall: "active", tier: "silver", streak: 16 });
    expect(summary(4, "2026-08-03")).toMatchObject({ overall: "grace", graceDaysLeft: 7, streak: 16 });
    expect(summary(4, "2026-08-09")).toMatchObject({ overall: "grace", graceDaysLeft: 1 });
    expect(summary(4, "2026-08-10")).toMatchObject({ overall: "inactive", monthlyAmount: 0, tier: null, streak: 0 });
    expect(summary(4, "2026-09-20")).toMatchObject({ overall: "inactive", streak: 0 });
    expect(summary(4, "2026-10-05")).toMatchObject({ overall: "active", monthlyAmount: 100, tier: "gold", streak: 1 });
    expect(summary(4, "2026-12-06").streak).toBe(3);
  });

  it("User9 is $5 short of Silver until the October raise", () => {
    const before = summary(9, "2026-07-01");
    expect(before).toMatchObject({ monthlyAmount: 45, tier: "recurring" });
    expect(before.next).toMatchObject({ tier: "silver", gap: 5 });
    expect(summary(9, "2026-10-15")).toMatchObject({ monthlyAmount: 50, tier: "silver", streak: 10 });
    expect(summary(9, "2026-12-15").streak).toBe(12);
  });

  it("User1, User7 and User19 reach Diamond, Platinum and Silver (annual ÷ 12)", () => {
    expect(summary(1, "2026-07-04").tier).toBeNull();
    expect(summary(1, "2026-07-05")).toMatchObject({ tier: "diamond", monthlyAmount: 500 });
    expect(summary(7, "2026-09-30").tier).toBeNull();
    expect(summary(7, "2026-10-01")).toMatchObject({ tier: "platinum", monthlyAmount: 250 });
    expect(summary(19, "2026-09-14").tier).toBeNull();
    expect(summary(19, "2026-09-15")).toMatchObject({ tier: "silver", monthlyAmount: 50, streak: 1 });
  });

  it("User5's recurring plan gives a 3-month streak in September and 6 in December", () => {
    expect(summary(5, "2026-09-10").streak).toBe(3);
    expect(summary(5, "2026-12-10").streak).toBe(6);
  });

  it("User10 never recurs", () => {
    expect(streakAsOf(history(10).subscriptions, history(10).donations, "2026-12-31", S)).toBe(0);
    expect(summary(10, "2026-12-31").overall).toBe("none");
  });
});

describe("rankings over the mock data", () => {
  it("ranks only donors who gave in the month, a realistic crowd for July 2026", () => {
    const july = computeRankings(histories, events, "2026-07-31", S).monthly;
    expect(july.entries[0].totalRanked).toBeGreaterThan(600);
    expect(july.entries[0].totalRanked).toBeLessThan(900);
    expect(july.byDonor.get(id(1))!.rank).toBe(1); // User1: $500 recurring + $1,500 gift
    expect(july.byDonor.get(id(10))).toBeUndefined(); // User10 is lapsed: not ranked
    expect(july.byDonor.get(id(1))!.gapToNext).toBeNull();
  });

  it("puts User7 first in September (the $1,200 gift) and User1 first in August, October and December", () => {
    for (const [month, end, winner] of [
      ["2026-08", "2026-08-31", 1], ["2026-09", "2026-09-30", 7], ["2026-10", "2026-10-31", 1], ["2026-12", "2026-12-31", 1],
    ] as const) {
      const monthly = computeRankings(histories, events, end, S).monthly;
      expect(monthly.period.key).toBe(month);
      expect(monthly.entries[0].donorId, month).toBe(id(winner));
    }
  });

  it("makes Users 17 and 18 swap places repeatedly within a month", () => {
    const inputs = (asOf: string) => computeAllMonthlyPoints(histories, events, asOf, S);
    let leader: number | null = null;
    let swaps = 0;
    for (let day = 3; day <= 28; day++) {
      const asOf = `2026-07-${String(day).padStart(2, "0")}`;
      const result = rankPeriod(inputs(asOf), currentPeriod("monthly", asOf), S);
      const r17 = result.byDonor.get(id(17));
      const r18 = result.byDonor.get(id(18));
      if (!r17 || !r18) continue;
      const ahead = r17.rank < r18.rank ? 17 : 18;
      if (leader !== null && ahead !== leader) swaps++;
      leader = ahead;
    }
    expect(swaps).toBeGreaterThanOrEqual(5);
  }, 60_000);

  it("gives User14 engagement points from referrals (+5 each, in the month the referred donor first gives)", () => {
    const mine = events.filter((e) => e.donorId === id(14));
    expect(mine.map((e) => e.date.slice(0, 7))).toEqual(["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]);
  });

  it("computes all three rankings for 2,500+ donors fast enough for the daily pipeline", () => {
    const started = Date.now();
    const r = computeRankings(histories, events, "2026-12-31", S);
    const ms = Date.now() - started;
    console.log(`computeRankings(2026-12-31): ${ms} ms, donors ranked: monthly ${r.monthly.entries.length}, yearly ${r.yearly.entries.length}, all-time ${r.alltime.entries.length}`);
    expect(r.alltime.entries.length).toBeGreaterThan(2400);
    expect(r.yearly.entries.length).toBeLessThanOrEqual(r.alltime.entries.length);
    expect(ms).toBeLessThan(15_000);
  }, 60_000);
});
