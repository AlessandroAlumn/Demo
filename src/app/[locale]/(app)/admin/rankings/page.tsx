import { getTranslations, setRequestLocale } from "next-intl/server";
import { titleFor } from "@/lib/page-title";
import { Link } from "@/i18n/navigation";
import { getRankingsPage } from "@/lib/admin-queries";
import type { Ranking } from "@/lib/constants";
import { makeFormatters } from "@/lib/format";

const RANKINGS: Ranking[] = ["monthly", "yearly", "alltime"];
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) =>
  titleFor(params, "Admin.nav", "rankings");

export default async function RankingsPage({ params, searchParams }: PageProps<"/[locale]/admin/rankings">) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const ranking = (RANKINGS as string[]).includes(first(sp.ranking) ?? "") ? (first(sp.ranking) as Ranking) : "monthly";
  const sort = first(sp.sort) === "dollars" ? "dollars" : "points";
  const limit = first(sp.limit) === "200" ? 200 : 50;

  const [t, tCommon] = await Promise.all([getTranslations("Admin.rankings"), getTranslations("Common")]);
  const f = makeFormatters(locale);
  const data = await getRankingsPage({ ranking, period: first(sp.period), sort, limit });
  const periodOptions = ranking === "monthly" ? data.months : ranking === "yearly" ? data.years : [];
  const href = (over: Record<string, string>) => {
    const qs = new URLSearchParams({ ranking, sort, ...(first(sp.period) ? { period: first(sp.period)! } : {}), ...over });
    return `/admin/rankings?${qs.toString()}`;
  };
  const tab = (active: boolean) =>
    `rounded-full px-4 py-1.5 font-accent text-sm font-semibold ${active ? "bg-brand-black text-brand-white" : "border border-gray-200 bg-brand-white text-gray-500 hover:text-brand-black"}`;
  const kindName = (kind: "week" | "month") => t(`kinds.${kind}`);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
        <p className="mt-1 font-light text-gray-500">{t("subtitle")}</p>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {RANKINGS.map((r) => (
            <Link key={r} href={`/admin/rankings?ranking=${r}&sort=${sort}`} className={tab(r === ranking)}>
              {t(`tabs.${r}`)}
            </Link>
          ))}
        </div>

        <form className="flex flex-wrap items-end gap-3" aria-label={t("title")}>
          <input type="hidden" name="ranking" value={ranking} />
          {periodOptions.length > 0 && (
            <div>
              <label htmlFor="period" className="block font-accent text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t("period")}
              </label>
              <select id="period" name="period" defaultValue={data.period.key} className="mt-1 rounded-lg border border-gray-200 bg-brand-white px-3 py-2 text-sm">
                {periodOptions.map((p) => (
                  <option key={p} value={p}>
                    {ranking === "monthly" ? f.month(p) : p}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="sort" className="block font-accent text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t("sort")}
            </label>
            <select id="sort" name="sort" defaultValue={sort} className="mt-1 rounded-lg border border-gray-200 bg-brand-white px-3 py-2 text-sm">
              <option value="points">{t("byPoints")}</option>
              <option value="dollars">{t("byDollars")}</option>
            </select>
          </div>
          <button type="submit" className="rounded-lg bg-brand-yellow px-4 py-2 font-accent text-sm font-semibold text-brand-black hover:brightness-95">
            {tCommon("apply")}
          </button>
        </form>

        {data.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-brand-white p-8 text-center text-sm text-gray-500">{t("empty")}</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-brand-white shadow-sm">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 font-accent text-xs uppercase tracking-wide text-gray-400">
                  <tr>
                    <th scope="col" className="px-4 py-3">{t("columns.rank")}</th>
                    <th scope="col" className="px-4 py-3">{t("columns.donor")}</th>
                    <th scope="col" className="px-4 py-3 text-right">{t("columns.points")}</th>
                    <th scope="col" className="px-4 py-3 text-right">{t("columns.dollars")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.rows.map((r) => (
                    <tr key={r.donorId}>
                      <td className="px-4 py-2.5 font-serif text-lg font-bold">{f.number(r.rank)}</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/donors/${r.donorId}`} className="font-medium text-brand-blue hover:underline">
                          {r.name}
                        </Link>
                        {r.username && <span className="ml-2 rounded-full bg-brand-yellow px-2 py-0.5 font-accent text-[11px] font-semibold">{r.username}</span>}
                        <span className="block text-xs text-gray-400">{r.email}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{f.number(r.points)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{f.money(r.dollars)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400">
              {t("showing", { shown: data.rows.length, total: data.total })}
              {limit === 50 && data.total > 50 && (
                <>
                  {" · "}
                  <Link href={href({ limit: "200" })} className="text-brand-blue hover:underline">
                    {t("more")}
                  </Link>
                </>
              )}
            </p>
          </>
        )}
      </section>

      <section>
        <h2 className="text-2xl text-brand-black">{t("winners")}</h2>
        {data.winners.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">{t("noWinners")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-200 bg-brand-white shadow-sm">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 font-accent text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  {(["kind", "period", "donor", "amount", "date"] as const).map((c) => (
                    <th key={c} scope="col" className={`px-4 py-3 ${c === "amount" ? "text-right" : ""}`}>
                      {t(`winnerColumns.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.winners.map((w) => (
                  <tr key={`${w.kind}-${w.periodKey}`}>
                    <td className="px-4 py-2.5">{kindName(w.kind)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{w.periodKey}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/donors/${w.donorId}`} className="text-brand-blue hover:underline">
                        {w.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{f.money(w.amountUsd)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{f.date(w.awardedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
