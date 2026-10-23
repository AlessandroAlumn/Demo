"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBadgeForEdit } from "@/lib/admin-queries";
import { applyRuleFields } from "@/lib/rule-edit";

export type BadgeFormState = { status: "idle" } | { status: "saved" } | { status: "error"; errors: Record<string, string> };

/** Saves the texts, icon, active flag and thresholds of a badge. The rule's type never changes. */
export async function saveBadgeAction(_prev: BadgeFormState, formData: FormData): Promise<BadgeFormState> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const badge = await getBadgeForEdit(id);
  if (!badge) return { status: "error", errors: { id: "unknown badge" } };

  const text = (k: string) => String(formData.get(k) ?? "").trim();
  const errors: Record<string, string> = {};
  for (const field of ["nameEs", "nameEn", "descEs", "descEn", "icon"]) if (!text(field)) errors[field] = "required";
  if (text("icon").length > 8) errors.icon = "use a single emoji";

  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (key.startsWith("rule_")) values[key.slice(5)] = String(value);
  const rule = applyRuleFields(badge.rule, values);
  if (!rule.ok) errors.rule = rule.error;

  if (Object.keys(errors).length > 0 || !rule.ok) return { status: "error", errors };

  await db.badgeDefinition.update({
    where: { id },
    data: {
      nameEs: text("nameEs"), nameEn: text("nameEn"), descEs: text("descEs"), descEn: text("descEn"),
      icon: text("icon"), active: formData.get("active") === "on", rule: rule.rule as never,
    },
  });
  revalidatePath("/", "layout");
  return { status: "saved" };
}
