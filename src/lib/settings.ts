import type { Prisma, PrismaClient } from "@prisma/client";
import type { EngineSettings } from "./engine/types";
import { SETTING_DEFAULTS, type AppSettings, type SettingKey } from "./settings-defaults";

type Db = PrismaClient | Prisma.TransactionClient;

/** Settings from the database; any missing key falls back to its default. */
export async function loadSettings(db: Db): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const merged: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const row of rows) if (row.key in SETTING_DEFAULTS) merged[row.key] = row.value;
  return merged as AppSettings;
}

export async function saveSetting<K extends SettingKey>(db: Db, key: K, value: AppSettings[K]) {
  await db.setting.upsert({
    where: { key },
    update: { value: value as Prisma.InputJsonValue },
    create: { key, value: value as Prisma.InputJsonValue },
  });
}

/** The slice of the settings the engine needs. */
export const toEngineSettings = (s: AppSettings): EngineSettings => ({
  points: s.points,
  recurringTiers: s.recurringTiers,
  graceDays: s.graceDays,
  failureWindowDaysMonthly: s.failureWindowDaysMonthly,
  failureWindowDaysAnnual: s.failureWindowDaysAnnual,
});
