"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { reviewSocialClaim } from "@/lib/demo-actions";

/** Approves or rejects a pending follow claim: notification N24 / N25, the follow badge and +5 points. */
export async function reviewClaimAction(formData: FormData) {
  await assertAdmin();
  const decision = formData.get("decision") === "approve" ? "approved" : "rejected";
  await reviewSocialClaim(db, String(formData.get("claimId") ?? ""), decision);
  revalidatePath("/", "layout");
}
