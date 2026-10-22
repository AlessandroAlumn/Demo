import { describe, expect, it } from "vitest";
import type { PointsBreakdown } from "./points";
import {
  currentPeriod,
  dollarsToPass,
  monthPeriod,
  rankPeriod,
  topPercent,
  yearPeriod,
  type DonorPeriodInput,
} from "./rankings";
import { DEFAULT_ENGINE_SETTINGS as S, type DonationRec } from "./types";

let n = 0;
const don = (donorId: string, date: string, amount = 10, status = "succeeded"): DonationRec => ({
  id: `d${++n}`, donorId, date, amountUsd: amount, method: "card", program: "becas",
  campaign: null, status, subscriptionId: null,
});
const breakdown = (total: number): PointsBreakdown => ({
  oneTime: total, recurring: 0, matching: 0, streakBonus: 0, engagement: 0, total,
});
/** A donor with explicit donations and points per month. */
const donor = (donorId: string, months: Record<string, number>, donations: DonationRec[]): DonorPeriodInput => ({
  donorId,
  donations,
  months: new Map(Object.entries(months).map(([m, p]) => [m, breakdown(p)])),
});

describe("periods", () => {
  it("derives the current month, year and all-time periods from the date", () => {
    expect(currentPeriod("monthly", "2026-08-14")).toMatchObject({ key: "2026-08", from: "2026-08-01", to: "2026-08-14" });
    expect(currentPeriod("yearly", "2026-08-14")).toMatchObject({ key: "2026", from: "2026-01-01" });
    expect(currentPeriod("alltime", "2026-08-14")).toMatchObject({ key: "all", from: null });
    expect(monthPeriod("2026-02")).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
    expect(yearPeriod("2025")).toMatchObject({ from: "2025-01-01", to: "2025-12-31" });
  });
});

describe("rankPeriod", () => {
  const period = currentPeriod("monthly", "2026-08-31");

  it("orders by points, descending, with unique 1-based ranks", () => {
    const result = rankPeriod(
      [
        donor("A", { "2026-08": 50 }, [don("A", "2026-08-05")]),
        donor("B", { "2026-08": 90 }, [don("B", "2026-08-05")]),
        donor("C", { "2026-08": 70 }, [don("C", "2026-08-05")]),
      ],
      period,
      S,
    );
    expect(result.entries.map((e) => [e.donorId, e.rank, e.totalRanked])).toEqual([["B", 1, 3], ["C", 2, 3], ["A", 3, 3]]);
  });

  it("breaks ties by earliest first donation in the period, then by donor id", () => {
    const result = rankPeriod(
      [
        donor("Z", { "2026-08": 50 }, [don("Z", "2026-08-02")]),
        donor("Y", { "2026-08": 50 }, [don("Y", "2026-08-09")]),
        donor("X", { "2026-08": 50 }, [don("X", "2026-08-02")]),
      ],
      period,
      S,
    );
    expect(result.entries.map((e) => e.donorId)).toEqual(["X", "Z", "Y"]);
  });

  it("only ranks donors with a succeeded donation inside the period (engagement alone never qualifies)", () => {
    const result = rankPeriod(
      [
        donor("A", { "2026-08": 50 }, [don("A", "2026-08-05")]),
        donor("B", { "2026-08": 5 }, []), // engagement only
        donor("C", { "2026-08": 999 }, [don("C", "2026-08-05", 10, "failed")]),
        donor("D", { "2026-07": 80 }, [don("D", "2026-07-31")]), // last month
      ],
      period,
      S,
    );
    expect(result.entries.map((e) => e.donorId)).toEqual(["A"]);
  });

  it("sums the months of the period: yearly and all-time include earlier months", () => {
    const inputs = [
      donor("A", { "2025-12": 500, "2026-01": 10, "2026-08": 10 }, [don("A", "2026-01-05")]),
      donor("B", { "2026-08": 100 }, [don("B", "2026-08-05")]),
    ];
    const yearly = rankPeriod(inputs, currentPeriod("yearly", "2026-08-31"), S);
    expect(yearly.byDonor.get("A")!.points).toBe(20);
    expect(yearly.entries[0].donorId).toBe("B");
    const alltime = rankPeriod(inputs, currentPeriod("alltime", "2026-08-31"), S);
    expect(alltime.byDonor.get("A")!.points).toBe(520);
    expect(alltime.entries[0].donorId).toBe("A");
  });

  it("reports the top percentage, e.g. #258 of 2,500 is the Top 11%", () => {
    expect(topPercent(258, 2500)).toBe(11);
    expect(topPercent(1, 2500)).toBe(1);
    expect(topPercent(2500, 2500)).toBe(100);
    expect(topPercent(1, 100000)).toBe(1);
  });

  it("gives the gap to the donor above in points and whole dollars; #1 has none", () => {
    const result = rankPeriod(
      [
        donor("A", { "2026-08": 100 }, [don("A", "2026-08-05")]),
        donor("B", { "2026-08": 87.5 }, [don("B", "2026-08-05")]),
        donor("C", { "2026-08": 87.5 }, [don("C", "2026-08-06")]),
      ],
      period,
      S,
    );
    expect(result.byDonor.get("A")!.gapToNext).toBeNull();
    expect(result.byDonor.get("B")!.gapToNext).toEqual({ points: 12.5, dollars: 13, aboveDonorId: "A" });
    // tied on points but later first donation: $1 is enough to pass
    expect(result.byDonor.get("C")!.gapToNext).toEqual({ points: 0, dollars: 1, aboveDonorId: "B" });
  });

  it("handles an empty period", () => {
    expect(rankPeriod([], period, S).entries).toEqual([]);
  });
});

describe("dollarsToPass", () => {
  it("is the smallest whole-dollar gift that strictly passes the gap", () => {
    expect(dollarsToPass(0, S)).toBe(1);
    expect(dollarsToPass(11.2, S)).toBe(12);
    expect(dollarsToPass(12, S)).toBe(13); // 12 dollars only ties
    expect(dollarsToPass(12, { ...S, points: { ...S.points, oneTimePerDollar: 2 } })).toBe(7);
  });
});
