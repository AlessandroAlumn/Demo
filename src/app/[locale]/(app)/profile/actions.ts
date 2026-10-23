"use server";

import { revalidatePath } from "next/cache";
import { hasLocale } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { submitSocialClaim } from "@/lib/demo-actions";
import { normalizeAlias } from "@/lib/share";

/** Saves the preferred language, the alias and the gamification opt-out. */
export async function savePreferencesAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "donor") return;

  const language = String(formData.get("language") ?? "");
  const locale = hasLocale(routing.locales, language) ? language : user.locale;

  await db.user.update({
    where: { id: user.id },
    data: {
      locale,
      alias: normalizeAlias(String(formData.get("alias") ?? "")),
      gamificationOptOut: formData.get("optOut") === "on",
    },
  });
  revalidatePath("/", "layout");
  // Switching the preferred language moves the visitor to that language straight away.
  redirect({ href: "/profile?saved=1", locale });
}

/** "I followed" button: a pending claim that an admin confirms. */
export async function claimFollowAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "donor") return;
  await submitSocialClaim(db, user.id, String(formData.get("network") ?? ""));
  revalidatePath("/", "layout");
}
