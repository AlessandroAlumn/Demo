import { getTranslations, setRequestLocale } from "next-intl/server";
import { titleFor } from "@/lib/page-title";
import NotificationItem from "@/components/NotificationItem";
import { Link, redirectTo } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBadgeCatalog, getOverview, type RankView } from "@/lib/donor-queries";
import { loadNotifications } from "@/lib/feed";
import { makeFormatters } from "@/lib/format";
import { DONATE_URL } from "@/lib/render-notification";

const RANKINGS = ["monthly", "yearly", "alltime"] as const;

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) =>
  titleFor(params, "Header", "dashboard");

export default async function DashboardPage({ params }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirectTo("/login", locale);
  if (user.role === "admin") redirectTo("/admin", locale);
  if (user.gamificationOptOut) redirectTo("/donations", locale);

  const [t, tr, tTiers, tImpact, tRankTitles, tRankNames, f, tCommon] = await Promise.all([
    getTranslations("Dashboard"),
    getTranslations("Dashboard.ranks"),
    getTranslations("Tiers"),
    getTranslations("Impact"),
    getTranslations("RankingTitles"),
    getTranslations("Rankings"),
    Promise.resolve(makeFormatters(locale)),
    getTranslations("Common"),
  ]);
  const donorId = user.donorId!;
  const [overview, catalog, activity] = await Promise.all([
    getOverview(donorId),
    getBadgeCatalog(donorId, user.id, locale),
    loadNotifications(user.id, locale, { channel: "feed", limit: 5 }),
  ]);
  void tRankNames;

  const { totals, recurring, ranks } = overview;
  const recent = catalog.items
    .flatMap((b) => b.earned.map((e) => ({ badge: b, ...e })))
    .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt) || a.badge.id.localeCompare(b.badge.id))
    .slice(0, 6);

  const statusChip = {
    active: "bg-green-100 text-green-800",
    grace: "bg-red-100 text-red-800",
    inactive: "bg-gray-100 text-gray-500",
    none: "",
  }[recurring.overall];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      {/* payment problem banner */}
      {(recurring.overall === "grace" || recurring.overall === "inactive") && (
        <div
          role="alert"
          className={`flex flex-col items-start gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
            recurring.overall === "grace" ? "border-red-200 bg-red-50 text-red-900" : "border-gray-200 bg-gray-100 text-gray-700"
          }`}
        >
          <p className="flex-1 text-sm font-medium">
            {recurring.overall === "grace"
              ? recurring.tier
                ? t("banner.grace", { tier: tTiers(recurring.tier), streak: recurring.streak, days: recurring.graceDaysLeft ?? 0 })
                : t("banner.graceNoTier", { streak: recurring.streak, days: recurring.graceDaysLeft ?? 0 })
              : t("banner.inactive")}
          </p>
          <a
            href={DONATE_URL}
            className="rounded-lg bg-brand-black px-4 py-2 font-accent text-sm font-semibold text-brand-white hover:bg-gray-500"
          >
            {recurring.overall === "grace" ? t("banner.fix") : t("banner.reactivate")}
          </a>
        </div>
      )}

      <header>
        <h1 className="text-3xl text-brand-black md:text-4xl">{t("welcome", { name: user.alias ?? user.username })}</h1>
        <p className="mt-1 font-light text-gray-500">{t("subtitle")}</p>
      </header>

      {/* totals */}
      <section className="grid gap-4 sm:grid-cols-3" aria-label={t("totals.lifetime")}>
        {(
          [
            ["lifetime", totals.lifetime],
            ["thisYear", totals.thisYear],
            ["thisMonth", totals.thisMonth],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-gray-200 bg-brand-white p-5 shadow-sm">
            <p className="font-accent text-xs font-semibold uppercase tracking-wide text-gray-400">{t(`totals.${key}`)}</p>
            <p className="mt-1 font-serif text-3xl font-bold text-brand-black">{f.money(value)}</p>
            {key === "lifetime" && totals.matched > 0 && (
              <p className="mt-1 text-xs text-gray-400">{t("totals.matched", { amount: f.money(totals.matched) })}</p>
            )}
          </div>
        ))}
      </section>

      {/* private rankings */}
      <section>
        <h2 className="text-2xl text-brand-black">{tr("title")}</h2>
        <p className="mt-1 text-sm font-light text-gray-500">{tr("privacy")}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {RANKINGS.map((ranking) => {
            const view: RankView | null = ranks[ranking];
            const highlight = ranking === "monthly";
            return (
              <div
                key={ranking}
                className={`rounded-2xl p-5 shadow-sm ${
                  highlight ? "bg-brand-yellow text-brand-black" : "border border-gray-200 bg-brand-white"
                }`}
              >
                <p className="font-accent text-xs font-semibold uppercase tracking-wide opacity-70">{tRankTitles(ranking)}</p>
                {view ? (
                  <>
                    <p className="mt-2 font-serif text-4xl font-bold">
                      #{f.number(view.rank)}{" "}
                      <span className="text-base font-normal opacity-70">{tr("of", { total: f.number(view.total) })}</span>
                    </p>
                    <p className="mt-1 inline-block rounded-full bg-black/10 px-2.5 py-0.5 font-accent text-xs font-semibold">
                      {tr("top", { pct: view.topPercent })}
                    </p>
                    {view.change !== 0 && (
                      <p className={`mt-2 text-sm font-medium ${view.change > 0 ? "text-green-800" : "text-red-700"}`}>
                        {view.change > 0 ? "▲ " : "▼ "}
                        {view.change > 0 ? tr("up", { n: view.change }) : tr("down", { n: -view.change })}
                      </p>
                    )}
                    <p className="mt-2 text-sm">
                      {view.rank === 1 || view.gapDollars === null
                        ? tr("keepLead")
                        : tr("gap", { gap: f.money(view.gapDollars), next: f.number(view.rank - 1) })}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm opacity-80">{tr(`notRanked.${ranking}`)}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* recurring status */}
        <section className="rounded-2xl border border-gray-200 bg-brand-white p-5 shadow-sm">
          <h2 className="text-xl text-brand-black">{t("recurring.title")}</h2>
          {recurring.overall === "none" ? (
            <>
              <p className="mt-2 text-sm font-light text-gray-500">{t("recurring.none")}</p>
              <a href={DONATE_URL} className="mt-3 inline-block font-accent text-sm font-semibold text-brand-blue hover:underline">
                {t("recurring.start")} →
              </a>
            </>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 font-accent text-xs font-semibold ${statusChip}`}>
                  {t(`recurring.status.${recurring.overall}`)}
                </span>
                {recurring.tier && (
                  <span className="rounded-full bg-brand-yellow px-2.5 py-0.5 font-accent text-xs font-semibold text-brand-black">
                    {tTiers(recurring.tier)}
                  </span>
                )}
              </div>
              {recurring.monthlyAmount > 0 && (
                <p className="font-serif text-2xl font-bold">{t("recurring.perMonth", { amount: f.money(recurring.monthlyAmount) })}</p>
              )}
              <p className="text-sm text-gray-500">
                {t("recurring.streak", { n: recurring.streak })}
                {recurring.overall === "grace" && recurring.graceDaysLeft !== null && (
                  <span className="ml-2 font-medium text-red-700">· {t("recurring.graceLeft", { n: recurring.graceDaysLeft })}</span>
                )}
              </p>
              {recurring.overall === "active" && (
                <p className="text-sm text-brand-blue">
                  {recurring.next
                    ? t("recurring.nextTier", { gap: f.money(recurring.next.gap), tier: tTiers(recurring.next.tier) })
                    : t("recurring.topTier")}
                </p>
              )}
            </div>
          )}
        </section>

        {/* impact */}
        <section className="rounded-2xl border border-gray-200 bg-brand-white p-5 shadow-sm">
          <h2 className="text-xl text-brand-black">{t("impact.title")}</h2>
          {overview.impact ? (
            <>
              <p className="mt-3 font-serif text-xl font-bold text-brand-black">
                {t("impact.text", {
                  equivalent: (tImpact as unknown as (k: string, v: Record<string, number>) => string)(overview.impact.key, {
                    units: overview.impact.units,
                  }),
                })}
              </p>
              <p className="mt-2 text-xs text-gray-400">{t("impact.placeholder")}</p>
            </>
          ) : (
            <p className="mt-3 text-sm font-light text-gray-500">{t("impact.placeholder")}</p>
          )}
        </section>
      </div>

      {/* recent badges */}
      <section>
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl text-brand-black">{t("badges.title")}</h2>
            <p className="text-sm text-gray-400">{t("badges.count", { earned: catalog.earnedCount, total: catalog.items.length })}</p>
          </div>
          <Link href="/badges" className="font-accent text-sm font-semibold text-brand-blue hover:underline">
            {t("badges.seeAll")} →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm font-light text-gray-500">{t("badges.empty")}</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {recent.map((r) => (
              <li key={`${r.badge.id}-${r.periodKey}`}>
                <Link
                  href={`/badges/${r.badge.id}`}
                  className="block h-full rounded-xl border border-gray-200 bg-brand-white p-3 text-center shadow-sm hover:border-brand-yellow"
                >
                  <span aria-hidden className="text-3xl">
                    {r.badge.icon}
                  </span>
                  <span className="mt-1 block font-accent text-xs font-semibold text-brand-black">{r.name}</span>
                  <span className="mt-0.5 block text-[11px] text-gray-400">{f.date(r.awardedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* latest activity */}
      <section>
        <div className="flex items-end justify-between">
          <h2 className="text-2xl text-brand-black">{t("activity.title")}</h2>
          <Link href="/feed" className="font-accent text-sm font-semibold text-brand-blue hover:underline">
            {t("activity.seeAll")} →
          </Link>
        </div>
        {activity.length === 0 ? (
          <p className="mt-3 text-sm font-light text-gray-500">{t("activity.empty")}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {activity.map((item) => (
              <NotificationItem
                key={item.id}
                item={item}
                dateLabel={f.date(item.date)}
                unreadLabel={tCommon("unread")}
                progressLabel={
                  item.progress ? `${f.money(item.progress.raised)} / ${f.money(item.progress.goal)}` : undefined
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
