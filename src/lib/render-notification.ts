// Turns a stored notification (type + params) into display text in the viewer's language.
// Pure: every lookup (badge names, posts, formatting, the translator) comes in through `RenderEnv`,
// so the same function serves the bell, the feed and the tests.

import type { NotificationType } from "./notification-types";

export const DONATE_URL = "https://alumnusb.org/dona";

export type Translator = (key: string, values?: Record<string, string | number>) => string;

export type PostView = {
  id: string;
  kind: string;
  title: string;
  body: string;
  campaign: string | null;
  goalAmount: number | null;
};

export type RenderEnv = {
  /** Translator for the "Notifications" namespace. */
  t: Translator;
  money(amount: number): string;
  /** Locale-formatted integer ("2,000" / "2.000"). */
  number(n: number): string;
  /** "2026-07" -> "July 2026" */
  monthLabel(ym: string): string;
  rankingName(ranking: string): string;
  badgeName(badgeId: string, periodKey: string): string;
  badgeIcon(badgeId: string): string;
  programName(program: string): string;
  networkName(network: string): string;
  tierName(tier: string): string;
  /** "≈ 2 months of a scholarship" */
  impact(key: string, units: number): string;
  post(id: string): PostView | undefined;
  campaignRaised(slug: string): number;
};

export type NotificationRow = {
  id: string;
  type: string;
  params: unknown;
  createdAt: string;
  readAt: string | null;
};

export type RenderedNotification = {
  id: string;
  type: NotificationType;
  /** Simulated ISO date. */
  date: string;
  read: boolean;
  icon: string;
  tone: "good" | "warn" | "info" | "neutral";
  text: string;
  detail?: string;
  cta?: { label: string; href: string; external?: boolean };
  progress?: { raised: number; goal: number; pct: number };
};

type P = Record<string, unknown>;
const str = (v: unknown) => String(v ?? "");
const num = (v: unknown) => Number(v ?? 0);

export function renderNotification(row: NotificationRow, env: RenderEnv): RenderedNotification {
  const p = (row.params ?? {}) as P;
  const { t } = env;
  const base = { id: row.id, type: row.type as NotificationType, date: row.createdAt, read: row.readAt !== null };
  const donate = { label: t("cta.donate"), href: DONATE_URL, external: true };
  const out = (
    icon: string,
    tone: RenderedNotification["tone"],
    text: string,
    extra: Partial<RenderedNotification> = {},
  ): RenderedNotification => ({ ...base, icon, tone, text, ...extra });

  const rankValues = () => ({
    ranking: env.rankingName(str(p.ranking)),
    from: env.number(num(p.from)),
    to: env.number(num(p.to)),
    total: env.number(num(p.total)),
  });
  const gapLine = () => {
    const gap = p.gap as { dollars: number; nextRank: number } | null | undefined;
    if (p.keepLead) return t("N4keepLead");
    return gap ? t("N4gap", { gap: env.money(gap.dollars), next: env.number(gap.nextRank) }) : undefined;
  };
  const tier = (value: unknown) => (value ? env.tierName(str(value)) : null);

  switch (row.type) {
    case "N1": {
      const badgeId = str(p.badgeId);
      return out(env.badgeIcon(badgeId), "good", t("N1", { badge: env.badgeName(badgeId, str(p.periodKey)) }), {
        cta: { label: t("cta.badges"), href: `/badges/${badgeId}` },
      });
    }
    case "N3": {
      const badgeId = str(p.badgeId);
      return out("🎯", "info", t("N3", { remaining: env.money(num(p.remainingUsd)), badge: env.badgeName(badgeId, "") }), { cta: donate });
    }
    case "N4":
      return out("⬆️", "good", t("N4", rankValues()), { detail: gapLine(), cta: p.keepLead ? undefined : donate });
    case "N5":
      return out("⬇️", "warn", t("N5", rankValues()), { detail: gapLine(), cta: donate });
    case "N6":
      return out("📈", "info", t("N6", {
        gap: env.money(num(p.gapDollars)), next: env.number(num(p.nextRank)), ranking: env.rankingName(str(p.ranking)),
      }), { cta: donate });
    case "N7":
      return out("🗓️", "neutral", t("N7", {
        month: env.monthLabel(str(p.month)), rank: env.number(num(p.rank)), total: env.number(num(p.total)), pct: num(p.topPercent),
      }));
    case "N8":
      return out("🎉", "neutral", t("N8", {
        year: str(p.year), rank: env.number(num(p.rank)), total: env.number(num(p.total)), pct: num(p.topPercent),
      }));
    case "N9":
      return out("🏆", "good", t("N9", { kind: str(p.badgeId) === "B-C1" ? "week" : "month" }), {
        detail: num(p.amountUsd) > 0 ? t("N9detail", { amount: env.money(num(p.amountUsd)) }) : undefined,
      });
    case "N10":
      return out("🚀", "good", t("N10", { month: env.monthLabel(str(p.month)), gained: num(p.gained) }));
    case "N11":
      return out("🆕", "info", t("N11"));
    case "N12": {
      const name = tier(p.tier);
      const streak = num(p.streak);
      return out("⚠️", "warn", name ? t("N12", { tier: name, streak }) : t("N12noTier", { streak }), {
        cta: { label: t("cta.updateCard"), href: DONATE_URL, external: true },
      });
    }
    case "N13":
      return out("⏳", "warn", t("N13", { daysLeft: num(p.daysLeft), streak: num(p.streak) }), {
        cta: { label: t("cta.updateCard"), href: DONATE_URL, external: true },
      });
    case "N14":
      return out("💤", "warn", t("N14"), { cta: { label: t("cta.reactivate"), href: DONATE_URL, external: true } });
    case "N15":
      return out("✅", "good", p.streakRestored ? t("N15restored") : t("N15new"));
    case "N16":
      return out("🔁", "good", t("N16", { tier: env.tierName(str(p.tier)) }));
    case "N17":
      return out("💡", "info", t("N17", { gap: env.money(num(p.gapUsd)), tier: env.tierName(str(p.nextTier)) }), { cta: donate });
    case "N18":
      return out("💛", "neutral", t("N18", { amount: env.money(num(p.amountUsd)), program: env.programName(str(p.program)) }));
    case "N19":
      return out("🌱", "info", t("N19", { equivalent: env.impact(str(p.key), num(p.units)) }));
    case "N20":
      return out("🎂", "good", t("N20", { years: num(p.years) }));
    case "N21":
      return out("🤗", "info", t("N21"), { cta: donate });
    case "N22":
      return out("✌️", "good", t("N22", { amount: env.money(num(p.amountUsd)) }), {
        detail: p.badgeUnlocked ? t("N22badge", { badge: env.badgeName("B-G1", str(p.year)) }) : undefined,
      });
    case "N23":
      return out("🏢", "info", t("N23"), { cta: { label: t("cta.learnHow"), href: "/matching" } });
    case "N24":
      return out("✅", "good", t("N24", { network: env.networkName(str(p.network)) }));
    case "N25":
      return out("❓", "warn", t("N25", { network: env.networkName(str(p.network)) }), {
        cta: { label: t("cta.profile"), href: "/profile" },
      });
    case "N26":
      return out("🧲", "good", t("N26"), {
        detail: p.badgeUnlocked ? t("N26badge", { badge: env.badgeName("B-SO9", "") }) : undefined,
      });
    case "N27": {
      const post = env.post(str(p.postId));
      return out("📰", "info", post?.title ?? "", { detail: post?.body });
    }
    case "N28": {
      const post = env.post(str(p.postId));
      return out("📣", "info", t("N28", { title: post?.title ?? "" }), {
        detail: post?.body,
        progress: campaignProgress(post, env),
        cta: donate,
      });
    }
    case "N29": {
      const post = env.post(str(p.postId));
      const progress = campaignProgress(post, env);
      const values = { title: post?.title ?? "", pct: num(p.pct), daysLeft: num(p.daysLeft) };
      return out("🎯", "info", p.kind === "ending" ? t("N29ending", values) : t("N29pct", values), { progress, cta: donate });
    }
    case "N30":
      return out("🎓", "good", t("N30", { amount: env.money(num(p.milestoneUsd)) }));
    case "N31":
      return out("👋", "info", t("N31"));
    default:
      return out("🔔", "neutral", row.type);
  }
}

function campaignProgress(post: PostView | undefined, env: RenderEnv): RenderedNotification["progress"] {
  if (!post?.campaign || !post.goalAmount) return undefined;
  const raised = env.campaignRaised(post.campaign);
  return { raised, goal: post.goalAmount, pct: Math.min(100, Math.round((raised / post.goalAmount) * 100)) };
}
