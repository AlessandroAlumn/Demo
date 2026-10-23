// Read models for the donor screens: overview (dashboard), donation history, and the badge catalog.
// Everything is "as of" the simulated date, and only about the signed-in donor.

import type { BadgeRule } from "./badge-definitions";
import { BADGE_CATEGORIES, type BadgeCategory, type Ranking } from "./constants";
import { getToday } from "./clock";
import { db } from "./db";
import { badgeProgress, badgeRarity, computeFacts, type BadgeProgress, type DonorFacts } from "./engine/badges";
import { recurringSummary, type RecurringSummary } from "./engine/subscriptions";
import type { DonationRec, DonorHistory, SubscriptionRec } from "./engine/types";
import { loadSettings, toEngineSettings } from "./settings";
import type { AppSettings } from "./settings-defaults";

const pick = (locale: string, es: string, en: string) => (locale === "es" ? es : en);

async function loadRecs(donorId: string): Promise<{ donations: DonationRec[]; subscriptions: SubscriptionRec[] }> {
  const [donationRows, subRows] = await Promise.all([
    db.donation.findMany({ where: { donorId }, orderBy: [{ date: "asc" }, { id: "asc" }] }),
    db.subscription.findMany({ where: { donorId } }),
  ]);
  return {
    donations: donationRows.map((d) => ({
      id: d.id, donorId: d.donorId, date: d.date, amountUsd: d.amountUsd, method: d.method,
      program: d.program, campaign: d.campaign, status: d.status, subscriptionId: d.subscriptionId,
    })),
    subscriptions: subRows.map((s) => ({
      id: s.id, donorId: s.donorId, amountUsd: s.amountUsd, frequency: s.frequency,
      startDate: s.startDate, endDate: s.endDate,
    })),
  };
}

// ---------- dashboard ----------

export type RankView = {
  ranking: Ranking;
  rank: number;
  total: number;
  topPercent: number;
  /** Dollars to pass the donor above; null for #1. */
  gapDollars: number | null;
  /** Positions gained (+) or lost (-) at the last change in this period; 0 if it never changed. */
  change: number;
};

export type Overview = {
  today: string;
  settings: AppSettings;
  totals: { lifetime: number; thisYear: number; thisMonth: number; matched: number; count: number };
  /** null = not ranked in this period yet. */
  ranks: Record<Ranking, RankView | null>;
  recurring: RecurringSummary;
  /** Number of impact units the lifetime total buys, with its translation key. */
  impact: { key: string; units: number } | null;
};

export async function getOverview(donorId: string): Promise<Overview> {
  const today = await getToday();
  const settings = await loadSettings(db);
  const engine = toEngineSettings(settings);
  const { donations, subscriptions } = await loadRecs(donorId);

  const ok = donations.filter((d) => d.status === "succeeded" && d.date <= today);
  const sum = (rows: DonationRec[]) => Math.round(rows.reduce((s, d) => s + d.amountUsd, 0) * 100) / 100;
  const totals = {
    lifetime: sum(ok),
    thisYear: sum(ok.filter((d) => d.date.startsWith(today.slice(0, 4)))),
    thisMonth: sum(ok.filter((d) => d.date.startsWith(today.slice(0, 7)))),
    matched: sum(ok.filter((d) => d.method === "matching_gift")),
    count: ok.length,
  };

  const periodKey: Record<Ranking, string> = { monthly: today.slice(0, 7), yearly: today.slice(0, 4), alltime: "all" };
  const snapshots = await db.rankSnapshot.findMany({ where: { donorId } });
  const ranks = {} as Record<Ranking, RankView | null>;
  for (const ranking of ["monthly", "yearly", "alltime"] as Ranking[]) {
    const s = snapshots.find((x) => x.ranking === ranking && x.periodKey === periodKey[ranking]);
    ranks[ranking] = s
      ? {
          ranking, rank: s.rank, total: s.totalRanked,
          topPercent: Math.max(1, Math.ceil((s.rank / s.totalRanked) * 100)),
          gapDollars: s.gapDollars, change: s.prevRank ? s.prevRank - s.rank : 0,
        }
      : null;
  }

  const equivalence = settings.impactEquivalences[0];
  const units = equivalence ? Math.floor(totals.lifetime / equivalence.usd) : 0;
  return {
    today, settings, totals, ranks,
    recurring: recurringSummary(subscriptions, donations, today, engine),
    impact: equivalence && units >= 1 ? { key: equivalence.key, units } : null,
  };
}

// ---------- donations page ----------

export type DonationsPage = {
  rows: { id: string; date: string; amountUsd: number; program: string; campaign: string | null; method: string; status: string; recurring: boolean }[];
  total: number;
  count: number;
  byProgram: { program: string; amountUsd: number }[];
};

export async function getDonationsPage(donorId: string): Promise<DonationsPage> {
  const today = await getToday();
  const { donations } = await loadRecs(donorId);
  const visible = donations.filter((d) => d.date <= today);
  const ok = visible.filter((d) => d.status === "succeeded");
  const byProgram = new Map<string, number>();
  for (const d of ok) byProgram.set(d.program, (byProgram.get(d.program) ?? 0) + d.amountUsd);
  return {
    rows: [...visible].reverse().map((d) => ({
      id: d.id, date: d.date, amountUsd: d.amountUsd, program: d.program, campaign: d.campaign,
      method: String(d.method), status: d.status, recurring: !!d.subscriptionId,
    })),
    total: Math.round(ok.reduce((s, d) => s + d.amountUsd, 0) * 100) / 100,
    count: ok.length,
    byProgram: [...byProgram].map(([program, amountUsd]) => ({ program, amountUsd })).sort((a, b) => b.amountUsd - a.amountUsd),
  };
}

// ---------- badges ----------

export type BadgeItem = {
  id: string;
  category: BadgeCategory;
  icon: string;
  tier: string | null;
  name: string;
  description: string;
  repeatable: boolean;
  manualOnly: boolean;
  /** Newest first. One entry per period for repeatable badges. */
  earned: { periodKey: string; awardedAt: string; name: string }[];
  /** Progress towards a locked badge (null if earned or it has no meter). */
  progress: BadgeProgress | null;
  rarityPct: number;
};

export type BadgeCatalog = {
  today: string;
  items: BadgeItem[];
  groups: { category: BadgeCategory; items: BadgeItem[] }[];
  earnedCount: number;
};

/** Facts about one donor as of today: the basis for progress meters. */
async function loadFacts(donorId: string, userId: string | null, today: string): Promise<DonorFacts> {
  const settings = toEngineSettings(await loadSettings(db));
  const { donations, subscriptions } = await loadRecs(donorId);
  const history: DonorHistory = { donorId, donations, subscriptions };

  const referred = await db.donor.findMany({ where: { referredBy: donorId }, select: { id: true } });
  const referralDates = referred.length
    ? (
        await db.donation.groupBy({
          by: ["donorId"],
          where: { donorId: { in: referred.map((r) => r.id) }, status: "succeeded", date: { lte: today } },
          _min: { date: true },
        })
      )
        .map((r) => r._min.date!)
        .sort()
    : [];

  const [claims, shares] = userId
    ? await Promise.all([
        db.socialClaim.findMany({ where: { userId, status: "approved" } }),
        db.shareEvent.findMany({ where: { userId } }),
      ])
    : [[], []];

  return computeFacts(
    {
      settings,
      events: [],
      claims: claims.map((c) => ({ donorId, network: c.network, reviewedAt: c.reviewedAt ?? today })),
      shares: shares.map((s) => ({ donorId, date: s.createdAt })),
    },
    history,
    today,
    { referralDates },
  );
}

export async function getBadgeCatalog(donorId: string, userId: string | null, locale: string): Promise<BadgeCatalog> {
  const today = await getToday();
  const settings = toEngineSettings(await loadSettings(db));
  const [defs, awards, facts, holders, totalDonors, campaignPosts] = await Promise.all([
    db.badgeDefinition.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.badgeAward.findMany({ where: { donorId } }),
    loadFacts(donorId, userId, today),
    db.badgeAward.findMany({ select: { donorId: true, badgeId: true }, distinct: ["donorId", "badgeId"] }),
    db.donor.count({ where: { firstDonationDate: { lte: today } } }),
    db.post.findMany({ where: { campaign: { not: null } }, select: { campaign: true, titleEs: true, titleEn: true } }),
  ]);
  const rarity = badgeRarity(holders, totalDonors);
  const campaignTitle = new Map(campaignPosts.map((p) => [p.campaign!, pick(locale, p.titleEs, p.titleEn)]));
  const awardsByBadge = new Map<string, typeof awards>();
  for (const a of awards) {
    if (!awardsByBadge.has(a.badgeId)) awardsByBadge.set(a.badgeId, []);
    awardsByBadge.get(a.badgeId)!.push(a);
  }

  const items: BadgeItem[] = defs.map((d) => {
    const base = pick(locale, d.nameEs, d.nameEn);
    const nameFor = (periodKey: string) =>
      base.replace("{year}", periodKey).replace("{campaign}", campaignTitle.get(periodKey) ?? periodKey);
    const mine = (awardsByBadge.get(d.id) ?? []).sort((a, b) => b.awardedAt.localeCompare(a.awardedAt));
    return {
      id: d.id,
      category: d.category as BadgeCategory,
      icon: d.icon,
      tier: d.tier,
      name: base.replace(" {year}", "").replace(": {campaign}", "").replace(" {campaign}", ""),
      description: pick(locale, d.descEs, d.descEn),
      repeatable: d.repeatable,
      manualOnly: d.manualOnly,
      earned: mine.map((a) => ({ periodKey: a.periodKey, awardedAt: a.awardedAt, name: nameFor(a.periodKey) })),
      progress: mine.length ? null : badgeProgress(d.rule as unknown as BadgeRule, facts, settings),
      rarityPct: rarity.get(d.id) ?? 0,
    };
  });

  return {
    today,
    items,
    groups: BADGE_CATEGORIES.map((category) => ({ category, items: items.filter((i) => i.category === category) })).filter(
      (g) => g.items.length > 0,
    ),
    earnedCount: items.filter((i) => i.earned.length > 0).length,
  };
}

// ---------- one earned badge (share page and share card) ----------

export type EarnedBadge = {
  id: string;
  icon: string;
  tier: string | null;
  name: string;
  description: string;
  awardedAt: string;
  periodKey: string;
};

/** A badge the donor has earned (the given period, or the latest one), or null if they have not. */
export async function getEarnedBadge(
  donorId: string,
  badgeId: string,
  periodKey: string | undefined,
  locale: string,
): Promise<EarnedBadge | null> {
  const def = await db.badgeDefinition.findUnique({ where: { id: badgeId } });
  if (!def) return null;
  const awards = await db.badgeAward.findMany({ where: { donorId, badgeId }, orderBy: { awardedAt: "desc" } });
  const award = periodKey === undefined ? awards[0] : awards.find((a) => a.periodKey === periodKey);
  if (!award) return null;

  let campaignTitle = award.periodKey;
  if (def.id === "B-P9") {
    const post = await db.post.findFirst({ where: { campaign: award.periodKey } });
    if (post) campaignTitle = pick(locale, post.titleEs, post.titleEn);
  }
  const name = pick(locale, def.nameEs, def.nameEn)
    .replace("{year}", award.periodKey)
    .replace("{campaign}", campaignTitle);
  return {
    id: def.id,
    icon: def.icon,
    tier: def.tier,
    name,
    description: pick(locale, def.descEs, def.descEn),
    awardedAt: award.awardedAt,
    periodKey: award.periodKey,
  };
}

// ---------- profile ----------

export type ClaimStatus = "none" | "pending" | "approved" | "rejected";

export type ProfileData = {
  username: string;
  alias: string | null;
  locale: string;
  optOut: boolean;
  referralCode: string | null;
  claims: Record<string, ClaimStatus>;
  referredDonors: number;
};

export async function getProfile(userId: string, donorId: string): Promise<ProfileData> {
  const today = await getToday();
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const claims = await db.socialClaim.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const latest: Record<string, ClaimStatus> = {};
  for (const c of claims) {
    // an approved claim always wins; otherwise the most recent one
    if (latest[c.network] === "approved") continue;
    if (!latest[c.network] || c.status === "approved") latest[c.network] = c.status as ClaimStatus;
  }

  const referred = await db.donor.findMany({ where: { referredBy: donorId }, select: { id: true } });
  const donated = referred.length
    ? await db.donation.groupBy({
        by: ["donorId"],
        where: { donorId: { in: referred.map((r) => r.id) }, status: "succeeded", date: { lte: today } },
      })
    : [];

  return {
    username: user.username,
    alias: user.alias,
    locale: user.locale,
    optOut: user.gamificationOptOut,
    referralCode: user.referralCode,
    claims: latest,
    referredDonors: donated.length,
  };
}

// ---------- matching gifts ----------

export type Company = { name: string; matches: boolean; platform: string | null };

/** The mock company list generated with the data (fictional companies). */
export async function loadCompanies(): Promise<Company[]> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    return JSON.parse(await readFile(join(process.cwd(), "data", "companies.json"), "utf8")) as Company[];
  } catch {
    return [];
  }
}
