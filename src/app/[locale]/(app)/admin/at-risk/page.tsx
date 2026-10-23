import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAtRisk } from "@/lib/admin-queries";
import { makeFormatters } from "@/lib/format";

export default async function AtRiskPage({ params }: PageProps<"/[locale]/admin/at-risk">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin.atRisk");
  const f = makeFormatters(locale);
  const rows = await getAtRisk();
  const grace = rows.filter((r) => r.status === "grace").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
          <p className="mt-1 max-w-2xl font-light text-gray-500">{t("subtitle")}</p>
        </div>
        {rows.length > 0 && (
          <a
            href="/api/admin/at-risk"
            download
            className="rounded-lg bg-brand-black px-4 py-2.5 font-accent text-sm font-semibold text-brand-white hover:bg-gray-500"
          >
            {t("export")}
          </a>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-brand-white p-8 text-center text-sm text-gray-500">{t("empty")}</p>
      ) : (
        <>
          <p className="text-sm text-gray-500">{t("summary", { grace, inactive: rows.length - grace })}</p>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-brand-white shadow-sm">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 font-accent text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  {(["donor", "status", "amount", "streak", "left", "since", "last"] as const).map((c) => (
                    <th key={c} scope="col" className={`px-4 py-3 ${c === "amount" ? "text-right" : ""}`}>
                      {t(`columns.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.donorId}>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/donors/${r.donorId}`} className="font-medium text-brand-blue hover:underline">
                        {r.name}
                      </Link>
                      <span className="block text-xs text-gray-400">{r.email}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2.5 py-0.5 font-accent text-xs font-semibold ${r.status === "grace" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                        {t(`statuses.${r.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{f.money(r.monthlyAmount)}</td>
                    <td className="px-4 py-2.5">{t("streakMonths", { n: r.streakAtStake })}</td>
                    <td className="px-4 py-2.5">{r.daysLeft && r.daysLeft > 0 ? r.daysLeft : <span className="text-gray-400">{t("expired")}</span>}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">{f.date(r.failureStart)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{r.lastSuccess ? f.date(r.lastSuccess) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
