"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { awardBadgeManually, revokeManualAward } from "@/lib/manual-awards";

export type AwardState = { status: "idle" } | { status: "ok" } | { status: "error"; error: "unknown_badge" | "unknown_donor" | "already_awarded" };

/** Gives a badge by hand (the donor is told with an N1 notification). */
export async function awardBadgeAction(_prev: AwardState, formData: FormData): Promise<AwardState> {
  await assertAdmin();
  const result = await awardBadgeManually(db, {
    donorId: String(formData.get("donorId") ?? ""),
    badgeId: String(formData.get("badgeId") ?? ""),
    periodKey: String(formData.get("periodKey") ?? ""),
  });
  revalidatePath("/", "layout");
  return result.ok ? { status: "ok" } : { status: "error", error: result.error };
}

export async function revokeBadgeAction(formData: FormData) {
  await assertAdmin();
  await revokeManualAward(db, String(formData.get("awardId") ?? ""));
  revalidatePath("/", "layout");
}
