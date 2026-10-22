import { db } from "./db";
import { SETTING_DEFAULTS } from "./settings-defaults";

/**
 * The demo's "today" (ISO date). The app never reads the real clock for domain logic:
 * the admin moves this date with the time machine (step 8).
 */
export async function getToday(): Promise<string> {
  const row = await db.setting.findUnique({ where: { key: "simulatedToday" } });
  return typeof row?.value === "string" ? row.value : SETTING_DEFAULTS.simulatedToday;
}
