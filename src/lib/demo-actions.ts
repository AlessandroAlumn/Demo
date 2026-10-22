// Actions that come from the UI (a login, a social-follow claim, a badge share) written once so the real
// screens, the backoffice and `npm run verify-coverage` all behave the same way. Each one stamps the
// event with the demo's simulated date and, unless told otherwise, re-runs today's pipeline step so the
// notification, badge and points appear immediately.

import type { PrismaClient } from "@prisma/client";
import { SHARE_NETWORKS, SOCIAL_NETWORKS, type ShareNetwork, type SocialNetwork } from "./constants";
import { getDemoState, refreshToday } from "./pipeline";

type Options = { refresh?: boolean };

const today = async (db: PrismaClient) => (await getDemoState(db)).today;

/** Records the first login (Welcome notification, Early Adopter badge). Returns true if it was the first. */
export async function recordFirstLogin(db: PrismaClient, userId: string, options: Options = {}): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "donor" || user.firstLoginAt) return false;
  await db.user.update({ where: { id: userId }, data: { firstLoginAt: await today(db) } });
  if (options.refresh !== false) await refreshToday(db);
  return true;
}

export type ClaimResult = { ok: true; claimId: string } | { ok: false; reason: "invalid_network" | "already_claimed" | "no_user" };

/** "I followed" button: creates a pending claim, unless one is pending or already approved for the network. */
export async function submitSocialClaim(db: PrismaClient, userId: string, network: string): Promise<ClaimResult> {
  if (!(SOCIAL_NETWORKS as readonly string[]).includes(network)) return { ok: false, reason: "invalid_network" };
  if (!(await db.user.findUnique({ where: { id: userId } }))) return { ok: false, reason: "no_user" };
  const open = await db.socialClaim.findFirst({
    where: { userId, network, status: { in: ["pending", "approved"] } },
  });
  if (open) return { ok: false, reason: "already_claimed" };
  const claim = await db.socialClaim.create({
    data: { userId, network: network as SocialNetwork, status: "pending", createdAt: await today(db) },
  });
  return { ok: true, claimId: claim.id };
}

/** Admin approves or rejects a pending claim (notification N24 / N25, the follow badge, +5 points). */
export async function reviewSocialClaim(
  db: PrismaClient,
  claimId: string,
  status: "approved" | "rejected",
  options: Options = {},
): Promise<boolean> {
  const claim = await db.socialClaim.findUnique({ where: { id: claimId } });
  if (!claim || claim.status !== "pending") return false;
  await db.socialClaim.update({ where: { id: claimId }, data: { status, reviewedAt: await today(db) } });
  if (options.refresh !== false) await refreshToday(db);
  return true;
}

/** The user pressed a share button on a badge (Proud Supporter badge, +5 engagement points). */
export async function recordShare(
  db: PrismaClient,
  userId: string,
  badgeId: string,
  network: string,
  options: Options = {},
): Promise<boolean> {
  if (!(SHARE_NETWORKS as readonly string[]).includes(network)) return false;
  if (!(await db.user.findUnique({ where: { id: userId } }))) return false;
  await db.shareEvent.create({
    data: { userId, badgeId, network: network as ShareNetwork, createdAt: await today(db) },
  });
  if (options.refresh !== false) await refreshToday(db);
  return true;
}
