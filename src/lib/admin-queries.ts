// Read models for the backoffice. Everything is "as of" the simulated date. Rankings and subscription
// health are computed live with the engine (500 donors: a few milliseconds), so the admin always sees
// the same numbers the donors' notifications were based on.

import type { BadgeRule } from "./badge-definitions";
import type { Ranking } from "./constants";
import { getToday } from "./clock";
import { db } from "./db";
import { addDays, addMonthKey, isoWeekRange, lastDayOfMonth, monthKey } from "./dates";
import { badgeRarity } from "./engine/badges";
import { referralEvents } from "./engine/points";
import {
  computeAllMonthlyPoints,
  currentPeriod,
  monthPeriod,
  rankPeriod,
  yearPeriod,
  type PeriodSpec,
} from "./engine/rankings";
import { recurringSummary, streakAsOf, monthlyEquivalent, type RecurringSummary, type SubStatus } from "./engine/subscriptions";
import {
  buildHistories,
  type DonorHistory,
  type EngagementEvent,
  type EngineSettings,
  type SubscriptionRec,
} from "./engine/types";
import { loadSettings, toEngineSettings } from "./settings";
import type { AppSettings } from "./settings-defaults";

const pick = (locale: string, es: string, en: string) => (locale === "es" ? es : en);
const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- engine data ----------

export type EngineData = {
  today: string;
  settings: AppSettings;
  engine: EngineSettings;
  histories: Map<string, DonorHistory>;
  events: EngagementEvent[];
};

/** Everything the engine needs, loaded once per page. */
export async function loadEngineData(): Promise<EngineData> {
  const [today, settings] = await Promise.all([getToday(), loadSettings(db)]);
  const [donationRows, subRows, referred, claimRows, shareRows, users] = await Promise.all([
    db.donation.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] }),
    db.subscription.findMany(),
    db.donor.findMany({ where: { referredBy: { not: null } }, select: { id: true, referredBy: true } }),
    db.socialClaim.findMany({ where: { status: "approved" } }),
    db.shareEvent.findMany(),
    db.user.findMany({ where: { donorId: { not: null } }, select: { id: true, donorId: true } }),
  ]);
  const histories = buildHistories(
    donationRows.map((d) => ({
      id: d.id, donorId: d.donorId, date: d.date, amountUsd: d.amountUsd, method: d.method,
      program: d.program, campaign: d.campaign, status: d.status, subscriptionId: d.subscriptionId,
    })),
    subRows.map((s) => ({
      id: s.id, donorId: s.donorId, amountUsd: s.amountUsd, frequency: s.frequency, startDate: s.startDate, endDate: s.endDate,
    })),
  );
  const donorOfUser = new Map(users.map((u) => [u.id, u.donorId!]));
  const events: EngagementEvent[] = [
    ...referralEvents(referred.map((r) => ({ id: r.id, referredBy: r.referredBy })), histories),
    ...claimRows
      .filter((c) => c.reviewedAt && donorOfUser.has(c.userId))
      .map((c): EngagementEvent => ({ donorId: donorOfUser.get(c.userId)!, date: c.reviewedAt!, kind: "social_claim" })),
    ...shareRows
      .filter((s) => donorOfUser.has(s.userId))
      .map((s): EngagementEvent => ({ donorId: donorOfUser.get(s.userId)!, date: s.createdAt, kind: "share" })),
  ];
  return { today, settings, engine: toEngineSettings(settings), histories, events };
}

// ---------- overview ----------

export type Overview = {
  today: string;
  totalRaised: number;
  raisedThisMonth: number;
  donorsTotal: number;
  donorsThisMonth: number;
  activeRecurring: number;
  mrr: number;
  atRisk: number;
  badgesAwarded: number;
  pendingClaims: number;
  /** Last 12 months up to the demo date, oldest first. */
  monthly: { month: string; total: number }[];
};

export async function getOverview(): Promise<Overview> {
  const data = await loadEngineData();
  const { today, histories, engine } = data;
  const thisMonth = monthKey(today);

  let totalRaised = 0;
  let raisedThisMonth = 0;
  const byMonth = new Map<string, number>();
  const donorsThisMonth = new Set<string>();
  let donorsTotal = 0;
  let activeRecurring = 0;
  let mrr = 0;
  let atRisk = 0;

  for (const h of histories.values()) {
    let seen = false;
    for (const d of h.donations) {
      if (d.date > today) break;
      if (d.status !== "succeeded") continue;
      seen = true;
      totalRaised += d.amountUsd;
      const m = monthKey(d.date);
      byMonth.set(m, (byMonth.get(m) ?? 0) + d.amountUsd);
      if (m === thisMonth) {
        raisedThisMonth += d.amountUsd;
        donorsThisMonth.add(h.donorId);
      }
    }
    if (seen) donorsTotal++;
    if (h.subscriptions.length > 0) {
      const summary = recurringSummary(h.subscriptions, h.donations, today, engine);
      if (summary.overall === "active" || summary.overall === "grace") {
        activeRecurring++;
        mrr += summary.monthlyAmount;
      }
      if (summary.overall === "grace" || summary.overall === "inactive") atRisk++;
    }
  }

  const months: string[] = [];
  for (let i = 11; i >= 0; i--) months.push(addMonthKey(thisMonth, -i));

  const [badgesAwarded, pendingClaims] = await Promise.all([
    db.badgeAward.count(),
    db.socialClaim.count({ where: { status: "pending" } }),
  ]);
  return {
    today,
    totalRaised: round2(totalRaised),
    raisedThisMonth: round2(raisedThisMonth),
    donorsTotal,
    donorsThisMonth: donorsThisMonth.size,
    activeRecurring,
    mrr: round2(mrr),
    atRisk,
    badgesAwarded,
    pendingClaims,
    monthly: months.map((month) => ({ month, total: round2(byMonth.get(month) ?? 0) })),
  };
}

// ---------- at-risk recurring donors ----------

export type AtRiskRow = {
  donorId: string;
  name: string;
  email: string;
  status: "grace" | "inactive";
  monthlyAmount: number;
  /** The streak the donor had the day before the failure: what they stand to lose (or lost). */
  streakAtStake: number;
  daysLeft: number | null;
  failureStart: string;
  lastSuccess: string | null;
};

export async function getAtRisk(): Promise<AtRiskRow[]> {
  const { today, histories, engine } = await loadEngineData();
  const rows: Omit<AtRiskRow, "name" | "email">[] = [];

  for (const h of histories.values()) {
    if (h.subscriptions.length === 0) continue;
    const summary = recurringSummary(h.subscriptions, h.donations, today, engine);
    if (summary.overall !== "grace" && summary.overall !== "inactive") continue;
    const failing = summary.states.filter((s) => s.status === "grace" || s.status === "inactive");
    const subs = new Map(h.subscriptions.map((s) => [s.id, s]));
    const failureStart = failing.map((s) => s.failureStart!).sort()[0];
    rows.push({
      donorId: h.donorId,
      status: summary.overall,
      monthlyAmount: round2(failing.reduce((sum, s) => sum + monthlyEquivalent(subs.get(s.subscriptionId)!), 0)),
      streakAtStake: streakAsOf(h.subscriptions, h.donations, addDays(failureStart, -1), engine),
      daysLeft: summary.graceDaysLeft,
      failureStart,
      lastSuccess: failing.map((s) => s.lastSuccessDate).filter(Boolean).sort().at(-1) ?? null,
    });
  }

  const donors = await db.donor.findMany({ where: { id: { in: rows.map((r) => r.donorId) } }, select: { id: true, name: true, email: true } });
  const info = new Map(donors.map((d) => [d.id, d]));
  return rows
    .map((r) => ({ ...r, name: info.get(r.donorId)?.name ?? r.donorId, email: info.get(r.donorId)?.email ?? "" }))
    .sort(
      (a, b) =>
        Number(b.status === "grace") - Number(a.status === "grace") ||
        (a.daysLeft ?? 99) - (b.daysLeft ?? 99) ||
        b.monthlyAmount - a.monthlyAmount ||
        a.donorId.localeCompare(b.donorId),
    );
}

export const AT_RISK_COLUMNS = [
  "donor_id", "name", "email", "status", "monthly_amount_usd", "streak_at_stake", "days_left", "failure_start", "last_success",
];

export const atRiskToCsvRows = (rows: AtRiskRow[]) =>
  rows.map((r) => ({
    donor_id: r.donorId, name: r.name, email: r.email, status: r.status, monthly_amount_usd: r.monthlyAmount,
    streak_at_stake: r.streakAtStake, days_left: r.daysLeft ?? "", failure_start: r.failureStart, last_success: r.lastSuccess ?? "",
  }));

// ---------- donors ----------

export async function searchDonors(query: string) {
  const q = query.trim();
  const donors = await db.donor.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { id: { contains: q } }] } : undefined,
    orderBy: q ? { name: "asc" } : { id: "asc" },
    take: 50,
    include: { user: { select: { username: true } } },
  });
  return donors.map((d) => ({
    id: d.id, name: d.name, email: d.email, firstDonationDate: d.firstDonationDate, username: d.user?.username ?? null,
  }));
}

export type SubscriptionView = SubscriptionRec & { status: SubStatus; failureStart: string | null; graceDaysLeft: number | null };

export async function getDonorDetail(donorId: string, locale: string) {
  const donor = await db.donor.findUnique({ where: { id: donorId }, include: { user: true } });
  if (!donor) return null;
  const data = await loadEngineData();
  const { today, engine, histories } = data;
  const history = histories.get(donorId) ?? { donorId, donations: [], subscriptions: [] };

  const visible = history.donations.filter((d) => d.date <= today);
  const ok = visible.filter((d) => d.status === "succeeded");
  const summary: RecurringSummary = recurringSummary(history.subscriptions, history.donations, today, engine);
  const subscriptions: SubscriptionView[] = history.subscriptions
    .filter((s) => s.startDate <= today)
    .map((s) => {
      const state = summary.states.find((st) => st.subscriptionId === s.id)!;
      return { ...s, status: state.status, failureStart: state.failureStart, graceDaysLeft: state.graceDaysLeft };
    });

  const inputs = computeAllMonthlyPoints(histories, data.events, today, engine);
  const ranks = {} as Record<Ranking, { rank: number; total: number; topPercent: number; points: number } | null>;
  for (const ranking of ["monthly", "yearly", "alltime"] as Ranking[]) {
    const entry = rankPeriod(inputs, currentPeriod(ranking, today), engine).byDonor.get(donorId);
    ranks[ranking] = entry ? { rank: entry.rank, total: entry.totalRanked, topPercent: entry.topPercent, points: entry.points } : null;
  }

  const [awards, defs, referrer] = await Promise.all([
    db.badgeAward.findMany({ where: { donorId }, include: { badge: true }, orderBy: [{ awardedAt: "desc" }, { id: "desc" }] }),
    db.badgeDefinition.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    donor.referredBy ? db.donor.findUnique({ where: { id: donor.referredBy }, select: { name: true } }) : null,
  ]);

  return {
    today,
    donor: { id: donor.id, name: donor.name, email: donor.email, firstDonationDate: donor.firstDonationDate, referredBy: donor.referredBy, referredByName: referrer?.name ?? null },
    user: donor.user
      ? { id: donor.user.id, username: donor.user.username, alias: donor.user.alias, optOut: donor.user.gamificationOptOut, firstLoginAt: donor.user.firstLoginAt }
      : null,
    totals: {
      lifetime: round2(ok.reduce((s, d) => s + d.amountUsd, 0)),
      thisYear: round2(ok.filter((d) => d.date.startsWith(today.slice(0, 4))).reduce((s, d) => s + d.amountUsd, 0)),
      count: ok.length,
    },
    donations: [...visible].reverse().slice(0, 100),
    donationCount: visible.length,
    subscriptions,
    summary,
    ranks,
    badges: awards.map((a) => ({
      id: a.id, badgeId: a.badgeId, icon: a.badge.icon, periodKey: a.periodKey, awardedAt: a.awardedAt, source: a.source,
      name: pick(locale, a.badge.nameEs, a.badge.nameEn).replace("{year}", a.periodKey).replace("{campaign}", a.periodKey),
    })),
    badgeOptions: defs.map((d) => ({ id: d.id, name: pick(locale, d.nameEs, d.nameEn), repeatable: d.repeatable })),
  };
}

// ---------- rankings ----------

export type RankingRow = {
  rank: number;
  donorId: string;
  name: string;
  email: string;
  username: string | null;
  points: number;
  dollars: number;
};

export type WinnerRow = { kind: "week" | "month"; periodKey: string; donorId: string; name: string; awardedAt: string; amountUsd: number };

export async function getRankingsPage(options: { ranking: Ranking; period?: string; sort: "points" | "dollars"; limit: number }) {
  const data = await loadEngineData();
  const { today, histories, events, engine } = data;

  const months: string[] = [];
  for (let i = 0; i < 18; i++) months.push(addMonthKey(monthKey(today), -i));
  const years: string[] = [];
  for (let y = Number(today.slice(0, 4)); y >= Number(today.slice(0, 4)) - 5; y--) years.push(String(y));

  let period: PeriodSpec;
  if (options.ranking === "monthly") {
    const ym = options.period && months.includes(options.period) ? options.period : months[0];
    period = monthPeriod(ym);
  } else if (options.ranking === "yearly") {
    const y = options.period && years.includes(options.period) ? options.period : years[0];
    period = yearPeriod(y);
  } else {
    period = currentPeriod("alltime", today);
  }
  const asOf = period.to < today ? period.to : today;
  const effective: PeriodSpec = { ...period, to: asOf };

  const inputs = computeAllMonthlyPoints(histories, events, asOf, engine);
  const result = rankPeriod(inputs, effective, engine);

  const dollars = new Map<string, number>();
  for (const h of histories.values()) {
    let sum = 0;
    for (const d of h.donations) {
      if (d.date > asOf) break;
      if (d.status === "succeeded" && (effective.from === null || d.date >= effective.from)) sum += d.amountUsd;
    }
    if (sum > 0) dollars.set(h.donorId, round2(sum));
  }

  let order = result.entries.map((e) => ({ donorId: e.donorId, rank: e.rank, points: e.points }));
  if (options.sort === "dollars") {
    order = [...order].sort((a, b) => (dollars.get(b.donorId) ?? 0) - (dollars.get(a.donorId) ?? 0) || a.rank - b.rank);
  }
  const top = order.slice(0, options.limit);
  const [donors, users] = await Promise.all([
    db.donor.findMany({ where: { id: { in: top.map((t) => t.donorId) } }, select: { id: true, name: true, email: true } }),
    db.user.findMany({ where: { donorId: { in: top.map((t) => t.donorId) } }, select: { donorId: true, username: true } }),
  ]);
  const info = new Map(donors.map((d) => [d.id, d]));
  const username = new Map(users.map((u) => [u.donorId!, u.username]));

  const rows: RankingRow[] = top.map((t, i) => ({
    rank: options.sort === "dollars" ? i + 1 : t.rank,
    donorId: t.donorId,
    name: info.get(t.donorId)?.name ?? t.donorId,
    email: info.get(t.donorId)?.email ?? "",
    username: username.get(t.donorId) ?? null,
    points: t.points,
    dollars: dollars.get(t.donorId) ?? 0,
  }));

  return { today, period: effective, months, years, rows, total: result.entries.length, winners: await getWinners(data) };
}

/** Donor of the Week / Month history, newest first, with the amount that won it. */
async function getWinners(data: EngineData): Promise<WinnerRow[]> {
  const awards = await db.badgeAward.findMany({
    where: { badgeId: { in: ["B-C1", "B-C2"] } },
    orderBy: [{ awardedAt: "desc" }, { periodKey: "desc" }],
    take: 40,
  });
  const donors = await db.donor.findMany({ where: { id: { in: [...new Set(awards.map((a) => a.donorId))] } }, select: { id: true, name: true } });
  const names = new Map(donors.map((d) => [d.id, d.name]));
  return awards.map((a) => {
    const week = a.badgeId === "B-C1";
    const range = week ? isoWeekRange(a.periodKey) : { from: `${a.periodKey}-01`, to: lastDayOfMonth(a.periodKey) };
    let amountUsd = 0;
    if (range) {
      for (const d of data.histories.get(a.donorId)?.donations ?? []) {
        if (d.status === "succeeded" && d.date >= range.from && d.date <= range.to) amountUsd += d.amountUsd;
      }
    }
    return { kind: week ? "week" : "month", periodKey: a.periodKey, donorId: a.donorId, name: names.get(a.donorId) ?? a.donorId, awardedAt: a.awardedAt, amountUsd: round2(amountUsd) };
  });
}

// ---------- badges, claims, posts ----------

export async function getBadgeAdminList(locale: string) {
  const today = await getToday();
  const [defs, holders, totalDonors, counts] = await Promise.all([
    db.badgeDefinition.findMany({ orderBy: { sortOrder: "asc" } }),
    db.badgeAward.findMany({ select: { donorId: true, badgeId: true }, distinct: ["donorId", "badgeId"] }),
    db.donor.count({ where: { firstDonationDate: { lte: today } } }),
    db.badgeAward.groupBy({ by: ["badgeId"], _count: { _all: true } }),
  ]);
  const rarity = badgeRarity(holders, totalDonors);
  const count = new Map(counts.map((c) => [c.badgeId, c._count._all]));
  return defs.map((d) => ({
    id: d.id, category: d.category, icon: d.icon, tier: d.tier, active: d.active, manualOnly: d.manualOnly, repeatable: d.repeatable,
    name: pick(locale, d.nameEs, d.nameEn), rule: d.rule as unknown as BadgeRule,
    rarityPct: rarity.get(d.id) ?? 0, awards: count.get(d.id) ?? 0,
  }));
}

export async function getBadgeForEdit(id: string) {
  const d = await db.badgeDefinition.findUnique({ where: { id } });
  return d ? { ...d, rule: d.rule as unknown as BadgeRule } : null;
}

export async function getClaims() {
  const [pending, reviewed] = await Promise.all([
    db.socialClaim.findMany({ where: { status: "pending" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { user: { include: { donor: true } } } }),
    db.socialClaim.findMany({ where: { status: { not: "pending" } }, orderBy: [{ reviewedAt: "desc" }, { id: "desc" }], take: 15, include: { user: { include: { donor: true } } } }),
  ]);
  const view = (c: (typeof pending)[number]) => ({
    id: c.id, network: c.network, status: c.status, createdAt: c.createdAt, reviewedAt: c.reviewedAt,
    username: c.user.username, donorName: c.user.donor?.name ?? c.user.username,
  });
  return { pending: pending.map(view), reviewed: reviewed.map(view) };
}

export async function getPosts() {
  return db.post.findMany({ orderBy: [{ publishedAt: "desc" }, { id: "desc" }] });
}
