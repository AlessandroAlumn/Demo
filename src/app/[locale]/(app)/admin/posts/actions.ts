"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { getToday } from "@/lib/clock";
import { db } from "@/lib/db";
import { refreshToday } from "@/lib/pipeline";
import { validatePost } from "@/lib/post-edit";

export type PostFormState = { status: "idle" } | { status: "created" } | { status: "error"; errors: Record<string, string> };

/** Publishes a bilingual post or campaign. If it is dated today or earlier, donors are notified right away. */
export async function createPostAction(_prev: PostFormState, formData: FormData): Promise<PostFormState> {
  await assertAdmin();
  const raw: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") raw[key] = value;
  const today = await getToday();

  const result = validatePost(raw, today);
  if (!result.ok) return { status: "error", errors: result.errors };

  const p = result.post;
  if (p.campaign && (await db.post.findFirst({ where: { campaign: p.campaign } }))) {
    return { status: "error", errors: { campaign: "a campaign with this slug already exists" } };
  }
  await db.post.create({ data: { ...p } });
  await refreshToday(db);
  revalidatePath("/", "layout");
  return { status: "created" };
}

/** Deletes a post and the notifications that pointed at it. */
export async function deletePostAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("postId") ?? "");
  const notifications = await db.notification.findMany({ where: { type: { in: ["N27", "N28", "N29"] } }, select: { id: true, params: true } });
  const doomed = notifications.filter((n) => (n.params as { postId?: string } | null)?.postId === id).map((n) => n.id);
  await db.$transaction([
    db.notification.deleteMany({ where: { id: { in: doomed } } }),
    db.post.deleteMany({ where: { id } }),
  ]);
  revalidatePath("/", "layout");
}
