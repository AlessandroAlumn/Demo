import { getTranslations } from "next-intl/server";
import type { BadgeLabels } from "@/components/BadgeCard";
import type { Formatters } from "./format";

/** Translated labels for the badge cards and detail page (progress text depends on the unit). */
export async function badgeLabels(locale: string, f: Formatters): Promise<BadgeLabels> {
  const t = (await getTranslations({ locale, namespace: "Badges" })) as unknown as (
    key: string,
    values?: Record<string, string | number>,
  ) => string;
  return {
    earned: (date) => t("earned", { date }),
    times: (n) => t("earnedTimes", { n }),
    locked: t("locked"),
    rarity: (pct) => t("rarity", { pct }),
    manual: t("manual"),
    progress: (p) =>
      t(`progress.${p.unit}`, {
        current: p.unit === "usd" ? f.money(p.current) : f.number(p.current),
        target: p.unit === "usd" ? f.money(p.target) : p.target,
      }),
  };
}
