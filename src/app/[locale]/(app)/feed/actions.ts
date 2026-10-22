"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getToday } from "@/lib/clock";
import { db } from "@/lib/db";

/** Marks one of the signed-in user's notifications as read (stamped with the simulated date). */
export async function markReadAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") ?? "");
  await db.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: await getToday() },
  });
  revalidatePath("/", "layout");
}

export async function markAllReadAction() {
  const user = await getCurrentUser();
  if (!user) return;
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: await getToday() },
  });
  revalidatePath("/", "layout");
}
