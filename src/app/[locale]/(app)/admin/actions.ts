"use server";

import { revalidatePath } from "next/cache";
import { addDays, addMonths } from "@/lib/dates";
import { assertAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_END_DATE, getDemoState, processUntil, resetDemo } from "@/lib/pipeline";

export type TimeState =
  | { status: "idle" }
  | { status: "ran"; from: string | null; to: string; days: number; awards: number; notifications: number }
  | { status: "error"; error: "invalidDate" | "notForward" | "beforeStart" | "atEnd" };

const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/**
 * The time machine. `op` is day | week | month | jump | reset. Time moves forward; a jump to an earlier day resets and replays;
 * the demo ends with the generated data (2026-12-31).
 */
export async function timeMachineAction(_prev: TimeState, formData: FormData): Promise<TimeState> {
  await assertAdmin();
  const op = String(formData.get("op") ?? "");
  const { today, launchDate } = await getDemoState(db);

  if (op === "reset") {
    const r = await resetDemo(db);
    revalidatePath("/", "layout");
    return { status: "ran", from: r.from, to: r.to, days: r.days, awards: r.awards, notifications: r.notifications };
  }

  if (today >= DEMO_END_DATE) return { status: "error", error: "atEnd" };

  let target: string;
  if (op === "day") target = addDays(today, 1);
  else if (op === "week") target = addDays(today, 7);
  else if (op === "month") target = addMonths(today, 1);
  else if (op === "jump") {
    target = String(formData.get("date") ?? "");
    if (!isIsoDate(target)) return { status: "error", error: "invalidDate" };
    if (target === today) return { status: "error", error: "notForward" };
    if (target < today) {
      // Going back means starting over and replaying up to that day (the pipeline only runs forward).
      if (target < launchDate) return { status: "error", error: "beforeStart" };
      const start = await resetDemo(db);
      const replay = target > start.to ? await processUntil(db, target) : start;
      revalidatePath("/", "layout");
      return { status: "ran", from: start.from, to: replay.to, days: replay.days, awards: replay.awards, notifications: replay.notifications };
    }
  } else return { status: "error", error: "invalidDate" };

  const r = await processUntil(db, target);
  revalidatePath("/", "layout");
  return { status: "ran", from: r.from, to: r.to, days: r.days, awards: r.awards, notifications: r.notifications };
}
