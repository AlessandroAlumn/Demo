// Pure detectors that decide WHEN a notification fires (PLAN.md section 7.5). Each returns drafts
// (type + params + a dedupe key); the pipeline stores them for donors that have a user account.
// A dedupe key makes every draft idempotent: re-running a day never creates a notification twice.

import type { Ranking } from "../constants";
import type { NotificationType } from "../notification-types";
import type { AwardCandidate, BadgeDef } from "./badges";
import type { RankEntry } from "./rankings";
import type { RecurringSummary } from "./subscriptions";
import type { RecurringTier } from "./types";

export type NotificationDraft = {
  donorId: string;
  type: NotificationType;
  params: Record<string, unknown>;
  dedupeKey: string;
  /** Simulated date it is created on. */
  date: string;
};

export type RankSnap = { periodKey: string; rank: number; totalRanked: number };

// ---------- rankings (N4, N5, N6) ----------

/**
 * Rank notifications (N4 up, N5 down) carrying the gap to the next position (or "keep your lead").
 *  - Up: any improvement over yesterday's snapshot of the SAME period, even one position.
 *  - Down: the rank got worse than the last rank the donor was told about (`downFrom`, or yesterday's if
 *    they were told nothing yet). Because background donors move everyone down almost daily, down moves
 *    are throttled to one digest every `downCooldownDays` per ranking (0 = every move).
 * A new period (the month rolled over) or a first appearance in the ranking stays silent.
 */
export function rankChangeDraft(
  donorId: string,
  ranking: Ranking,
  periodKey: string,
  prev: RankSnap | undefined,
  cur: RankEntry | undefined,
  date: string,
  options: {
    /** Last rank the donor was notified about (N4 or N5) in this period. */
    downFrom?: RankSnap;
    /** Date of the last N5 for this ranking. */
    lastDownDate?: string;
    downCooldownDays?: number;
    daysSince?: (a: string, b: string) => number;
  } = {},
): NotificationDraft | null {
  if (!cur || !prev || prev.periodKey !== periodKey) return null;

  const make = (type: "N4" | "N5", from: number): NotificationDraft => ({
    donorId,
    type,
    params: {
      ranking,
      periodKey,
      from,
      to: cur.rank,
      total: cur.totalRanked,
      gap: cur.gapToNext ? { dollars: cur.gapToNext.dollars, nextRank: cur.rank - 1 } : null,
      keepLead: cur.rank === 1,
    },
    dedupeKey: `rank:${donorId}:${ranking}:${date}`,
    date,
  });

  if (cur.rank < prev.rank) return make("N4", prev.rank);

  const ref = options.downFrom && options.downFrom.periodKey === periodKey ? options.downFrom : prev;
  if (cur.rank > ref.rank) {
    const cooldown = options.downCooldownDays ?? 0;
    if (cooldown > 0 && options.lastDownDate && options.daysSince && options.daysSince(options.lastDownDate, date) < cooldown) {
      return null;
    }
    return make("N5", ref.rank);
  }
  return null;
}

/**
 * Standalone N6 ("You're only $12 away from #213") when the gap is small. At most once per
 * `cooldownDays` per ranking.
 */
export function gapNudgeDraft(
  donorId: string,
  ranking: Ranking,
  cur: RankEntry | undefined,
  date: string,
  options: { thresholdUsd: number; cooldownDays: number; lastSent: string | undefined; daysSince: (a: string, b: string) => number },
): NotificationDraft | null {
  if (!cur || !cur.gapToNext || cur.gapToNext.dollars > options.thresholdUsd) return null;
  if (options.lastSent && options.daysSince(options.lastSent, date) < options.cooldownDays) return null;
  return {
    donorId,
    type: "N6",
    params: {
      ranking,
      rank: cur.rank,
      total: cur.totalRanked,
      gapDollars: cur.gapToNext.dollars,
      nextRank: cur.rank - 1,
    },
    dedupeKey: `gap:${donorId}:${ranking}:${date}`,
    date,
  };
}

// ---------- recurring payments (N12-N17) ----------

export function subscriptionDrafts(
  donorId: string,
  prev: RecurringSummary,
  cur: RecurringSummary,
  date: string,
): NotificationDraft[] {
  const drafts: NotificationDraft[] = [];
  const failureStart = (s: RecurringSummary) =>
    s.states.find((st) => st.status === "grace" || st.status === "inactive")?.failureStart ?? date;

  // N12: a charge failed (or 35+ days without one): banner + feed + bell
  if (prev.overall !== "grace" && cur.overall === "grace") {
    drafts.push({
      donorId, type: "N12", date,
      params: { tier: cur.tier, streak: cur.streak, monthlyAmount: cur.monthlyAmount },
      dedupeKey: `N12:${donorId}:${failureStart(cur)}`,
    });
  }
  // N13: 2 days (or fewer) left to save the streak; once per failure
  if (cur.overall === "grace" && cur.graceDaysLeft !== null && cur.graceDaysLeft <= 2) {
    drafts.push({
      donorId, type: "N13", date,
      params: { daysLeft: cur.graceDaysLeft, streak: cur.streak },
      dedupeKey: `N13:${donorId}:${failureStart(cur)}`,
    });
  }
  // N14: grace expired: the streak reset, the status is inactive (badges stay)
  if (prev.overall === "grace" && cur.overall === "inactive") {
    drafts.push({
      donorId, type: "N14", date,
      params: { tier: prev.tier, streak: prev.streak },
      dedupeKey: `N14:${donorId}:${failureStart(prev)}`,
    });
  }
  // N15: payment is back (inside grace the streak is restored; after it, the streak starts over)
  if ((prev.overall === "grace" || prev.overall === "inactive") && cur.overall === "active") {
    drafts.push({
      donorId, type: "N15", date,
      params: { streakRestored: prev.overall === "grace", tier: cur.tier, streak: cur.streak },
      dedupeKey: `N15:${donorId}:${date}`,
    });
  }
  return drafts;
}

/** N17: an active recurring donor is within `pct`% of the next tier. Once per target tier. */
export function tierNudgeDraft(
  donorId: string,
  cur: RecurringSummary,
  pct: number,
  date: string,
): NotificationDraft | null {
  if (cur.overall !== "active" || cur.monthlyAmount <= 0 || !cur.next) return null;
  if (cur.next.gap / cur.next.threshold > pct / 100) return null;
  return {
    donorId, type: "N17", date,
    params: { nextTier: cur.next.tier, gapUsd: cur.next.gap },
    dedupeKey: `N17:${donorId}:${cur.next.tier}`,
  };
}

// ---------- badges (N1, N9, N10, N16, N20, and the ones replaced by a more specific type) ----------

const TIER_BADGES: Record<string, RecurringTier> = {
  "B-R1": "recurring", "B-R2": "silver", "B-R3": "gold", "B-R4": "platinum", "B-R5": "diamond",
};
const TIER_ORDER: RecurringTier[] = ["recurring", "silver", "gold", "platinum", "diamond"];
/** Badges whose "you earned it" message is carried by a more specific notification. */
const REPLACED = new Set(["B-G1", "B-SO1", "B-SO2", "B-SO3", "B-SO4", "B-SO5", "B-SO9"]);

/**
 * Turns one donor's newly earned badges (one day) into notifications.
 *  - tier badges -> a single N16 for the highest tier
 *  - Donor of the Week/Month -> N9, Biggest Climber -> N10, anniversary -> N20
 *  - several money clubs on one day -> N1 only for the highest club
 *  - Double Impact, follows and Recruiter are announced by N22 / N24 / N26 instead
 *  - everything else -> N1
 */
export function badgeDrafts(
  donorId: string,
  awards: AwardCandidate[],
  defs: Map<string, BadgeDef>,
  date: string,
): NotificationDraft[] {
  const drafts: NotificationDraft[] = [];
  const tierBadges = awards.filter((a) => a.badgeId in TIER_BADGES);
  if (tierBadges.length > 0) {
    const tier = tierBadges
      .map((a) => TIER_BADGES[a.badgeId])
      .sort((a, b) => TIER_ORDER.indexOf(b) - TIER_ORDER.indexOf(a))[0];
    drafts.push({
      donorId, type: "N16", date,
      params: { tier, badgeIds: tierBadges.map((a) => a.badgeId) },
      dedupeKey: `N16:${donorId}:${tier}`,
    });
  }

  const clubs = awards
    .filter((a) => defs.get(a.badgeId)?.rule.type === "lifetime_total")
    .sort((a, b) => clubValue(b, defs) - clubValue(a, defs));
  const topClub = clubs[0];

  for (const a of awards) {
    const key = `${a.badgeId}:${a.periodKey}`;
    if (a.badgeId in TIER_BADGES || REPLACED.has(a.badgeId)) continue;
    if (defs.get(a.badgeId)?.rule.type === "lifetime_total" && a !== topClub) continue;
    switch (defs.get(a.badgeId)?.rule.type) {
      case "donor_of_week":
      case "donor_of_month":
        drafts.push({
          donorId, type: "N9", date,
          params: { badgeId: a.badgeId, periodKey: a.periodKey, amountUsd: a.meta?.amountUsd ?? 0 },
          dedupeKey: `N9:${donorId}:${key}`,
        });
        break;
      case "biggest_climber":
        drafts.push({
          donorId, type: "N10", date,
          params: { month: a.periodKey, gained: a.meta?.gained ?? 0 },
          dedupeKey: `N10:${donorId}:${a.periodKey}`,
        });
        break;
      case "anniversary":
        drafts.push({
          donorId, type: "N20", date,
          params: { years: a.meta?.years ?? 1 },
          dedupeKey: `N20:${donorId}:${a.periodKey}`,
        });
        break;
      default:
        drafts.push({
          donorId, type: "N1", date,
          params: { badgeId: a.badgeId, periodKey: a.periodKey },
          dedupeKey: `N1:${donorId}:${key}`,
        });
    }
  }
  return drafts;
}

function clubValue(a: AwardCandidate, defs: Map<string, BadgeDef>): number {
  const rule = defs.get(a.badgeId)?.rule;
  return rule?.type === "lifetime_total" ? rule.usd : 0;
}
