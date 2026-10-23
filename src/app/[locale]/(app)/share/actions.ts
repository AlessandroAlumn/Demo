"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { recordShare } from "@/lib/demo-actions";
import { db } from "@/lib/db";
import { getEarnedBadge } from "@/lib/donor-queries";

/**
 * The user pressed a share button. Records it (Proud Supporter badge, +5 engagement points) only for a
 * badge they have really earned.
 */
export async function recordShareAction(badgeId: string, network: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "donor" || !user.donorId) return;
  if (!(await getEarnedBadge(user.donorId, badgeId, undefined, "en"))) return;
  await recordShare(db, user.id, badgeId, network);
  revalidatePath("/", "layout");
}
