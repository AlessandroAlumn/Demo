import { getTranslations, setRequestLocale } from "next-intl/server";
import ProgressBar from "@/components/ProgressBar";
import { redirectTo } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDonationsPage } from "@/lib/donor-queries";
import { makeFormatters } from "@/lib/format";

export default async function DonationsPage({ params }: PageProps<"/[locale]/donations">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirectTo("/login", locale);
  if (user.role === "admin") redirectTo("/admin", locale);

  const [t, tPrograms, tMethods, f] = await Promise.all([
    getTranslations("Donations"),
    getTranslations("Programs"),
    getTranslations("Methods"),
    Promise.resolve(makeFormatters(locale)),
  ]);
  const data = await getDonationsPage(user.donorId!);
  const biggest = Math.max(1, ...data.byProgram.map((p) => p.amountUsd));
  const program = tPrograms as unknown as (key: string) => string;
  const method = tMethods as unknown as (key: string) => string;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
        <p className="mt-1 font-light text-gray-500">{t("subtitle")}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-brand-yellow p-5 shadow-sm">
          <p className="font-accent text-xs font-semibold uppercase tracking-wide opacity-70">{t("total")}</p>
          <p className="mt-1 font-serif text-4xl font-bold text-brand-black">{f.money(data.total)}</p>
          <p className="mt-1 text-sm">{t("count", { n: data.count })}</p>
          <p className="mt-2 text-xs opacity-70">{t("failedNote")}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-brand-white p-5 shadow-sm md:col-span-2">
          <h2 className="text-lg text-brand-black">{t("byProgram")}</h2>
          {data.byProgram.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">{t("empty")}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.byProgram.map((p) => (
                <li key={p.program}>
                  <div className="flex justify-between text-sm">
                    <span>{program(p.program)}</span>
                    <span className="font-medium">{f.money(p.amountUsd)}</span>
                  </div>
                  <div className="mt-1">
                    <ProgressBar value={p.amountUsd} max={biggest} label={program(p.program)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-2xl text-brand-black">{t("history")}</h2>
        {data.rows.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">{t("empty")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-200 bg-brand-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 font-accent text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  {(["date", "amount", "program", "campaign", "method", "status"] as const).map((c) => (
                    <th key={c} scope="col" className={`px-4 py-3 ${c === "amount" ? "text-right" : ""}`}>
                      {t(`columns.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((r) => (
                  <tr key={r.id} className={r.status === "failed" ? "text-gray-400" : ""}>
                    <td className="whitespace-nowrap px-4 py-2.5">{f.date(r.date)}</td>
                    <td className={`whitespace-nowrap px-4 py-2.5 text-right font-medium ${r.status === "failed" ? "line-through" : ""}`}>
                      {f.money(r.amountUsd)}
                    </td>
                    <td className="px-4 py-2.5">{program(r.program)}</td>
                    <td className="px-4 py-2.5">{r.campaign ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {method(r.method)}
                      {r.recurring && (
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">{t("recurring")}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          r.status === "failed" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800"
                        }`}
                      >
                        {t(`status.${r.status === "failed" ? "failed" : "succeeded"}`)}
                      </span>
                    </td>
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
