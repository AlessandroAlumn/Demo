import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import AwardForm from "@/components/admin/AwardForm";
import { Link } from "@/i18n/navigation";
import { getDonorDetail } from "@/lib/admin-queries";
import { makeFormatters } from "@/lib/format";
import { revokeBadgeAction } from "../actions";

export default async function DonorDetailPage({ params }: PageProps<"/[locale]/admin/donors/[donorId]">) {
  const { locale, donorId } = await params;
  setRequestLocale(locale);
  const [t, tPrograms, tMethods, tTiers, tStatus, tDonations] = await Promise.all([
    getTranslations("Admin.donors"),
    getTranslations("Programs"),
    getTranslations("Methods"),
    getTranslations("Tiers"),
    getTranslations("Admin.subStatus"),
    getTranslations("Donations.status"),
  ]);
  const f = makeFormatters(locale);
  const detail = await getDonorDetail(donorId, locale);
  if (!detail) notFound();
  const { donor, user, totals, summary } = detail;
  const q = (tr: unknown) => tr as (key: string) => string;
  const card = "rounded-2xl border border-gray-200 bg-brand-white p-5 shadow-sm";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <Link href="/admin/donors" className="font-accent text-sm font-semibold text-brand-blue hover:underline">
        ← {t("back")}
      </Link>
      <header>
        <h1 className="text-3xl text-brand-black md:text-4xl">{donor.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          <span className="font-mono">{donor.id}</span> · {donor.email}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-brand-yellow p-5 shadow-sm">
          <p className="font-accent text-xs font-semibold uppercase tracking-wide opacity-70">{t("lifetime")}</p>
          <p className="mt-1 font-serif text-3xl font-bold">{f.money(totals.lifetime)}</p>
          <p className="text-sm">{t("donationsCount", { n: totals.count })}</p>
        </div>
        <div className={card}>
          <p className="font-accent text-xs font-semibold uppercase tracking-wide text-gray-400">{t("thisYear")}</p>
          <p className="mt-1 font-serif text-3xl font-bold">{f.money(totals.thisYear)}</p>
        </div>
        <div className={card}>
          <p className="font-accent text-xs font-semibold uppercase tracking-wide text-gray-400">{t("positions")}</p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {(["monthly", "yearly", "alltime"] as const).map((r) => {
              const rank = detail.ranks[r];
              return (
                <li key={r}>
                  <span className="text-gray-400">{r === "monthly" ? "M" : r === "yearly" ? "Y" : "∞"} </span>
                  {rank ? t("rankLine", { rank: f.number(rank.rank), total: f.number(rank.total), points: rank.points, pct: rank.topPercent }) : <span className="text-gray-400">{t("notRanked")}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h2 className="text-xl text-brand-black">{t("account")}</h2>
          {user ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-gray-400">{t("username")}</dt>
              <dd className="font-medium">{user.username}</dd>
              <dt className="text-gray-400">{t("alias")}</dt>
              <dd>{user.alias ?? "—"}</dd>
              <dt className="text-gray-400">{t("optOut")}</dt>
              <dd>{user.optOut ? "✓" : "—"}</dd>
              <dt className="text-gray-400">{t("firstLogin")}</dt>
              <dd>{user.firstLoginAt ? f.date(user.firstLoginAt) : "—"}</dd>
              {donor.referredBy && (
                <>
                  <dt className="text-gray-400">{t("referredBy")}</dt>
                  <dd>
                    <Link href={`/admin/donors/${donor.referredBy}`} className="text-brand-blue hover:underline">
                      {donor.referredByName ?? donor.referredBy}
                    </Link>
                  </dd>
                </>
              )}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-gray-500">{t("noUser")}</p>
          )}
        </section>

        <section className={card}>
          <h2 className="text-xl text-brand-black">{t("subs")}</h2>
          {detail.subscriptions.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">—</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {detail.subscriptions.map((s) => (
                <li key={s.id} className="rounded-xl border border-gray-100 p-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{f.money(s.amountUsd)}</span>
                    <span className="text-gray-400">{t(`frequency.${s.frequency === "annual" ? "annual" : "monthly"}`)}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-accent text-xs font-semibold ${
                        s.status === "active" ? "bg-green-100 text-green-800" : s.status === "grace" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {q(tStatus)(s.status)}
                    </span>
                    {s.status === "grace" && s.graceDaysLeft !== null && <span className="text-xs text-red-700">{t("graceLeft", { n: s.graceDaysLeft })}</span>}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {f.date(s.startDate)} → {s.endDate ? f.date(s.endDate) : "…"} · {s.id}
                  </p>
                </li>
              ))}
              {summary.tier && (
                <li className="text-xs text-gray-500">
                  {t("streakTier", { streak: summary.streak, tier: q(tTiers)(summary.tier) })}
                </li>
              )}
            </ul>
          )}
        </section>
      </div>

      <section className={card}>
        <h2 className="text-xl text-brand-black">{t("badges")}</h2>
        {detail.badges.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">{t("noBadges")}</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {detail.badges.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 px-3 py-2 text-sm">
                <span>
                  <span aria-hidden className="mr-1.5 text-lg">
                    {b.icon}
                  </span>
                  <span className="font-medium">{b.name}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {f.date(b.awardedAt)} · {b.source === "manual" ? t("sourceManual") : t("sourceAuto")}
                  </span>
                </span>
                {b.source === "manual" && (
                  <form action={revokeBadgeAction}>
                    <input type="hidden" name="awardId" value={b.id} />
                    <button type="submit" className="text-xs font-semibold text-red-700 hover:underline">
                      {t("revoke")}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-gray-400">{t("revokeNote")}</p>

        <h3 className="mt-6 font-accent text-sm font-semibold uppercase tracking-wide text-gray-400">{t("award")}</h3>
        <div className="mt-2">
          <AwardForm donorId={donor.id} badges={detail.badgeOptions} />
        </div>
      </section>

      <section>
        <h2 className="text-2xl text-brand-black">{t("history")}</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-200 bg-brand-white shadow-sm">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 font-accent text-xs uppercase tracking-wide text-gray-400">
              <tr>
                {(["date", "amount", "program", "method", "status"] as const).map((c) => (
                  <th key={c} scope="col" className={`px-4 py-3 ${c === "amount" ? "text-right" : ""}`}>
                    {t(`historyColumns.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {detail.donations.map((d) => (
                <tr key={d.id} className={d.status === "failed" ? "text-gray-400" : ""}>
                  <td className="whitespace-nowrap px-4 py-2">{f.date(d.date)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${d.status === "failed" ? "line-through" : ""}`}>{f.money(d.amountUsd)}</td>
                  <td className="px-4 py-2">{q(tPrograms)(d.program)}</td>
                  <td className="px-4 py-2">{q(tMethods)(String(d.method))}</td>
                  <td className="px-4 py-2">{q(tDonations)(d.status === "failed" ? "failed" : "succeeded")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {detail.donationCount > detail.donations.length && (
          <p className="mt-2 text-xs text-gray-400">{t("showingLast", { shown: detail.donations.length, total: detail.donationCount })}</p>
        )}
      </section>
    </div>
  );
}
