// Plain data types for the engine. The engine never touches Prisma or the clock: the pipeline
// (step 8) loads rows into these shapes and passes an explicit `asOf` date.

import type { Frequency, PaymentMethod } from "../constants";
import { SETTING_DEFAULTS } from "../settings-defaults";

export type DonationRec = {
  id: string;
  donorId: string;
  date: string; // ISO date
  amountUsd: number;
  method: PaymentMethod | string;
  program: string;
  campaign: string | null;
  status: "succeeded" | "failed" | string;
  subscriptionId: string | null;
};

export type SubscriptionRec = {
  id: string;
  donorId: string;
  amountUsd: number;
  frequency: Frequency | string;
  startDate: string;
  endDate: string | null;
};

/** Something that earns engagement points: an approved social claim, a badge share or a referral. */
export type EngagementEvent = {
  donorId: string;
  date: string;
  kind: "social_claim" | "share" | "referral";
};

/** Everything the engine knows about one donor. */
export type DonorHistory = {
  donorId: string;
  /** Sorted by date ascending. */
  donations: DonationRec[];
  subscriptions: SubscriptionRec[];
};

export type RecurringTier = "recurring" | "silver" | "gold" | "platinum" | "diamond";

export type EngineSettings = {
  points: {
    oneTimePerDollar: number;
    recurringPerDollar: number;
    matchingPerDollar: number;
    streakBonusPerMonth: number;
    streakBonusMaxPerMonth: number;
    engagementPerAction: number;
    engagementMaxPerMonth: number;
  };
  recurringTiers: Record<RecurringTier, number>;
  graceDays: number;
  failureWindowDaysMonthly: number;
  failureWindowDaysAnnual: number;
};

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  points: { ...SETTING_DEFAULTS.points },
  recurringTiers: { ...SETTING_DEFAULTS.recurringTiers },
  graceDays: SETTING_DEFAULTS.graceDays,
  failureWindowDaysMonthly: SETTING_DEFAULTS.failureWindowDaysMonthly,
  failureWindowDaysAnnual: SETTING_DEFAULTS.failureWindowDaysAnnual,
};

/** Groups rows per donor (donations sorted by date), including donors that only have rows. */
export function buildHistories(
  donations: DonationRec[],
  subscriptions: SubscriptionRec[],
): Map<string, DonorHistory> {
  const histories = new Map<string, DonorHistory>();
  const get = (donorId: string) => {
    let h = histories.get(donorId);
    if (!h) {
      h = { donorId, donations: [], subscriptions: [] };
      histories.set(donorId, h);
    }
    return h;
  };
  for (const d of donations) get(d.donorId).donations.push(d);
  for (const s of subscriptions) get(s.donorId).subscriptions.push(s);
  for (const h of histories.values()) {
    h.donations.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  }
  return histories;
}
