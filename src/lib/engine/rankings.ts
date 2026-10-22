// Rankings (PLAN.md section 7.2). Three of them, all by Impact Points:
//   monthly (resets on the 1st), yearly (calendar year), all-time.
//
// - Eligible = at least one succeeded donation inside the period (engagement alone never qualifies).
// - Order: points descending; ties go to whoever made their first donation in the period earliest,
//   then to the lower donor id (so positions are always unique and deterministic).
// - Donors who opted out of gamification are still ranked: they only do not see the UI.

import { addDays, firstDayOfMonth, lastDayOfMonth, monthKey } from "../dates";
import type { Ranking } from "../constants";
import { monthlyPoints, sumMonths, type PointsBreakdown } from "./points";
import type { DonationRec, DonorHistory, EngagementEvent, EngineSettings } from "./types";

export type PeriodSpec = {
  ranking: Ranking;
  /** "2026-08", "2026" or "all". */
  key: string;
  /** Inclusive date bounds; `from` is null for all-time. */
  from: string | null;
  to: string;
};

export const currentPeriod = (ranking: Ranking, asOf: string): PeriodSpec =>
  ranking === "monthly"
    ? { ranking, key: monthKey(asOf), from: firstDayOfMonth(monthKey(asOf)), to: asOf }
    : ranking === "yearly"
      ? { ranking, key: asOf.slice(0, 4), from: `${asOf.slice(0, 4)}-01-01`, to: asOf }
      : { ranking, key: "all", from: null, to: asOf };

/** A whole month, e.g. to decide the winners of a month that has just closed. */
export const monthPeriod = (ym: string): PeriodSpec => ({
  ranking: "monthly", key: ym, from: firstDayOfMonth(ym), to: lastDayOfMonth(ym),
});

export const yearPeriod = (year: string): PeriodSpec => ({
  ranking: "yearly", key: year, from: `${year}-01-01`, to: `${year}-12-31`,
});

export type DonorPeriodInput = {
  donorId: string;
  donations: DonationRec[];
  months: Map<string, PointsBreakdown>;
};

export type RankEntry = {
  donorId: string;
  /** 1-based, unique. */
  rank: number;
  totalRanked: number;
  points: number;
  /** "Top 11%": ceil(rank / total * 100), at least 1. */
  topPercent: number;
  /**
   * What it takes to pass the donor directly above: the points difference and the smallest whole-dollar
   * one-time gift that does it. Null for #1 (keep your lead).
   */
  gapToNext: { points: number; dollars: number; aboveDonorId: string } | null;
};

export type RankingResult = {
  period: PeriodSpec;
  entries: RankEntry[];
  byDonor: Map<string, RankEntry>;
};

export const topPercent = (rank: number, total: number) =>
  Math.max(1, Math.ceil((rank / total) * 100));

/** Smallest whole-dollar one-time gift that strictly passes `gapPoints` (a tie is lost by the later donor). */
export const dollarsToPass = (gapPoints: number, settings: EngineSettings) =>
  Math.floor(gapPoints / settings.points.oneTimePerDollar + 1e-9) + 1;

export function periodStats(input: DonorPeriodInput, period: PeriodSpec) {
  let firstDonation: string | null = null;
  for (const d of input.donations) {
    if (d.status !== "succeeded") continue;
    if ((period.from !== null && d.date < period.from) || d.date > period.to) continue;
    if (firstDonation === null || d.date < firstDonation) firstDonation = d.date;
  }
  const points = sumMonths(input.months, period.from ? monthKey(period.from) : null, monthKey(period.to)).total;
  return { eligible: firstDonation !== null, points, firstDonation };
}

export function rankPeriod(
  inputs: Iterable<DonorPeriodInput>,
  period: PeriodSpec,
  settings: EngineSettings,
): RankingResult {
  const ranked: { donorId: string; points: number; firstDonation: string }[] = [];
  for (const input of inputs) {
    const s = periodStats(input, period);
    if (s.eligible) ranked.push({ donorId: input.donorId, points: s.points, firstDonation: s.firstDonation! });
  }
  ranked.sort(
    (a, b) =>
      b.points - a.points ||
      a.firstDonation.localeCompare(b.firstDonation) ||
      a.donorId.localeCompare(b.donorId),
  );

  const total = ranked.length;
  const entries: RankEntry[] = ranked.map((r, i) => {
    const above = i > 0 ? ranked[i - 1] : null;
    const gapPoints = above ? Math.round((above.points - r.points) * 100) / 100 : 0;
    return {
      donorId: r.donorId,
      rank: i + 1,
      totalRanked: total,
      points: r.points,
      topPercent: topPercent(i + 1, total),
      gapToNext: above
        ? { points: gapPoints, dollars: dollarsToPass(gapPoints, settings), aboveDonorId: above.donorId }
        : null,
    };
  });
  return { period, entries, byDonor: new Map(entries.map((e) => [e.donorId, e])) };
}

/** Per-donor monthly points for everyone (the expensive part), reusable across the three rankings. */
export function computeAllMonthlyPoints(
  histories: Map<string, DonorHistory>,
  events: EngagementEvent[],
  asOf: string,
  settings: EngineSettings,
): DonorPeriodInput[] {
  const byDonor = new Map<string, EngagementEvent[]>();
  for (const e of events) {
    if (!byDonor.has(e.donorId)) byDonor.set(e.donorId, []);
    byDonor.get(e.donorId)!.push(e);
  }
  return [...histories.values()].map((h) => ({
    donorId: h.donorId,
    donations: h.donations,
    months: monthlyPoints(h, byDonor.get(h.donorId) ?? [], asOf, settings),
  }));
}

/** The three current rankings as of a date. */
export function computeRankings(
  histories: Map<string, DonorHistory>,
  events: EngagementEvent[],
  asOf: string,
  settings: EngineSettings,
): Record<Ranking, RankingResult> {
  const inputs = computeAllMonthlyPoints(histories, events, asOf, settings);
  return {
    monthly: rankPeriod(inputs, currentPeriod("monthly", asOf), settings),
    yearly: rankPeriod(inputs, currentPeriod("yearly", asOf), settings),
    alltime: rankPeriod(inputs, currentPeriod("alltime", asOf), settings),
  };
}

/** Day before a date: handy when comparing "yesterday's" snapshot with today's. */
export const previousDay = (date: string) => addDays(date, -1);
