// Badges the admin gives or takes back by hand (for example the Ambassador badge). Manual awards survive
// "Reset demo". A manual award also tells the donor (N1), which the daily pipeline would not do.

import type { PrismaClient } from "@prisma/client";
import { getDemoState } from "./pipeline";

export type AwardResult = { ok: true } | { ok: false; error: "unknown_badge" | "unknown_donor" | "already_awarded" };

export async function awardBadgeManually(
  db: PrismaClient,
  input: { donorId: string; badgeId: string; periodKey?: string },
): Promise<AwardResult> {
  const periodKey = input.periodKey?.trim() ?? "";
  const [badge, donor] = await Promise.all([
    db.badgeDefinition.findUnique({ where: { id: input.badgeId } }),
    db.donor.findUnique({ where: { id: input.donorId }, include: { user: true } }),
  ]);
  if (!badge) return { ok: false, error: "unknown_badge" };
  if (!donor) return { ok: false, error: "unknown_donor" };

  const existing = await db.badgeAward.findUnique({
    where: { donorId_badgeId_periodKey: { donorId: donor.id, badgeId: badge.id, periodKey } },
  });
  if (existing) return { ok: false, error: "already_awarded" };

  const { today } = await getDemoState(db); // the injected database, not the global one
  await db.badgeAward.create({
    data: { donorId: donor.id, badgeId: badge.id, awardedAt: today, periodKey, source: "manual" },
  });

  const user = donor.user;
  if (user && user.role === "donor" && !user.gamificationOptOut) {
    const dedupeKey = `N1:${donor.id}:${badge.id}:${periodKey}`;
    if (!(await db.notification.findUnique({ where: { dedupeKey } }))) {
      const last = await db.notification.aggregate({ _max: { seq: true } });
      await db.notification.create({
        data: {
          userId: user.id, type: "N1", params: { badgeId: badge.id, periodKey }, createdAt: today,
          seq: (last._max.seq ?? 0) + 1, dedupeKey,
        },
      });
    }
  }
  return { ok: true };
}

/** Removes a manual award. Automatic awards cannot be revoked: the engine would simply award them again. */
export async function revokeManualAward(db: PrismaClient, awardId: string): Promise<boolean> {
  const award = await db.badgeAward.findUnique({ where: { id: awardId } });
  if (!award || award.source !== "manual") return false;
  await db.badgeAward.delete({ where: { id: awardId } });
  return true;
}
