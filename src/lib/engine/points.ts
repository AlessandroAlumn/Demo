// Impact Points (BADGES_AND_NOTIFICATIONS.md, "Impact Points" and PLAN.md section 7.1).
//
//   one-time gift        1.0 pt per $1        recurring charge   1.5 pts per $1
//   employer match       1.0 pt per $1        streak bonus       +5 x streak months (max +60), in every month
//                                                                with a successful recurring charge
//   engagement           +5 per action, max 20 per calendar month
//                        (approved social follow, shared badge, referred donor's first donation)
//
// Only succeeded donations on or before `asOf` count. Everything is computed per calendar month, so the
// caps apply per month and yearly / all-time points are plain sums of months. Weights come from settings.

import { lastDayOfMonth, monthKey } from "../dates";
import { streakAsOf } from "./subscriptions";
import type { DonorHistory, EngagementEvent, EngineSettings } from "./types";

export type PointsBreakdown = {
  oneTime: number;
  recurring: number;
  matching: number;
  streakBonus: number;
  engagement: number;
  total: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const emptyBreakdown = (): PointsBreakdown => ({
  oneTime: 0, recurring: 0, matching: 0, streakBonus: 0, engagement: 0, total: 0,
});

/**
 * Points per calendar month ("YYYY-MM") for one donor, counting data up to `asOf`.
 * `fromMonth` skips earlier months: closed months never change, so the pipeline computes them
 * once and only recomputes the current month each simulated day.
 */
export function monthlyPoints(
  history: DonorHistory,
  events: EngagementEvent[],
  asOf: string,
  settings: EngineSettings,
  fromMonth?: string,
): Map<string, PointsBreakdown> {
  const w = settings.points;
  const months = new Map<string, PointsBreakdown>();
  const get = (m: string) => {
    let b = months.get(m);
    if (!b) months.set(m, (b = emptyBreakdown()));
    return b;
  };
  const recurringMonths = new Set<string>();

  for (const d of history.donations) {
    if (d.date > asOf) break; // donations are sorted by date
    if (d.status !== "succeeded") continue;
    const m = monthKey(d.date);
    if (fromMonth && m < fromMonth) continue;
    const b = get(m);
    if (d.method === "matching_gift") b.matching += d.amountUsd * w.matchingPerDollar;
    else if (d.subscriptionId) {
      b.recurring += d.amountUsd * w.recurringPerDollar;
      recurringMonths.add(m);
    } else b.oneTime += d.amountUsd * w.oneTimePerDollar;
  }

  for (const m of recurringMonths) {
    const at = lastDayOfMonth(m) < asOf ? lastDayOfMonth(m) : asOf;
    const streak = streakAsOf(history.subscriptions, history.donations, at, settings);
    get(m).streakBonus = Math.min(w.streakBonusMaxPerMonth, w.streakBonusPerMonth * streak);
  }

  const perMonth = new Map<string, number>();
  for (const e of events) {
    if (e.date > asOf) continue;
    const m = monthKey(e.date);
    if (fromMonth && m < fromMonth) continue;
    perMonth.set(m, (perMonth.get(m) ?? 0) + 1);
  }
  for (const [m, count] of perMonth) {
    get(m).engagement = Math.min(w.engagementMaxPerMonth, count * w.engagementPerAction);
  }

  for (const b of months.values()) {
    b.oneTime = round2(b.oneTime);
    b.recurring = round2(b.recurring);
    b.matching = round2(b.matching);
    b.total = round2(b.oneTime + b.recurring + b.matching + b.streakBonus + b.engagement);
  }
  return months;
}

/** Sum of the monthly breakdowns between two month keys (inclusive; null = from the beginning). */
export function sumMonths(
  months: Map<string, PointsBreakdown>,
  fromMonth: string | null,
  toMonth: string,
): PointsBreakdown {
  const sum = emptyBreakdown();
  for (const [m, b] of months) {
    if ((fromMonth !== null && m < fromMonth) || m > toMonth) continue;
    sum.oneTime += b.oneTime;
    sum.recurring += b.recurring;
    sum.matching += b.matching;
    sum.streakBonus += b.streakBonus;
    sum.engagement += b.engagement;
    sum.total += b.total;
  }
  for (const k of Object.keys(sum) as (keyof PointsBreakdown)[]) sum[k] = round2(sum[k]);
  return sum;
}

/**
 * A referral earns engagement points for the referrer on the day the referred donor makes their
 * first successful donation.
 */
export function referralEvents(
  donors: { id: string; referredBy: string | null }[],
  histories: Map<string, DonorHistory>,
): EngagementEvent[] {
  const events: EngagementEvent[] = [];
  for (const donor of donors) {
    if (!donor.referredBy) continue;
    const first = histories.get(donor.id)?.donations.find((d) => d.status === "succeeded");
    if (first) events.push({ donorId: donor.referredBy, date: first.date, kind: "referral" });
  }
  return events;
}
