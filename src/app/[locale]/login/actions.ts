"use server";

import { hasLocale } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { createSession, destroySession } from "@/lib/auth";
import { getToday } from "@/lib/clock";
import { db } from "@/lib/db";
import { normalizeUsername } from "@/lib/session";

export type LoginState = { error?: "empty" | "unknownUser"; username?: string };

const localeFrom = (formData: FormData) => {
  const value = String(formData.get("locale") ?? "");
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
};

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const locale = localeFrom(formData);
  const typed = String(formData.get("username") ?? "");
  // The password field is a placeholder in the prototype: it is read by nobody.

  if (typed.trim() === "") return { error: "empty", username: typed };

  const wanted = normalizeUsername(typed);
  const users = await db.user.findMany();
  const user = users.find((u) => normalizeUsername(u.username) === wanted);
  if (!user) return { error: "unknownUser", username: typed };

  if (!user.firstLoginAt) {
    // Recorded now; the welcome notification and Early Adopter badge are derived from it (step 8).
    await db.user.update({ where: { id: user.id }, data: { firstLoginAt: await getToday() } });
  }
  await createSession(user);

  redirect({ href: user.role === "admin" ? "/admin" : "/dashboard", locale });
  return {};
}

export async function logoutAction(formData: FormData) {
  await destroySession();
  redirect({ href: "/login", locale: localeFrom(formData) });
}
