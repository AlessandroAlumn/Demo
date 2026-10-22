import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ProgressBar from "@/components/ProgressBar";
import { Link, redirectTo } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { badgeLabels } from "@/lib/badge-labels";
import { getBadgeCatalog } from "@/lib/donor-queries";
import { makeFormatters } from "@/lib/format";

export default async function BadgeDetailPage({ params }: PageProps<"/[locale]/badges/[badgeId]">) {
  const { locale, badgeId } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirectTo("/login", locale);
  if (user.role === "admin") redirectTo("/admin", locale);
  if (user.gamificationOptOut) redirectTo("/donations", locale);

  const [t, tCategories] = await Promise.all([getTranslations("Badges"), getTranslations("Categories")]);
  const f = makeFormatters(locale);
  const catalog = await getBadgeCatalog(user.donorId!, user.id, locale);
  const badge = catalog.items.find((b) => b.id === badgeId);
  if (!badge) notFound();
  const labels = await badgeLabels(locale, f);
  const earned = badge.earned.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href="/badges" className="font-accent text-sm font-semibold text-brand-blue hover:underline">
        ← {t("all")}
      </Link>

      <section className="rounded-2xl border border-gray-200 bg-brand-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-5xl ring-4 ${
              earned ? "bg-brand-yellow-soft ring-brand-yellow" : "bg-gray-100 ring-gray-100 grayscale"
            }`}
          >
            {badge.icon}
          </span>
          <div>
            <p className="font-accent text-xs font-semibold uppercase tracking-wide text-gray-400">
              {(tCategories as unknown as (k: string) => string)(badge.category)}
            </p>
            <h1 className="text-3xl text-brand-black">{badge.name}</h1>
            {badge.rarityPct > 0 && <p className="mt-1 text-sm text-gray-400">{labels.rarity(badge.rarityPct)}</p>}
          </div>
        </div>

        <h2 className="mt-6 text-lg text-brand-black">{t("howTo")}</h2>
        <p className="mt-1 font-light text-gray-600">{badge.description}</p>

        {earned ? (
          <>
            <h2 className="mt-6 text-lg text-brand-black">{t("history")}</h2>
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100">
              {badge.earned.map((e) => (
                <li key={e.periodKey} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="font-medium">{e.name}</span>
                  <span className="text-gray-400">{f.date(e.awardedAt)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="mt-6 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
              {badge.manualOnly ? labels.manual : t("notEarned")}
            </p>
            {badge.progress && (
              <div className="mt-4">
                <h2 className="text-lg text-brand-black">{t("yourProgress")}</h2>
                <div className="mt-2 max-w-md">
                  <ProgressBar value={badge.progress.current} max={badge.progress.target} label={labels.progress(badge.progress)} />
                  <p className="mt-1 text-sm text-gray-500">{labels.progress(badge.progress)}</p>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
