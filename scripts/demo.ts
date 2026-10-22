// Time machine from the command line.
//
//   npm run demo -- status
//   npm run demo -- reset                      wipe derived data, back to the launch date (baseline run)
//   npm run demo -- advance --days 7
//   npm run demo -- advance --months 1
//   npm run demo -- advance --to 2026-09-30

import { PrismaClient } from "@prisma/client";
import { DEMO_END_DATE, advanceDays, advanceMonths, getDemoState, processUntil, resetDemo } from "../src/lib/pipeline";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const db = new PrismaClient();
  try {
    const command = process.argv[2] ?? "status";
    const started = Date.now();
    let result;
    if (command === "reset") result = await resetDemo(db);
    else if (command === "advance") {
      if (arg("to")) result = await processUntil(db, arg("to")!);
      else if (arg("months")) result = await advanceMonths(db, Number(arg("months")));
      else result = await advanceDays(db, Number(arg("days") ?? 1));
    } else if (command !== "status") throw new Error(`Unknown command "${command}"`);

    if (result) {
      console.log(
        result.days === 0
          ? "Nothing to process (already at or past that date)."
          : `Processed ${result.days} day(s) ${result.from} → ${result.to}: ${result.awards} badge awards, ${result.notifications} notifications (${((Date.now() - started) / 1000).toFixed(1)}s)`,
      );
    }
    const state = await getDemoState(db);
    const [awards, notifications] = await Promise.all([db.badgeAward.count(), db.notification.count()]);
    console.log(`Demo date ${state.today} (demo ends ${DEMO_END_DATE}) | awards ${awards} | notifications ${notifications}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
