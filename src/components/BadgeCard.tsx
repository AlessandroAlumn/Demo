import { Link } from "@/i18n/navigation";
import type { BadgeItem } from "@/lib/donor-queries";
import type { Formatters } from "@/lib/format";
import ProgressBar from "./ProgressBar";

export type BadgeLabels = {
  earned: (date: string) => string;
  times: (n: number) => string;
  locked: string;
  rarity: (pct: number) => string;
  manual: string;
  progress: (p: NonNullable<BadgeItem["progress"]>) => string;
};

const TIER_RING: Record<string, string> = {
  bronze: "ring-tier-bronze",
  silver: "ring-tier-silver",
  gold: "ring-tier-gold",
  platinum: "ring-tier-platinum",
  diamond: "ring-tier-diamond",
};

/** A badge in the catalog: earned (colour, date, count) or locked (grey, progress, rarity). */
export default function BadgeCard({ badge, labels, f }: { badge: BadgeItem; labels: BadgeLabels; f: Formatters }) {
  const earned = badge.earned.length > 0;
  return (
    <li>
      <Link
        href={`/badges/${badge.id}`}
        className={`flex h-full flex-col rounded-2xl border bg-brand-white p-4 shadow-sm transition hover:border-brand-yellow ${
          earned ? "border-gray-200" : "border-dashed border-gray-200"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-3xl ring-4 ${
              earned ? `bg-brand-yellow-soft ${TIER_RING[badge.tier ?? ""] ?? "ring-brand-yellow"}` : "bg-gray-100 ring-gray-100 grayscale"
            }`}
          >
            {badge.icon}
          </span>
          <div className="min-w-0">
            <h3 className={`font-accent text-sm font-semibold ${earned ? "text-brand-black" : "text-gray-400"}`}>{badge.name}</h3>
            <p className="mt-0.5 text-xs font-light text-gray-500">{badge.description}</p>
          </div>
        </div>

        <div className="mt-3 flex-1 space-y-2 text-xs">
          {earned ? (
            <p className="font-medium text-brand-black">
              {labels.earned(f.date(badge.earned[0].awardedAt))}
              {badge.earned.length > 1 && (
                <span className="ml-2 rounded-full bg-brand-yellow px-2 py-0.5 font-accent font-semibold">
                  {labels.times(badge.earned.length)}
                </span>
              )}
            </p>
          ) : badge.progress ? (
            <div>
              <ProgressBar value={badge.progress.current} max={badge.progress.target} label={labels.progress(badge.progress)} />
              <p className="mt-1 text-gray-500">{labels.progress(badge.progress)}</p>
            </div>
          ) : (
            <p className="text-gray-400">{badge.manualOnly ? labels.manual : labels.locked}</p>
          )}
        </div>

        {badge.rarityPct > 0 && <p className="mt-2 text-[11px] text-gray-400">{labels.rarity(badge.rarityPct)}</p>}
      </Link>
    </li>
  );
}
