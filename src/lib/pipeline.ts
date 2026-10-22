// The daily pipeline and the demo time machine (PLAN.md section 7.6).
//
//   processUntil(db, target)   steps day by day from the last processed day to `target`. For each day it
//                              computes rankings, evaluates badges, emits notifications and stores snapshots.
//   resetDemo(db)              wipes derived data and re-runs the baseline day (the launch date).
//   refreshToday(db)           re-runs the current day (idempotent): picks up a login, claim review or share.
//
// The first day processed is the BASELINE (launch date): badges already earned are stored silently and no
// notifications are sent, otherwise day one would flood everybody. Every later day notifies for what is new.
//
// Everything is idempotent: awards are unique on (donor, badge, period), notifications on a dedupe key, and
// snapshots are keyed per donor/ranking. Running a day twice changes nothing.

import type { Prisma, PrismaClient } from "@prisma/client";
import type { Ranking } from "./constants";
import { SOCIAL_NETWORKS } from "./constants";
import {
  addDays,
  addMonths,
  daysBetween,
  lastDayOfMonth,
  monthKey,
} from "./dates";
import {
  awardKey,
  computeFacts,
  createRankingSource,
  evaluateBadges,
  nearLifetimeBadges,
  type AwardCandidate,
  type BadgeDef,
  type BadgeInput,
} from "./engine/badges";
import {
  badgeDrafts,
  gapNudgeDraft,
  rankChangeDraft,
  subscriptionDrafts,
  tierNudgeDraft,
  type NotificationDraft,
  type RankSnap,
} from "./engine/notifications";
import { monthlyPoints, referralEvents, type PointsBreakdown } from "./engine/points";
import {
  currentPeriod,
  rankPeriod,
  type DonorPeriodInput,
  type RankingResult,
} from "./engine/rankings";
import { recurringSummary } from "./engine/subscriptions";
import {
  buildHistories,
  type DonationRec,
  type DonorHistory,
  type EngagementEvent,
  type EngineSettings,
  type SubscriptionRec,
} from "./engine/types";
import type { BadgeRule } from "./badge-definitions";
import { loadSettings, saveSetting, toEngineSettings } from "./settings";
import type { AppSettings } from "./settings-defaults";

type Db = PrismaClient | Prisma.TransactionClient;

/** The demo ends with the generated data. */
export const DEMO_END_DATE = "2026-12-31";
const RANKINGS: Ranking[] = ["monthly", "yearly", "alltime"];
const CAMPAIGN_THRESHOLDS = [50, 75, 100];
const CAMPAIGN_ENDING_DAYS = 5;
const FOLLOW_BADGE: Record<string, string> = {
  instagram: "B-SO1", tiktok: "B-SO2", x: "B-SO3", youtube: "B-SO4", facebook: "B-SO5",
};

// ---------- points cache ----------

/**
 * Per-donor monthly points with closed months cached: a month's base (every earlier month) is computed
 * once, and each day only the current month is recomputed into it. The returned maps are shared and
 * mutated by the next call in the same month, so use the result before asking for another date.
 */
class PointsCache {
  private bases = new Map<string, Map<string, Map<string, PointsBreakdown>>>();

  constructor(
    private histories: Map<string, DonorHistory>,
    private eventsByDonor: Map<string, EngagementEvent[]>,
    private settings: EngineSettings,
  ) {}

  inputsAt(asOf: string): DonorPeriodInput[] {
    const month = monthKey(asOf);
    let base = this.bases.get(month);
    if (!base) {
      base = new Map();
      const previousEnd = addDays(`${month}-01`, -1);
      for (const h of this.histories.values()) {
        base.set(h.donorId, monthlyPoints(h, this.eventsByDonor.get(h.donorId) ?? [], previousEnd, this.settings));
      }
      this.bases.set(month, base);
      if (this.bases.size > 3) this.bases.delete(this.bases.keys().next().value!);
    }
    const inputs: DonorPeriodInput[] = [];
    for (const h of this.histories.values()) {
      const months = base.get(h.donorId)!;
      months.delete(month);
      for (const [m, b] of monthlyPoints(h, this.eventsByDonor.get(h.donorId) ?? [], asOf, this.settings, month)) {
        months.set(m, b);
      }
      inputs.push({ donorId: h.donorId, donations: h.donations, months });
    }
    return inputs;
  }
}

// ---------- the world: everything a day needs, loaded once per run ----------

type UserRec = { id: string; donorId: string; username: string; optOut: boolean; firstLoginAt: string | null };
type ClaimRec = { id: string; donorId: string; network: string; status: string; reviewedAt: string };
type PostRec = {
  id: string; kind: string; campaign: string | null; goalAmount: number | null;
  startDate: string | null; endDate: string | null; publishedAt: string;
};
type StoredSnapshot = RankSnap & { points: number; gapDollars: number | null; prevRank: number | null };

type World = {
  settings: AppSettings;
  engine: EngineSettings;
  defs: BadgeDef[];
  defMap: Map<string, BadgeDef>;
  histories: Map<string, DonorHistory>;
  users: UserRec[];
  claims: ClaimRec[];
  shares: { donorId: string; date: string }[];
  posts: PostRec[];
  events: EngagementEvent[];
  donationsByDate: Map<string, DonationRec[]>;
  awardKeys: Set<string>;
  notifKeys: Set<string>;
  snapshots: Map<string, StoredSnapshot>;
  lastGap: Map<string, string>;
  /** Last rank each donor was told about (N4/N5) per ranking, and the date of the last N5. */
  lastNotified: Map<string, RankSnap>;
  lastDown: Map<string, string>;
  nextSeq: number;
  orgTotal: number;
  campaignRaised: Map<string, number>;
  cache: PointsCache;
  badgeInput: BadgeInput;
};

async function loadWorld(db: Db, startDay: string): Promise<World> {
  const settings = await loadSettings(db);
  const engine = toEngineSettings(settings);

  const [donationRows, subRows, defRows, userRows, claimRows, shareRows, postRows, referredRows, awardRows, notifRows, snapRows, seqRow] =
    await Promise.all([
      db.donation.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] }),
      db.subscription.findMany(),
      db.badgeDefinition.findMany(),
      db.user.findMany({ where: { role: "donor", donorId: { not: null } } }),
      db.socialClaim.findMany({ where: { status: { in: ["approved", "rejected"] } } }),
      db.shareEvent.findMany(),
      db.post.findMany(),
      db.donor.findMany({ where: { referredBy: { not: null } }, select: { id: true, referredBy: true } }),
      db.badgeAward.findMany({ select: { donorId: true, badgeId: true, periodKey: true } }),
      db.notification.findMany({ select: { dedupeKey: true, type: true, params: true, createdAt: true, userId: true } }),
      db.rankSnapshot.findMany(),
      db.notification.aggregate({ _max: { seq: true } }),
    ]);

  const donations: DonationRec[] = donationRows.map((d) => ({
    id: d.id, donorId: d.donorId, date: d.date, amountUsd: d.amountUsd, method: d.method,
    program: d.program, campaign: d.campaign, status: d.status, subscriptionId: d.subscriptionId,
  }));
  const subscriptions: SubscriptionRec[] = subRows.map((s) => ({
    id: s.id, donorId: s.donorId, amountUsd: s.amountUsd, frequency: s.frequency,
    startDate: s.startDate, endDate: s.endDate,
  }));
  const histories = buildHistories(donations, subscriptions);

  const defs: BadgeDef[] = defRows.map((d) => ({
    id: d.id, rule: d.rule as unknown as BadgeRule, repeatable: d.repeatable, manualOnly: d.manualOnly, active: d.active,
  }));

  const users: UserRec[] = userRows.map((u) => ({
    id: u.id, donorId: u.donorId!, username: u.username, optOut: u.gamificationOptOut, firstLoginAt: u.firstLoginAt,
  }));
  const donorByUser = new Map(users.map((u) => [u.id, u.donorId]));

  const claims: ClaimRec[] = claimRows
    .filter((c) => c.reviewedAt && donorByUser.has(c.userId))
    .map((c) => ({ id: c.id, donorId: donorByUser.get(c.userId)!, network: c.network, status: c.status, reviewedAt: c.reviewedAt! }));
  const shares = shareRows
    .filter((s) => donorByUser.has(s.userId))
    .map((s) => ({ donorId: donorByUser.get(s.userId)!, date: s.createdAt }));

  const events: EngagementEvent[] = [
    ...referralEvents(referredRows.map((r) => ({ id: r.id, referredBy: r.referredBy })), histories),
    ...claims.filter((c) => c.status === "approved").map((c): EngagementEvent => ({ donorId: c.donorId, date: c.reviewedAt, kind: "social_claim" })),
    ...shares.map((s): EngagementEvent => ({ donorId: s.donorId, date: s.date, kind: "share" })),
  ];
  const eventsByDonor = new Map<string, EngagementEvent[]>();
  for (const e of events) {
    if (!eventsByDonor.has(e.donorId)) eventsByDonor.set(e.donorId, []);
    eventsByDonor.get(e.donorId)!.push(e);
  }

  const donationsByDate = new Map<string, DonationRec[]>();
  const previousDay = addDays(startDay, -1);
  let orgTotal = 0;
  const campaignRaised = new Map<string, number>();
  for (const d of donations) {
    if (!donationsByDate.has(d.date)) donationsByDate.set(d.date, []);
    donationsByDate.get(d.date)!.push(d);
    if (d.status === "succeeded" && d.date <= previousDay) {
      orgTotal += d.amountUsd;
      if (d.campaign) campaignRaised.set(d.campaign, (campaignRaised.get(d.campaign) ?? 0) + d.amountUsd);
    }
  }

  const snapshots = new Map<string, StoredSnapshot>();
  for (const s of snapRows) {
    const key = `${s.donorId}|${s.ranking}`;
    const existing = snapshots.get(key);
    // Keep the most recent period per donor and ranking.
    if (!existing || s.periodKey >= existing.periodKey) {
      snapshots.set(key, {
        periodKey: s.periodKey, rank: s.rank, totalRanked: s.totalRanked, points: s.points,
        gapDollars: s.gapDollars, prevRank: s.prevRank,
      });
    }
  }

  const lastGap = new Map<string, string>();
  const lastNotified = new Map<string, RankSnap>();
  const lastDown = new Map<string, string>();
  const userById = new Map(users.map((u) => [u.id, u]));
  const orderedNotifs = [...notifRows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const n of orderedNotifs) {
    const u = userById.get(n.userId);
    const params = n.params as { ranking?: string; periodKey?: string; to?: number; total?: number } | null;
    if (!u || !params?.ranking) continue;
    const key = `${u.donorId}|${params.ranking}`;
    if (n.type === "N6") lastGap.set(key, n.createdAt);
    if ((n.type === "N4" || n.type === "N5") && params.periodKey && params.to) {
      lastNotified.set(key, { periodKey: params.periodKey, rank: params.to, totalRanked: params.total ?? 0 });
      if (n.type === "N5") lastDown.set(key, n.createdAt);
    }
  }

  const cache = new PointsCache(histories, eventsByDonor, engine);
  const rankings = createRankingSource(histories, events, engine, (asOf) => cache.inputsAt(asOf));

  const world: World = {
    settings, engine, defs, defMap: new Map(defs.map((d) => [d.id, d])), histories, users, claims, shares,
    posts: postRows.map((p) => ({
      id: p.id, kind: p.kind, campaign: p.campaign, goalAmount: p.goalAmount,
      startDate: p.startDate, endDate: p.endDate, publishedAt: p.publishedAt,
    })),
    events, donationsByDate,
    awardKeys: new Set(awardRows.map((a) => awardKey(a))),
    notifKeys: new Set(notifRows.map((n) => n.dedupeKey)),
    snapshots, lastGap, lastNotified, lastDown,
    nextSeq: (seqRow._max.seq ?? 0) + 1,
    orgTotal, campaignRaised, cache,
    badgeInput: {
      defs, settings: engine, histories, events,
      claims: claims.filter((c) => c.status === "approved").map((c) => ({ donorId: c.donorId, network: c.network, reviewedAt: c.reviewedAt })),
      shares,
      firstLogins: new Map(users.filter((u) => u.firstLoginAt).map((u) => [u.donorId, u.firstLoginAt!])),
      launchDate: settings.launchDate,
      earlyAdopterDays: settings.earlyAdopterDays,
      eventsFrom: settings.launchDate,
      rankings,
    },
  };
  return world;
}

// ---------- one day ----------

type SnapshotUpdate = {
  donorId: string; ranking: Ranking; periodKey: string; asOfDate: string;
  rank: number; totalRanked: number; points: number; gapDollars: number | null; prevRank: number | null;
};
type DayOutput = { awards: AwardCandidate[]; drafts: NotificationDraft[]; snapshots: SnapshotUpdate[] };

function stepDay(world: World, day: string, baseline: boolean): DayOutput {
  const { engine, settings, histories } = world;
  const previousDay = addDays(day, -1);

  // 1. rankings as of today (one points computation shared by the three rankings)
  const inputs = world.cache.inputsAt(day);
  const rankings: Record<Ranking, RankingResult> = {
    monthly: rankPeriod(inputs, currentPeriod("monthly", day), engine),
    yearly: rankPeriod(inputs, currentPeriod("yearly", day), engine),
    alltime: rankPeriod(inputs, currentPeriod("alltime", day), engine),
  };

  // 2. badges: every award that holds today, minus the ones already stored
  const seen = new Set<string>();
  const awards = evaluateBadges(world.badgeInput, day).filter((a) => {
    const key = awardKey(a);
    if (world.awardKeys.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const drafts: NotificationDraft[] = [];
  const snapshots: SnapshotUpdate[] = [];
  const activeUsers = world.users.filter((u) => !u.optOut);

  // 3. rank snapshots (and, after the baseline, rank-change notifications)
  for (const u of activeUsers) {
    for (const ranking of RANKINGS) {
      const result = rankings[ranking];
      const cur = result.byDonor.get(u.donorId);
      const prev = world.snapshots.get(`${u.donorId}|${ranking}`);
      let changeDraft: NotificationDraft | null = null;
      if (!baseline) {
        changeDraft = rankChangeDraft(u.donorId, ranking, result.period.key, prev, cur, day, {
          downFrom: world.lastNotified.get(`${u.donorId}|${ranking}`),
          lastDownDate: world.lastDown.get(`${u.donorId}|${ranking}`),
          downCooldownDays: settings.rankDownCooldownDays,
          daysSince: daysBetween,
        });
        if (changeDraft) drafts.push(changeDraft);
        else {
          const nudge = gapNudgeDraft(u.donorId, ranking, cur, day, {
            thresholdUsd: settings.gapNudgeThresholdUsd,
            cooldownDays: settings.gapNudgeCooldownDays,
            lastSent: world.lastGap.get(`${u.donorId}|${ranking}`),
            daysSince: daysBetween,
          });
          if (nudge) drafts.push(nudge);
        }
      }
      const gapDollars = cur?.gapToNext?.dollars ?? null;
      if (
        cur &&
        (!prev || prev.periodKey !== result.period.key || prev.rank !== cur.rank ||
          prev.totalRanked !== cur.totalRanked || prev.gapDollars !== gapDollars)
      ) {
        const samePeriod = !!prev && prev.periodKey === result.period.key;
        snapshots.push({
          donorId: u.donorId, ranking, periodKey: result.period.key, asOfDate: day,
          rank: cur.rank, totalRanked: cur.totalRanked, points: cur.points, gapDollars,
          prevRank: samePeriod ? (prev!.rank !== cur.rank ? prev!.rank : prev!.prevRank) : null,
        });
      }
    }
  }

  // organisation-wide numbers for N29 / N30 (the baseline day counts too, silently)
  const todaysDonations = world.donationsByDate.get(day) ?? [];
  let orgAfter = world.orgTotal;
  const campaignAfter = new Map(world.campaignRaised);
  for (const d of todaysDonations) {
    if (d.status !== "succeeded") continue;
    orgAfter += d.amountUsd;
    if (d.campaign) campaignAfter.set(d.campaign, (campaignAfter.get(d.campaign) ?? 0) + d.amountUsd);
  }

  if (baseline) {
    world.orgTotal = orgAfter;
    for (const [k, v] of campaignAfter) world.campaignRaised.set(k, v);
    return { awards, drafts, snapshots };
  }

  // 4. per-user notifications
  const awardsByDonor = new Map<string, AwardCandidate[]>();
  for (const a of awards) {
    if (!awardsByDonor.has(a.donorId)) awardsByDonor.set(a.donorId, []);
    awardsByDonor.get(a.donorId)!.push(a);
  }
  const equivalence = settings.impactEquivalences[0];
  const monthEnds = day === lastDayOfMonth(monthKey(day));

  for (const u of activeUsers) {
    const history = histories.get(u.donorId);
    if (!history) continue;
    const push = (d: NotificationDraft | null) => d && drafts.push(d);
    const mine = awardsByDonor.get(u.donorId) ?? [];

    // badges (N1, N9, N10, N16, N20)
    drafts.push(...badgeDrafts(u.donorId, mine, world.defMap, day));

    // recurring payments (N12-N15) and the upgrade nudge (N17)
    const prevSummary = recurringSummary(history.subscriptions, history.donations, previousDay, engine);
    const curSummary = recurringSummary(history.subscriptions, history.donations, day, engine);
    drafts.push(...subscriptionDrafts(u.donorId, prevSummary, curSummary, day));
    push(tierNudgeDraft(u.donorId, curSummary, settings.nextMilestoneNudgePct, day));

    // donations received (N18), employer matches (N22), referrals (N26)
    for (const d of todaysDonations) {
      if (d.donorId !== u.donorId || d.status !== "succeeded") continue;
      if (d.method === "matching_gift") {
        drafts.push({
          donorId: u.donorId, type: "N22", date: day,
          params: { year: day.slice(0, 4), amountUsd: d.amountUsd, badgeUnlocked: mine.some((a) => a.badgeId === "B-G1") },
          dedupeKey: `N22:${d.id}`,
        });
      } else {
        drafts.push({
          donorId: u.donorId, type: "N18", date: day,
          params: { donationId: d.id, amountUsd: d.amountUsd, program: d.program },
          dedupeKey: `N18:${d.id}`,
        });
      }
    }
    world.events
      .filter((e) => e.kind === "referral" && e.donorId === u.donorId && e.date === day)
      .forEach((_, i) =>
        drafts.push({
          donorId: u.donorId, type: "N26", date: day,
          params: { badgeUnlocked: mine.some((a) => a.badgeId === "B-SO9") },
          dedupeKey: `N26:${u.donorId}:${day}:${i}`,
        }),
      );

    // near a locked money badge (N3) and impact equivalences (N19)
    const facts = computeFacts(world.badgeInput, history, day);
    for (const near of nearLifetimeBadges(world.defs, facts, settings.nextMilestoneNudgePct)) {
      drafts.push({
        donorId: u.donorId, type: "N3", date: day,
        params: { badgeId: near.badgeId, remainingUsd: near.remaining, targetUsd: near.target },
        dedupeKey: `N3:${u.donorId}:${near.badgeId}`,
      });
    }
    if (equivalence) {
      const before = computeFacts(world.badgeInput, history, previousDay).lifetimeTotal;
      const unitsBefore = Math.floor(before / equivalence.usd);
      const unitsNow = Math.floor(facts.lifetimeTotal / equivalence.usd);
      if (unitsNow > unitsBefore && unitsNow >= 1) {
        drafts.push({
          donorId: u.donorId, type: "N19", date: day,
          params: { key: equivalence.key, units: unitsNow, usd: equivalence.usd, lifetimeUsd: facts.lifetimeTotal },
          dedupeKey: `N19:${u.donorId}:${equivalence.key}:${unitsNow}`,
        });
      }
    }

    // lapsed donor (N21)
    if (facts.firstDonationDate && curSummary.overall !== "active" && curSummary.overall !== "grace") {
      const last = [...history.donations].reverse().find((d) => d.status === "succeeded" && d.date <= day);
      if (last && addMonths(last.date, settings.lapsedMonths) <= day) {
        drafts.push({
          donorId: u.donorId, type: "N21", date: day,
          params: { lastDonation: last.date, months: settings.lapsedMonths },
          dedupeKey: `N21:${u.donorId}:${last.date}`,
        });
      }
    }

    // calendar-driven: new month (N11), month and year close (N7, N8), matching reminder (N23)
    if (day.endsWith("-01")) {
      drafts.push({
        donorId: u.donorId, type: "N11", date: day, params: { month: monthKey(day) },
        dedupeKey: `N11:${u.donorId}:${monthKey(day)}`,
      });
    }
    if (monthEnds) {
      const entry = rankings.monthly.byDonor.get(u.donorId);
      if (entry) {
        drafts.push({
          donorId: u.donorId, type: "N7", date: day,
          params: { month: monthKey(day), rank: entry.rank, total: entry.totalRanked, topPercent: entry.topPercent },
          dedupeKey: `N7:${u.donorId}:${monthKey(day)}`,
        });
      }
    }
    if (day.endsWith("-12-31")) {
      const entry = rankings.yearly.byDonor.get(u.donorId);
      if (entry) {
        drafts.push({
          donorId: u.donorId, type: "N8", date: day,
          params: { year: day.slice(0, 4), rank: entry.rank, total: entry.totalRanked, topPercent: entry.topPercent },
          dedupeKey: `N8:${u.donorId}:${day.slice(0, 4)}`,
        });
      }
    }
    if (day.slice(5) === settings.matchingReminderMonthDay) {
      drafts.push({
        donorId: u.donorId, type: "N23", date: day, params: { year: day.slice(0, 4) },
        dedupeKey: `N23:${u.donorId}:${day.slice(0, 4)}`,
      });
    }

    // welcome (N31), reviewed social claims (N24, N25)
    if (u.firstLoginAt && u.firstLoginAt <= day) {
      drafts.push({ donorId: u.donorId, type: "N31", date: u.firstLoginAt, params: {}, dedupeKey: `N31:${u.donorId}` });
    }
    for (const c of world.claims) {
      if (c.donorId !== u.donorId || c.reviewedAt > day) continue;
      drafts.push(
        c.status === "approved"
          ? {
              donorId: u.donorId, type: "N24", date: c.reviewedAt,
              params: { network: c.network, badgeId: FOLLOW_BADGE[c.network] ?? null },
              dedupeKey: `N24:${c.id}`,
            }
          : { donorId: u.donorId, type: "N25", date: c.reviewedAt, params: { network: c.network }, dedupeKey: `N25:${c.id}` },
      );
    }

    // posts and campaigns (N27, N28, N29) and organisation milestones (N30)
    for (const post of world.posts) {
      if (post.publishedAt > day) continue;
      drafts.push({
        donorId: u.donorId, type: post.kind === "campaign" ? "N28" : "N27", date: post.publishedAt,
        params: { postId: post.id },
        dedupeKey: `${post.kind === "campaign" ? "N28" : "N27"}:${u.donorId}:${post.id}`,
      });
      if (post.kind !== "campaign" || !post.campaign || !post.goalAmount) continue;
      if (post.startDate && post.startDate > day) continue;
      const raised = campaignAfter.get(post.campaign) ?? 0;
      for (const pct of CAMPAIGN_THRESHOLDS) {
        if ((raised / post.goalAmount) * 100 >= pct) {
          drafts.push({
            donorId: u.donorId, type: "N29", date: day,
            params: { postId: post.id, kind: "pct", pct, raisedUsd: Math.round(raised) },
            dedupeKey: `N29:${u.donorId}:${post.id}:${pct}`,
          });
        }
      }
      if (post.endDate && post.endDate >= day) {
        const daysLeft = daysBetween(day, post.endDate);
        if (daysLeft <= CAMPAIGN_ENDING_DAYS && raised < post.goalAmount) {
          drafts.push({
            donorId: u.donorId, type: "N29", date: day,
            params: { postId: post.id, kind: "ending", daysLeft, pct: Math.round((raised / post.goalAmount) * 100), raisedUsd: Math.round(raised) },
            dedupeKey: `N29:${u.donorId}:${post.id}:ending`,
          });
        }
      }
    }
    for (const milestone of settings.orgMilestones) {
      if (world.orgTotal < milestone && orgAfter >= milestone) {
        drafts.push({
          donorId: u.donorId, type: "N30", date: day, params: { milestoneUsd: milestone },
          dedupeKey: `N30:${u.donorId}:${milestone}`,
        });
      }
    }
  }

  world.orgTotal = orgAfter;
  for (const [k, v] of campaignAfter) world.campaignRaised.set(k, v);
  return { awards, drafts, snapshots };
}

// ---------- persisting a day ----------

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

async function persistDay(
  db: PrismaClient,
  world: World,
  day: string,
  out: DayOutput,
): Promise<{ awards: number; notifications: number }> {
  const userByDonor = new Map(world.users.map((u) => [u.donorId, u]));
  const stored: Prisma.NotificationCreateManyInput[] = [];
  const batchKeys = new Set<string>();
  for (const d of out.drafts) {
    if (world.notifKeys.has(d.dedupeKey) || batchKeys.has(d.dedupeKey)) continue;
    const user = userByDonor.get(d.donorId);
    if (!user) continue;
    batchKeys.add(d.dedupeKey);
    stored.push({
      userId: user.id, type: d.type, params: d.params as Prisma.InputJsonValue,
      createdAt: d.date, seq: world.nextSeq++, dedupeKey: d.dedupeKey,
    });
  }

  await db.$transaction(
    async (tx) => {
      for (const part of chunk(out.awards, 500)) {
        await tx.badgeAward.createMany({
          data: part.map((a) => ({
            donorId: a.donorId, badgeId: a.badgeId, awardedAt: a.awardedAt, periodKey: a.periodKey, source: "auto",
          })),
        });
      }
      for (const part of chunk(stored, 500)) await tx.notification.createMany({ data: part });
      for (const s of out.snapshots) {
        await tx.rankSnapshot.upsert({
          where: { donorId_ranking_periodKey: { donorId: s.donorId, ranking: s.ranking, periodKey: s.periodKey } },
          update: {
            asOfDate: s.asOfDate, rank: s.rank, totalRanked: s.totalRanked, points: s.points,
            gapDollars: s.gapDollars, prevRank: s.prevRank,
          },
          create: s,
        });
      }
      await saveSetting(tx, "simulatedToday", day);
      await saveSetting(tx, "lastProcessedDate", day);
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  for (const a of out.awards) world.awardKeys.add(awardKey(a));
  for (const n of stored) world.notifKeys.add(n.dedupeKey);
  for (const s of out.snapshots) {
    world.snapshots.set(`${s.donorId}|${s.ranking}`, {
      periodKey: s.periodKey, rank: s.rank, totalRanked: s.totalRanked, points: s.points,
      gapDollars: s.gapDollars, prevRank: s.prevRank,
    });
  }
  for (const n of stored) {
    const donorId = world.users.find((u) => u.id === n.userId)?.donorId;
    const params = n.params as { ranking?: string; periodKey?: string; to?: number; total?: number };
    if (!donorId || !params.ranking) continue;
    const key = `${donorId}|${params.ranking}`;
    if (n.type === "N6") world.lastGap.set(key, n.createdAt as string);
    if ((n.type === "N4" || n.type === "N5") && params.periodKey && params.to) {
      world.lastNotified.set(key, { periodKey: params.periodKey, rank: params.to, totalRanked: params.total ?? 0 });
      if (n.type === "N5") world.lastDown.set(key, n.createdAt as string);
    }
  }
  return { awards: out.awards.length, notifications: stored.length };
}

// ---------- public API ----------

export type ProcessResult = { from: string | null; to: string; days: number; awards: number; notifications: number };

let queue: Promise<unknown> = Promise.resolve();
/** Runs one pipeline job at a time (a double-click on the time machine must not run two at once). */
function serialized<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => undefined);
  return next;
}

export async function getDemoState(db: Db): Promise<{ today: string; lastProcessed: string; launchDate: string }> {
  const s = await loadSettings(db);
  return { today: s.simulatedToday, lastProcessed: s.lastProcessedDate, launchDate: s.launchDate };
}

/** Processes every day after the last processed one, up to and including `target`. */
export function processUntil(db: PrismaClient, target: string): Promise<ProcessResult> {
  return serialized(async () => {
    const state = await getDemoState(db);
    const capped = target > DEMO_END_DATE ? DEMO_END_DATE : target;
    const first = state.lastProcessed === "" ? state.launchDate : addDays(state.lastProcessed, 1);
    const result: ProcessResult = { from: first, to: capped, days: 0, awards: 0, notifications: 0 };
    if (first > capped) return { ...result, from: null };

    const world = await loadWorld(db, first);
    for (let day = first; day <= capped; day = addDays(day, 1)) {
      const baseline = state.lastProcessed === "" && day === first;
      const out = stepDay(world, day, baseline);
      const written = await persistDay(db, world, day, out);
      result.days++;
      result.awards += written.awards;
      result.notifications += written.notifications;
    }
    return result;
  });
}

/** Re-runs the current day. Safe to call any time: it only stores what is new. */
export function refreshToday(db: PrismaClient): Promise<ProcessResult> {
  return serialized(async () => {
    const state = await getDemoState(db);
    if (state.lastProcessed === "") return { from: null, to: state.today, days: 0, awards: 0, notifications: 0 };
    const day = state.lastProcessed;
    const world = await loadWorld(db, day);
    const out = stepDay(world, day, false);
    const written = await persistDay(db, world, day, out);
    return { from: day, to: day, days: 1, awards: written.awards, notifications: written.notifications };
  });
}

/** Moves the demo clock forward (never back) by a number of days. */
export async function advanceDays(db: PrismaClient, days: number): Promise<ProcessResult> {
  const { today } = await getDemoState(db);
  return processUntil(db, addDays(today, days));
}

export async function advanceMonths(db: PrismaClient, months: number): Promise<ProcessResult> {
  const { today } = await getDemoState(db);
  return processUntil(db, addMonths(today, months));
}

/**
 * Wipes everything derived (automatic badge awards, snapshots, notifications, claims, shares, first logins),
 * sets the clock to the launch date and re-runs the baseline day. Manual awards (Ambassador) and admin
 * content (posts) are kept.
 */
export async function resetDemo(db: PrismaClient): Promise<ProcessResult> {
  await serialized(async () => {
    const settings = await loadSettings(db);
    await db.$transaction(async (tx) => {
      await tx.notification.deleteMany();
      await tx.rankSnapshot.deleteMany();
      await tx.socialClaim.deleteMany();
      await tx.shareEvent.deleteMany();
      await tx.badgeAward.deleteMany({ where: { source: "auto" } });
      await tx.user.updateMany({ data: { firstLoginAt: null } });
      await saveSetting(tx, "simulatedToday", settings.launchDate);
      await saveSetting(tx, "lastProcessedDate", "");
    });
  });
  const settings = await loadSettings(db);
  return processUntil(db, settings.launchDate);
}

export { SOCIAL_NETWORKS };
