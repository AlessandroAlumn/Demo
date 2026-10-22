// Badge engine (PLAN.md section 7.4). Decides which of the 50 badges (BADGES_AND_NOTIFICATIONS.md)
// each donor has earned. Pure: the caller loads rows and passes a day.
//
//   evaluateBadges(input, day)  ->  every award that holds on `day`:
//     - state badges: thresholds and facts that are true as of `day` (lifetime clubs, tiers, streaks,
//       programs, matching years, social follows…). Cumulative, so earlier days' awards are included.
//     - period-close badges: weekly / monthly / yearly winners, produced ONLY on the day the period
//       closes (a week closes on its Sunday, a month on its last day, a year on 31 December).
//
// Idempotency is the caller's job through the unique key (donorId, badgeId, periodKey): evaluate every
// day, insert the candidates that are not stored yet, and notify for the new ones. Badges are never removed.
//
// `eventsFrom` (the demo launch date) stops purely date-driven repeatable badges (week/month winners,
// anniversaries) from being invented for every past period when the first day is processed.

import type { BadgeRule } from "../badge-definitions";
import { PERMANENT_PROGRAMS, SOCIAL_NETWORKS, type SocialNetwork } from "../constants";
import {
  addDays,
  addMonths,
  isoWeekKey,
  lastDayOfMonth,
  monthKey,
  toDate,
} from "../dates";
import {
  computeAllMonthlyPoints,
  monthPeriod,
  rankPeriod,
  yearPeriod,
  currentPeriod,
  type DonorPeriodInput,
  type RankingResult,
} from "./rankings";
import { reactivationDates, recurringSummary, type RecurringSummary } from "./subscriptions";
import type { DonorHistory, EngagementEvent, EngineSettings, RecurringTier } from "./types";

// ---------- inputs ----------

export type BadgeDef = {
  id: string;
  rule: BadgeRule;
  repeatable: boolean;
  manualOnly: boolean;
  active: boolean;
};

/** An approved social-follow claim. */
export type SocialClaimRec = { donorId: string; network: SocialNetwork | string; reviewedAt: string };
export type ShareRec = { donorId: string; date: string };

export type AwardCandidate = {
  donorId: string;
  badgeId: string;
  /** "" for one-off badges; "2026-W31", "2026-08", "2026", or a campaign slug for repeatable ones. */
  periodKey: string;
  awardedAt: string;
};

export type RankingSource = {
  /** Final ranking of a whole month ("2026-08"), computed with data up to its last day. */
  monthly(ym: string): RankingResult;
  yearly(year: string): RankingResult;
  /** The all-time ranking with data up to (and including) a date. */
  allTimeAt(date: string): RankingResult;
};

export type BadgeInput = {
  defs: BadgeDef[];
  settings: EngineSettings;
  histories: Map<string, DonorHistory>;
  /** Referral events are used for the Recruiter badges. */
  events: EngagementEvent[];
  claims: SocialClaimRec[];
  shares: ShareRec[];
  /** donorId -> simulated date of the user's first login (Early Adopter). */
  firstLogins: Map<string, string>;
  launchDate: string;
  earlyAdopterDays: number;
  eventsFrom: string;
  rankings: RankingSource;
};

export const awardKey = (a: Pick<AwardCandidate, "donorId" | "badgeId" | "periodKey">) =>
  `${a.donorId}|${a.badgeId}|${a.periodKey}`;

// ---------- ranking source with a small cache ----------

export function createRankingSource(
  histories: Map<string, DonorHistory>,
  events: EngagementEvent[],
  settings: EngineSettings,
): RankingSource {
  // Per-date inputs are heavy (every donor's monthly points); keep only the latest few.
  const inputCache = new Map<string, DonorPeriodInput[]>();
  const inputsAt = (asOf: string) => {
    let inputs = inputCache.get(asOf);
    if (!inputs) {
      inputs = computeAllMonthlyPoints(histories, events, asOf, settings);
      inputCache.set(asOf, inputs);
      if (inputCache.size > 3) inputCache.delete(inputCache.keys().next().value!);
    }
    return inputs;
  };
  return {
    monthly: (ym) => rankPeriod(inputsAt(lastDayOfMonth(ym)), monthPeriod(ym), settings),
    yearly: (year) => rankPeriod(inputsAt(`${year}-12-31`), yearPeriod(year), settings),
    allTimeAt: (date) => rankPeriod(inputsAt(date), currentPeriod("alltime", date), settings),
  };
}

// ---------- facts about a donor as of a date ----------

export type DonorFacts = {
  donorId: string;
  asOf: string;
  firstDonationDate: string | null;
  lifetimeTotal: number;
  /** Running total after each succeeded donation (for "when did they pass $X"). */
  running: { date: string; total: number }[];
  /** Distinct giving years in order, with the date of the gift that opened each. */
  years: { year: string; firstDate: string }[];
  programFirstDate: Map<string, string>;
  campaignFirstDate: Map<string, string>;
  /** Year -> date of the first matched gift that year. */
  matchingByYear: Map<string, string>;
  recurring: RecurringSummary;
  referralDates: string[];
  /** Network -> date the follow was confirmed. */
  followDates: Map<string, string>;
  firstShareDate: string | null;
  reactivatedOn: string | null;
};

export function computeFacts(
  input: Pick<BadgeInput, "settings" | "events" | "claims" | "shares">,
  history: DonorHistory,
  asOf: string,
  extras: { referralDates?: string[] } = {},
): DonorFacts {
  const donorId = history.donorId;
  const running: DonorFacts["running"] = [];
  const years = new Map<string, string>();
  const programFirstDate = new Map<string, string>();
  const campaignFirstDate = new Map<string, string>();
  const matchingByYear = new Map<string, string>();
  let total = 0;
  let firstDonationDate: string | null = null;

  for (const d of history.donations) {
    if (d.date > asOf) break; // sorted ascending
    if (d.status !== "succeeded") continue;
    firstDonationDate ??= d.date;
    total += d.amountUsd;
    running.push({ date: d.date, total });
    const year = d.date.slice(0, 4);
    if (!years.has(year)) years.set(year, d.date);
    if (!programFirstDate.has(d.program)) programFirstDate.set(d.program, d.date);
    if (d.campaign && !campaignFirstDate.has(d.campaign)) campaignFirstDate.set(d.campaign, d.date);
    if (d.method === "matching_gift" && !matchingByYear.has(year)) matchingByYear.set(year, d.date);
  }

  const followDates = new Map<string, string>();
  for (const c of input.claims) {
    if (c.donorId !== donorId || c.reviewedAt > asOf) continue;
    const existing = followDates.get(c.network);
    if (!existing || c.reviewedAt < existing) followDates.set(c.network, c.reviewedAt);
  }
  const shareDates = input.shares.filter((s) => s.donorId === donorId && s.date <= asOf).map((s) => s.date).sort();
  const referralDates =
    extras.referralDates ??
    input.events
      .filter((e) => e.kind === "referral" && e.donorId === donorId && e.date <= asOf)
      .map((e) => e.date)
      .sort();

  return {
    donorId,
    asOf,
    firstDonationDate,
    lifetimeTotal: Math.round(total * 100) / 100,
    running,
    years: [...years].map(([year, firstDate]) => ({ year, firstDate })),
    programFirstDate,
    campaignFirstDate,
    matchingByYear,
    recurring: recurringSummary(history.subscriptions, history.donations, asOf, input.settings),
    referralDates,
    followDates,
    firstShareDate: shareDates[0] ?? null,
    reactivatedOn: reactivationDates(history.subscriptions, history.donations, asOf, input.settings)[0] ?? null,
  };
}

const TIERS: RecurringTier[] = ["recurring", "silver", "gold", "platinum", "diamond"];

/** Date the running total first reached `usd`, or null. */
const dateTotalReached = (facts: DonorFacts, usd: number) =>
  facts.running.find((r) => r.total >= usd)?.date ?? null;

// ---------- state badges ----------

type Hit = { periodKey: string; earnedOn: string };

/** Hits for one rule given a donor's facts. Empty if not earned. Period-close rules are handled elsewhere. */
export function evaluateStateRule(
  rule: BadgeRule,
  facts: DonorFacts,
  input: Pick<BadgeInput, "firstLogins" | "launchDate" | "earlyAdopterDays" | "eventsFrom">,
): Hit[] {
  const one = (earnedOn: string | null): Hit[] => (earnedOn ? [{ periodKey: "", earnedOn }] : []);

  switch (rule.type) {
    case "first_donation":
      return one(facts.firstDonationDate);

    case "lifetime_total":
      return one(dateTotalReached(facts, rule.usd));

    case "recurring_tier":
      return facts.recurring.tier && TIERS.indexOf(facts.recurring.tier) >= TIERS.indexOf(rule.tier)
        ? one(facts.asOf)
        : [];

    case "streak":
      return facts.recurring.streak >= rule.months ? one(facts.asOf) : [];

    case "years_donated":
      return facts.years.length >= rule.years ? one(facts.years[rule.years - 1].firstDate) : [];

    case "anniversary": {
      if (!facts.firstDonationDate) return [];
      const day = Number(facts.firstDonationDate.slice(8, 10));
      const hits: Hit[] = [];
      for (let k = 1; ; k++) {
        const date = addMonths(facts.firstDonationDate, 12 * k, day);
        if (date > facts.asOf) break;
        if (date >= input.eventsFrom) hits.push({ periodKey: date.slice(0, 4), earnedOn: date });
      }
      return hits;
    }

    case "program":
      return one(facts.programFirstDate.get(rule.program) ?? null);

    case "full_spectrum": {
      const dates = rule.programs.map((p) => facts.programFirstDate.get(p));
      return dates.every(Boolean) ? one((dates as string[]).sort().at(-1)!) : [];
    }

    case "campaign_hero":
      return [...facts.campaignFirstDate].map(([campaign, earnedOn]) => ({ periodKey: campaign, earnedOn }));

    case "matching_year":
      return [...facts.matchingByYear].map(([year, earnedOn]) => ({ periodKey: year, earnedOn }));

    case "matching_streak": {
      const dates = [...facts.matchingByYear.values()].sort();
      return dates.length >= rule.years ? one(dates[rule.years - 1]) : [];
    }

    case "social_follow":
      return one(facts.followDates.get(rule.network) ?? null);

    case "fully_connected": {
      const dates = SOCIAL_NETWORKS.map((n) => facts.followDates.get(n));
      return dates.every(Boolean) ? one((dates as string[]).sort().at(-1)!) : [];
    }

    case "shared_first":
      return one(facts.firstShareDate);

    case "referral":
      return facts.referralDates.length >= rule.count ? one(facts.referralDates[rule.count - 1]) : [];

    case "reactivated":
      return one(facts.reactivatedOn);

    case "early_adopter": {
      const login = input.firstLogins.get(facts.donorId);
      if (!login || login > facts.asOf) return [];
      const daysAfterLaunch = Math.round((toDate(login).getTime() - toDate(input.launchDate).getTime()) / 86_400_000);
      return daysAfterLaunch <= input.earlyAdopterDays ? one(login) : [];
    }

    // Period-close and manual badges are not state-based.
    case "donor_of_week":
    case "donor_of_month":
    case "monthly_top_n":
    case "monthly_top_pct":
    case "biggest_climber":
    case "yearly_top_n":
    case "manual":
      return [];
  }
}

export function stateAwards(input: BadgeInput, day: string): AwardCandidate[] {
  const defs = input.defs.filter((d) => d.active && !d.manualOnly);
  const awards: AwardCandidate[] = [];
  const referralByDonor = new Map<string, string[]>();
  for (const e of input.events) {
    if (e.kind !== "referral" || e.date > day) continue;
    if (!referralByDonor.has(e.donorId)) referralByDonor.set(e.donorId, []);
    referralByDonor.get(e.donorId)!.push(e.date);
  }
  for (const dates of referralByDonor.values()) dates.sort();

  for (const history of input.histories.values()) {
    const facts = computeFacts(input, history, day, {
      referralDates: referralByDonor.get(history.donorId) ?? [],
    });
    for (const def of defs) {
      for (const hit of evaluateStateRule(def.rule, facts, input)) {
        awards.push({ donorId: history.donorId, badgeId: def.id, periodKey: hit.periodKey, awardedAt: hit.earnedOn });
      }
    }
  }
  return awards;
}

// ---------- period-close badges ----------

/** Donor with the most dollars (all succeeded rows) between two dates; ties: earliest gift, then donor id. */
export function topDonorByAmount(
  histories: Map<string, DonorHistory>,
  from: string,
  to: string,
): { donorId: string; amount: number } | null {
  let best: { donorId: string; amount: number; first: string } | null = null;
  for (const h of histories.values()) {
    let amount = 0;
    let first: string | null = null;
    for (const d of h.donations) {
      if (d.date > to) break;
      if (d.date < from || d.status !== "succeeded") continue;
      amount += d.amountUsd;
      first ??= d.date;
    }
    if (!first || amount <= 0) continue;
    if (
      !best ||
      amount > best.amount ||
      (amount === best.amount && (first < best.first || (first === best.first && h.donorId < best.donorId)))
    ) {
      best = { donorId: h.donorId, amount, first };
    }
  }
  return best && { donorId: best.donorId, amount: best.amount };
}

/**
 * Biggest Climber: the donor who gained the most positions in the all-time ranking over the month,
 * among donors already ranked at the start. Null if nobody moved up.
 */
export function biggestClimber(start: RankingResult, end: RankingResult): { donorId: string; gained: number } | null {
  let best: { donorId: string; gained: number; endRank: number } | null = null;
  for (const e of end.entries) {
    const before = start.byDonor.get(e.donorId);
    if (!before) continue;
    const gained = before.rank - e.rank;
    if (gained <= 0) continue;
    if (!best || gained > best.gained || (gained === best.gained && e.rank < best.endRank)) {
      best = { donorId: e.donorId, gained, endRank: e.rank };
    }
  }
  return best && { donorId: best.donorId, gained: best.gained };
}

export function periodCloseAwards(input: BadgeInput, day: string): AwardCandidate[] {
  if (day < input.eventsFrom) return [];
  const awards: AwardCandidate[] = [];
  const defs = input.defs.filter((d) => d.active && !d.manualOnly);
  const ofType = <T extends BadgeRule["type"]>(type: T) =>
    defs.filter((d): d is BadgeDef & { rule: Extract<BadgeRule, { type: T }> } => d.rule.type === type);
  const add = (donorId: string, badgeId: string, periodKey: string) =>
    awards.push({ donorId, badgeId, periodKey, awardedAt: day });

  // A week closes on its Sunday.
  if (toDate(day).getUTCDay() === 0) {
    const winner = topDonorByAmount(input.histories, addDays(day, -6), day);
    if (winner) for (const def of ofType("donor_of_week")) add(winner.donorId, def.id, isoWeekKey(day));
  }

  // A month closes on its last day.
  const ym = monthKey(day);
  if (day === lastDayOfMonth(ym)) {
    const winner = topDonorByAmount(input.histories, `${ym}-01`, day);
    if (winner) for (const def of ofType("donor_of_month")) add(winner.donorId, def.id, ym);

    const topN = ofType("monthly_top_n");
    const topPct = ofType("monthly_top_pct");
    if (topN.length || topPct.length) {
      const monthly = input.rankings.monthly(ym);
      for (const entry of monthly.entries) {
        for (const def of topN) if (entry.rank <= def.rule.n) add(entry.donorId, def.id, ym);
        for (const def of topPct) if (entry.topPercent <= def.rule.pct) add(entry.donorId, def.id, ym);
      }
    }

    const climbers = ofType("biggest_climber");
    if (climbers.length) {
      const previousMonthEnd = addDays(`${ym}-01`, -1);
      const climber = biggestClimber(input.rankings.allTimeAt(previousMonthEnd), input.rankings.allTimeAt(day));
      if (climber) for (const def of climbers) add(climber.donorId, def.id, ym);
    }
  }

  // A year closes on 31 December.
  if (day.endsWith("-12-31")) {
    const year = day.slice(0, 4);
    const yearTop = ofType("yearly_top_n");
    if (yearTop.length) {
      const yearly = input.rankings.yearly(year);
      for (const entry of yearly.entries) {
        for (const def of yearTop) if (entry.rank <= def.rule.n) add(entry.donorId, def.id, year);
      }
    }
  }

  return awards;
}

/** Everything that holds on `day`: state badges plus the period winners that close on that day. */
export function evaluateBadges(input: BadgeInput, day: string): AwardCandidate[] {
  return [...stateAwards(input, day), ...periodCloseAwards(input, day)];
}

// ---------- progress and rarity ----------

export type BadgeProgress = { current: number; target: number; unit: "usd" | "months" | "years" | "count" };

/** How far a donor is from a locked badge, for the "$180 / $250" bars. Null if the rule has no meter. */
export function badgeProgress(rule: BadgeRule, facts: DonorFacts, settings: EngineSettings): BadgeProgress | null {
  const clamp = (current: number, target: number, unit: BadgeProgress["unit"]): BadgeProgress => ({
    current: Math.min(current, target),
    target,
    unit,
  });
  switch (rule.type) {
    case "lifetime_total":
      return clamp(facts.lifetimeTotal, rule.usd, "usd");
    case "streak":
      return clamp(facts.recurring.streak, rule.months, "months");
    case "years_donated":
      return clamp(facts.years.length, rule.years, "years");
    case "recurring_tier":
      return clamp(facts.recurring.monthlyAmount, settings.recurringTiers[rule.tier], "usd");
    case "referral":
      return clamp(facts.referralDates.length, rule.count, "count");
    case "full_spectrum":
      return clamp(rule.programs.filter((p) => facts.programFirstDate.has(p)).length, rule.programs.length, "count");
    case "matching_streak":
      return clamp(facts.matchingByYear.size, rule.years, "years");
    case "fully_connected":
      return clamp(facts.followDates.size, SOCIAL_NETWORKS.length, "count");
    default:
      return null;
  }
}

/**
 * Locked money badges the donor is close to (default: within 10% of the target), for the
 * "You're $20 away from the $250 Club" notification.
 */
export function nearLifetimeBadges(
  defs: BadgeDef[],
  facts: DonorFacts,
  withinPct: number,
): { badgeId: string; remaining: number; target: number }[] {
  const out: { badgeId: string; remaining: number; target: number }[] = [];
  for (const def of defs) {
    if (!def.active || def.rule.type !== "lifetime_total") continue;
    const target = def.rule.usd;
    if (facts.lifetimeTotal >= target) continue;
    const remaining = Math.round((target - facts.lifetimeTotal) * 100) / 100;
    if (remaining / target <= withinPct / 100) out.push({ badgeId: def.id, remaining, target });
  }
  return out;
}

/** Share of donors holding each badge, as a percentage with one decimal. */
export function badgeRarity(
  awards: { donorId: string; badgeId: string }[],
  totalDonors: number,
): Map<string, number> {
  const holders = new Map<string, Set<string>>();
  for (const a of awards) {
    if (!holders.has(a.badgeId)) holders.set(a.badgeId, new Set());
    holders.get(a.badgeId)!.add(a.donorId);
  }
  const out = new Map<string, number>();
  for (const [badgeId, set] of holders) {
    out.set(badgeId, totalDonors > 0 ? Math.round((set.size / totalDonors) * 1000) / 10 : 0);
  }
  return out;
}

/** Programs that make up "Full Spectrum" (re-exported so UI code needs only this module). */
export const FULL_SPECTRUM_PROGRAMS = PERMANENT_PROGRAMS;

