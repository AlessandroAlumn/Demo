// Shared helpers for the mock-data generator: ISO-date math, a seeded PRNG and the
// recurring-charge generator used by both the personas and the background donors.

import type { DonationStatus, Frequency, PaymentMethod, Program } from "../../src/lib/constants";

export const DATA_START = "2016-01-01";
export const DATA_END = "2026-12-31";
export const LAUNCH_DATE = "2026-07-01";

export type DonationRow = {
  donorId: string;
  date: string;
  amountUsd: number;
  method: PaymentMethod;
  program: Program;
  campaign: string; // "" when none
  status: DonationStatus;
  subscriptionId: string; // "" for one-time gifts
  referredBy: string; // "" unless set on a donor's first donation
};

export type SubRow = {
  id: string;
  donorId: string;
  amountUsd: number;
  frequency: Frequency;
  startDate: string;
  endDate: string; // "" while not cancelled
  status: "active" | "failed" | "cancelled";
};

export type DonorInfo = { id: string; name: string; email: string };

// ---------- dates ----------
// The date helpers live in src/lib/dates.ts (shared with the engine).
import { addDays, addMonths, daysBetween, monthKey } from "../../src/lib/dates";
export { addDays, addMonths, daysBetween, monthKey };
export { daysInMonth, toDate, toIso } from "../../src/lib/dates";

// ---------- seeded PRNG ----------

export type Rng = {
  next(): number;
  int(min: number, max: number): number; // inclusive
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly (readonly [T, number])[]): T;
  chance(p: number): boolean;
  logNormal(median: number, sigma: number): number;
};

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted: (items) => {
      const total = items.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [item, w] of items) {
        r -= w;
        if (r < 0) return item;
      }
      return items[items.length - 1][0];
    },
    chance: (p) => next() < p,
    logNormal: (median, sigma) => {
      const u1 = Math.max(next(), 1e-9);
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * next());
      return median * Math.exp(sigma * z);
    },
  };
  return rng;
}

// ---------- recurring charges ----------

export type ChargeOverride = {
  /** The scheduled charge fails. */
  fail?: boolean;
  /** A successful retry on this date (within or after the grace period). */
  retryDate?: string;
  /** No further charges after this one (card never fixed). */
  stop?: boolean;
};

export type ChargeOptions = {
  subId: string;
  donorId: string;
  start: string;
  frequency: Frequency;
  /** Amount per charge (annual subscriptions: the yearly amount). */
  amount: number;
  program: Program;
  method?: PaymentMethod;
  /** Cancellation date: no charge on or after it. */
  end?: string;
  /** Scripted outcomes keyed by the scheduled charge's "YYYY-MM" (personas). */
  overrides?: Record<string, ChargeOverride>;
  /** Random churn and failures (background donors). */
  random?: { rng: Rng; churnPerPeriod: number; failProb: number };
  campaign?: string;
};

export type ChargeResult = {
  rows: DonationRow[];
  /** Cancellation date, or "" if the subscription did not end. */
  endDate: string;
  /** True if charges stopped because a failed card was never fixed. */
  stopped: boolean;
};

export function generateCharges(o: ChargeOptions): ChargeResult {
  const rows: DonationRow[] = [];
  const stepMonths = o.frequency === "monthly" ? 1 : 12;
  const day = Number(o.start.slice(8, 10));
  const row = (date: string, status: DonationStatus): DonationRow => ({
    donorId: o.donorId,
    date,
    amountUsd: o.amount,
    method: o.method ?? "card",
    program: o.program,
    campaign: o.campaign ?? "",
    status,
    subscriptionId: o.subId,
    referredBy: "",
  });

  let endDate = o.end ?? "";
  let stopped = false;

  for (let k = 0; ; k++) {
    const date = k === 0 ? o.start : addMonths(o.start, k * stepMonths, day);
    if (date > DATA_END) break;
    if (o.end && date >= o.end) break;

    if (k > 0 && o.random && o.random.rng.chance(o.random.churnPerPeriod)) {
      endDate = date; // customer cancelled before this charge
      break;
    }

    const override = o.overrides?.[monthKey(date)];
    let failed = override?.fail ?? false;
    let retry = override?.retryDate;
    let stop = override?.stop ?? false;

    if (!override && o.random && o.random.rng.chance(o.random.failProb)) {
      failed = true;
      const r = o.random.rng.next();
      if (r < 0.4) retry = addDays(date, o.random.rng.int(2, 6)); // fixed within grace
      else if (r < 0.6) retry = addDays(date, o.random.rng.int(10, 35)); // fixed late
      else stop = true; // card never fixed
    }

    if (!failed) {
      rows.push(row(date, "succeeded"));
      continue;
    }
    rows.push(row(date, "failed"));
    if (retry && retry <= DATA_END) rows.push(row(retry, "succeeded"));
    if (stop && !retry) {
      stopped = true;
      break;
    }
  }

  return { rows, endDate, stopped };
}

/** Subscription status at the end of the data, derived from its rows (informational). */
export function deriveSubStatus(
  endDate: string,
  rows: DonationRow[],
): SubRow["status"] {
  if (endDate) return "cancelled";
  const last = [...rows].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return last && last.status === "failed" ? "failed" : "active";
}

export const roundTo = (n: number, step: number) => Math.round(n / step) * step;
