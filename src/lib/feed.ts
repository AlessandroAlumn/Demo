// Loads a user's notifications and renders them in the viewer's language (bell dropdown and feed page).

import { getTranslations } from "next-intl/server";
import { db } from "./db";
import { makeFormatters } from "./format";
import { NOTIFICATION_META, type NotificationType, STORED_TYPES } from "./notification-types";
import {
  renderNotification,
  type PostView,
  type RenderEnv,
  type RenderedNotification,
  type Translator,
} from "./render-notification";

export type Locale = "es" | "en";
const pick = (locale: string, es: string, en: string) => (locale === "es" ? es : en);

const typesWhere = (flag: "feed" | "bell") =>
  STORED_TYPES.filter((t) => NOTIFICATION_META[t][flag]) as NotificationType[];

/** Badge names/icons and the lookups the renderer needs, for one locale. */
export async function buildRenderEnv(locale: string, postIds: string[], campaigns: string[]): Promise<RenderEnv> {
  const [t, tiers, programs, networks, rankings, impact, defs, posts, raisedRows] = await Promise.all([
    getTranslations({ locale, namespace: "Notifications" }),
    getTranslations({ locale, namespace: "Tiers" }),
    getTranslations({ locale, namespace: "Programs" }),
    getTranslations({ locale, namespace: "Networks" }),
    getTranslations({ locale, namespace: "Rankings" }),
    getTranslations({ locale, namespace: "Impact" }),
    db.badgeDefinition.findMany(),
    postIds.length ? db.post.findMany({ where: { id: { in: postIds } } }) : Promise.resolve([]),
    campaigns.length
      ? db.donation.groupBy({
          by: ["campaign"],
          where: { campaign: { in: campaigns }, status: "succeeded" },
          _sum: { amountUsd: true },
        })
      : Promise.resolve([]),
  ]);
  const f = makeFormatters(locale);
  const defMap = new Map(defs.map((d) => [d.id, d]));
  const postMap = new Map<string, PostView>(
    posts.map((p) => [
      p.id,
      {
        id: p.id, kind: p.kind, campaign: p.campaign, goalAmount: p.goalAmount,
        title: pick(locale, p.titleEs, p.titleEn), body: pick(locale, p.bodyEs, p.bodyEn),
      },
    ]),
  );
  const raised = new Map(raisedRows.map((r) => [r.campaign!, r._sum.amountUsd ?? 0]));

  return {
    t: t as unknown as Translator,
    money: f.money,
    number: f.number,
    monthLabel: f.month,
    rankingName: (r) => rankings(r as never),
    badgeName: (id, periodKey) => {
      const def = defMap.get(id);
      if (!def) return id;
      return pick(locale, def.nameEs, def.nameEn)
        .replace("{year}", periodKey)
        .replace("{campaign}", periodKey);
    },
    badgeIcon: (id) => defMap.get(id)?.icon ?? "🏅",
    programName: (p) => programs(p as never),
    networkName: (n) => networks(n as never),
    tierName: (tier) => tiers(tier as never),
    impact: (key, units) => (impact as unknown as (k: string, v: Record<string, number>) => string)(key, { units }),
    post: (id) => postMap.get(id),
    campaignRaised: (slug) => raised.get(slug) ?? 0,
  };
}

export async function loadNotifications(
  userId: string,
  locale: string,
  options: { channel: "feed" | "bell"; limit?: number },
): Promise<RenderedNotification[]> {
  const rows = await db.notification.findMany({
    where: { userId, type: { in: typesWhere(options.channel) } },
    orderBy: [{ createdAt: "desc" }, { seq: "desc" }],
    take: options.limit,
  });

  const postIds = new Set<string>();
  for (const r of rows) {
    const id = (r.params as { postId?: string } | null)?.postId;
    if (id) postIds.add(id);
  }
  // campaigns referenced by those posts (for the progress bars)
  const posts = postIds.size ? await db.post.findMany({ where: { id: { in: [...postIds] } }, select: { campaign: true } }) : [];
  const campaigns = [...new Set(posts.map((p) => p.campaign).filter((c): c is string => !!c))];

  const env = await buildRenderEnv(locale, [...postIds], campaigns);
  return rows.map((r) => renderNotification(r, env));
}

/** Unread notifications that count for the bell. */
export async function countUnread(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null, type: { in: typesWhere("bell") } } });
}
