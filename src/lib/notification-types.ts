// The 31 notification types (N1..N31) from BADGES_AND_NOTIFICATIONS.md.
//
// A notification is stored as `type` + `params` (never as rendered text), so switching the language
// re-renders old items. The param shapes are documented next to each type; the UI (step 9) renders them.

export const NOTIFICATION_TYPES = [
  "N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N10",
  "N11", "N12", "N13", "N14", "N15", "N16", "N17", "N18", "N19", "N20",
  "N21", "N22", "N23", "N24", "N25", "N26", "N27", "N28", "N29", "N30", "N31",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationMeta = {
  /** Shows in the feed list. */
  feed: boolean;
  /** Counts in the bell's unread badge. */
  bell: boolean;
  /** Also shows as a persistent banner on the dashboard while it applies. */
  banner: boolean;
  /** Never stored: part of another notification's UI (N2 is the share prompt inside N1). */
  uiOnly: boolean;
};

const m = (feed: boolean, bell: boolean, extra: Partial<NotificationMeta> = {}): NotificationMeta => ({
  feed, bell, banner: false, uiOnly: false, ...extra,
});

export const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  N1: m(true, true), //  { badgeId, periodKey }
  N2: m(false, false, { uiOnly: true }), // share prompt inside N1
  N3: m(true, false), //  { badgeId, remainingUsd, targetUsd }
  N4: m(true, true), //   { ranking, from, to, total, gap: { dollars, nextRank } | null, keepLead }
  N5: m(true, true), //   same shape as N4
  N6: m(true, true), //   { ranking, rank, total, gapDollars, nextRank }
  N7: m(true, true), //   { month, rank, total, topPercent }
  N8: m(true, true), //   { year, rank, total, topPercent }
  N9: m(true, true), //   { badgeId, periodKey, amountUsd }
  N10: m(true, true), //  { month, gained }
  N11: m(true, false), // { month }
  N12: m(true, true, { banner: true }), // { tier, streak, monthlyAmount }
  N13: m(false, true, { banner: true }), // { daysLeft, streak }
  N14: m(true, true), //  { tier, streak }
  N15: m(true, true), //  { streakRestored, tier, streak }
  N16: m(true, true), //  { tier, badgeIds }
  N17: m(true, false), // { nextTier, gapUsd }
  N18: m(true, false), // { donationId, amountUsd, program }
  N19: m(true, false), // { key, units, usd, lifetimeUsd }
  N20: m(true, true), //  { years }
  N21: m(true, false), // { lastDonation, months }
  N22: m(true, true), //  { year, amountUsd, badgeUnlocked }
  N23: m(true, true), //  { year }
  N24: m(true, true), //  { network, badgeId }
  N25: m(false, true), // { network }
  N26: m(true, true), //  { badgeUnlocked }
  N27: m(true, true), //  { postId }
  N28: m(true, true), //  { postId }
  N29: m(true, false), // { postId, kind: "pct" | "ending", pct?, daysLeft?, raisedUsd }
  N30: m(true, false), // { milestoneUsd }
  N31: m(true, false), // {}
};

/** Types the pipeline can store (everything except UI-only ones). */
export const STORED_TYPES = NOTIFICATION_TYPES.filter((t) => !NOTIFICATION_META[t].uiOnly);
