// Recurring-donation logic: subscription health "as of" a date, the 7-day grace period, the monthly
// streak, the current monthly amount and the tier (PLAN.md section 7.3).
//
// Vocabulary
// - A charge row has status "succeeded" or "failed"; recurring rows carry a subscription id.
// - A subscription is *healthy* if its latest charge on or before the date succeeded and it has had a
//   successful charge inside the failure window (35 days monthly, 370 annual).
// - When it stops being healthy a *grace period* of `graceDays` starts. If a charge succeeds inside it,
//   nothing is lost. If not, the streak resets and the status becomes "inactive" (badges stay).

import { addDays, addMonthKey, daysBetween, monthKey } from "../dates";
import type {
  DonationRec,
  EngineSettings,
  RecurringTier,
  SubscriptionRec,
} from "./types";

export type SubStatus = "not_started" | "active" | "grace" | "inactive" | "cancelled";

export type SubState = {
  subscriptionId: string;
  status: SubStatus;
  lastSuccessDate: string | null;
  /** Date the current failure began (first failed charge, or the day the failure window lapsed). */
  failureStart: string | null;
  /** Days left before the grace period ends (1..graceDays while in grace, 0 once expired). */
  graceDaysLeft: number | null;
};

const byDate = (a: DonationRec, b: DonationRec) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

/** Rows of one subscription, on or before `asOf`, oldest first. */
function rowsOf(subId: string, donations: DonationRec[], asOf: string): DonationRec[] {
  return donations.filter((d) => d.subscriptionId === subId && d.date <= asOf).sort(byDate);
}

export function subscriptionState(
  sub: SubscriptionRec,
  donations: DonationRec[],
  asOf: string,
  settings: EngineSettings,
): SubState {
  const base = { subscriptionId: sub.id, lastSuccessDate: null, failureStart: null, graceDaysLeft: null };
  if (sub.startDate > asOf) return { ...base, status: "not_started" };

  const rows = rowsOf(sub.id, donations, asOf);
  const lastSuccess = [...rows].reverse().find((r) => r.status === "succeeded")?.date ?? null;

  if (sub.endDate && sub.endDate <= asOf) return { ...base, lastSuccessDate: lastSuccess, status: "cancelled" };

  const window =
    sub.frequency === "annual" ? settings.failureWindowDaysAnnual : settings.failureWindowDaysMonthly;
  const latest = rows.at(-1);
  const reference = lastSuccess ?? sub.startDate;
  const failedByRow = latest?.status === "failed";
  const lapsed = daysBetween(reference, asOf) > window;

  if (!failedByRow && !lapsed) return { ...base, lastSuccessDate: lastSuccess, status: "active" };

  // First failed charge since the last success; or the day the window ran out if no charge failed.
  const failureStart = failedByRow
    ? rows.find((r) => r.status === "failed" && (lastSuccess === null || r.date > lastSuccess))!.date
    : addDays(reference, window + 1);
  const graceDaysLeft = Math.max(0, settings.graceDays - daysBetween(failureStart, asOf));

  return {
    subscriptionId: sub.id,
    status: graceDaysLeft > 0 ? "grace" : "inactive",
    lastSuccessDate: lastSuccess,
    failureStart,
    graceDaysLeft,
  };
}

/** Months covered by one successful charge: its own month, or 12 months for an annual plan. */
function addCoverage(covered: Set<string>, date: string, frequency: string) {
  const month = monthKey(date);
  const span = frequency === "annual" ? 12 : 1;
  for (let i = 0; i < span; i++) covered.add(addMonthKey(month, i));
}

type Coverage = {
  /** Months that count towards the streak. */
  covered: Set<string>;
  /** A month whose charge failed but is still inside its grace period: it keeps the streak alive without counting. */
  bridge: Set<string>;
};

/**
 * Months this subscription "counts" for the streak, as of `asOf`.
 * - A success that fixes a failure inside the grace period also covers the month that failed.
 * - A failure still inside its grace period bridges its month (the streak is at risk, not lost).
 * - A failure whose grace expired unfixed wipes the earlier months: the streak restarts.
 */
function coverage(
  sub: SubscriptionRec,
  donations: DonationRec[],
  asOf: string,
  settings: EngineSettings,
): Coverage {
  const covered = new Set<string>();
  const bridge = new Set<string>();
  let pendingFail: string | null = null;

  for (const row of rowsOf(sub.id, donations, asOf)) {
    if (row.status === "failed") {
      pendingFail ??= row.date;
      continue;
    }
    if (pendingFail) {
      if (row.date < addDays(pendingFail, settings.graceDays)) covered.add(monthKey(pendingFail));
      else covered.clear(); // fixed too late: the streak had already reset
      pendingFail = null;
    }
    addCoverage(covered, row.date, sub.frequency);
  }

  if (pendingFail) {
    if (asOf < addDays(pendingFail, settings.graceDays)) bridge.add(monthKey(pendingFail));
    else covered.clear();
  }
  return { covered, bridge };
}

/**
 * Consecutive months with a successful recurring charge, ending this month (if already covered)
 * or last month (the charge simply has not happened yet this month).
 */
export function streakAsOf(
  subscriptions: SubscriptionRec[],
  donations: DonationRec[],
  asOf: string,
  settings: EngineSettings,
): number {
  const covered = new Set<string>();
  const bridge = new Set<string>();
  for (const sub of subscriptions) {
    if (sub.startDate > asOf) continue;
    const c = coverage(sub, donations, asOf, settings);
    c.covered.forEach((m) => covered.add(m));
    c.bridge.forEach((m) => bridge.add(m));
  }
  const has = (m: string) => covered.has(m) || bridge.has(m);
  const current = monthKey(asOf);
  let month = has(current) ? current : addMonthKey(current, -1);
  let streak = 0;
  while (has(month)) {
    if (covered.has(month)) streak++;
    month = addMonthKey(month, -1);
  }
  return streak;
}

/** Monthly value of a subscription (annual plans divided by 12). */
export const monthlyEquivalent = (sub: SubscriptionRec) =>
  sub.frequency === "annual" ? sub.amountUsd / 12 : sub.amountUsd;

/**
 * Sum of the monthly amounts the donor is currently committed to: subscriptions that are active or
 * in their grace period (the tier is at risk, not gone). Inactive and cancelled ones do not count.
 */
export function currentMonthlyAmount(subscriptions: SubscriptionRec[], states: SubState[]): number {
  const live = new Set(states.filter((s) => s.status === "active" || s.status === "grace").map((s) => s.subscriptionId));
  const total = subscriptions.filter((s) => live.has(s.id)).reduce((sum, s) => sum + monthlyEquivalent(s), 0);
  return Math.round(total * 100) / 100;
}

const TIER_ORDER: RecurringTier[] = ["recurring", "silver", "gold", "platinum", "diamond"];

/** Highest tier whose threshold the monthly amount reaches, or null below the entry tier. */
export function recurringTier(monthlyAmount: number, tiers: Record<RecurringTier, number>): RecurringTier | null {
  let result: RecurringTier | null = null;
  for (const tier of TIER_ORDER) if (monthlyAmount >= tiers[tier]) result = tier;
  return result;
}

/** The next tier up and how many dollars per month away it is; null at the top. */
export function nextTier(
  monthlyAmount: number,
  tiers: Record<RecurringTier, number>,
): { tier: RecurringTier; threshold: number; gap: number } | null {
  for (const tier of TIER_ORDER) {
    if (tiers[tier] > monthlyAmount) {
      return { tier, threshold: tiers[tier], gap: Math.round((tiers[tier] - monthlyAmount) * 100) / 100 };
    }
  }
  return null;
}

export type RecurringSummary = {
  states: SubState[];
  monthlyAmount: number;
  tier: RecurringTier | null;
  next: ReturnType<typeof nextTier>;
  streak: number;
  /** grace beats active (the banner matters most), then inactive; "none" if never recurring or all cancelled. */
  overall: "active" | "grace" | "inactive" | "none";
  /** Smallest number of grace days left among subscriptions in grace. */
  graceDaysLeft: number | null;
};

export function recurringSummary(
  subscriptions: SubscriptionRec[],
  donations: DonationRec[],
  asOf: string,
  settings: EngineSettings,
): RecurringSummary {
  const states = subscriptions.map((s) => subscriptionState(s, donations, asOf, settings));
  const monthlyAmount = currentMonthlyAmount(subscriptions, states);
  const inGrace = states.filter((s) => s.status === "grace");
  const overall: RecurringSummary["overall"] = inGrace.length
    ? "grace"
    : states.some((s) => s.status === "active")
      ? "active"
      : states.some((s) => s.status === "inactive")
        ? "inactive"
        : "none";

  return {
    states,
    monthlyAmount,
    tier: recurringTier(monthlyAmount, settings.recurringTiers),
    next: nextTier(monthlyAmount, settings.recurringTiers),
    streak: streakAsOf(subscriptions, donations, asOf, settings),
    overall,
    graceDaysLeft: inGrace.length ? Math.min(...inGrace.map((s) => s.graceDaysLeft ?? 0)) : null,
  };
}

/**
 * Dates on which the donor came back after a recurring lapse ("Back in the Game", B-X1), oldest first.
 * A lapse is either a failed charge whose grace period expired unfixed, or a cancellation followed by
 * more than a failure window without any recurring charge (a plan change, where the next plan charges
 * on the cancellation day, is not a lapse). The comeback is the first successful recurring charge
 * after the lapse.
 */
export function reactivationDates(
  subscriptions: SubscriptionRec[],
  donations: DonationRec[],
  asOf: string,
  settings: EngineSettings,
): string[] {
  const successes = donations
    .filter((d) => d.subscriptionId && d.status === "succeeded" && d.date <= asOf)
    .map((d) => d.date)
    .sort();
  const firstSuccessOnOrAfter = (date: string) => successes.find((d) => d >= date) ?? null;
  const comebacks = new Set<string>();

  for (const sub of subscriptions) {
    if (sub.startDate > asOf) continue;

    // Failures that were not fixed inside their grace period: the first success after the expiry is the comeback.
    const unresolved: string[] = [];
    let open: string | null = null;
    for (const row of rowsOf(sub.id, donations, asOf)) {
      if (row.status === "failed") {
        open ??= row.date;
        continue;
      }
      if (open && row.date >= addDays(open, settings.graceDays)) unresolved.push(open);
      open = null;
    }
    if (open) unresolved.push(open);
    for (const failedOn of unresolved) {
      const expiry = addDays(failedOn, settings.graceDays);
      if (expiry > asOf) continue;
      const back = firstSuccessOnOrAfter(expiry);
      if (back) comebacks.add(back);
    }

    if (sub.endDate && sub.endDate <= asOf) {
      const next = firstSuccessOnOrAfter(sub.endDate);
      if (next && daysBetween(sub.endDate, next) > settings.failureWindowDaysMonthly) comebacks.add(next);
    }
  }
  return [...comebacks].sort();
}
