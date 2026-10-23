import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { searchDonors } from "@/lib/admin-queries";
import { makeFormatters } from "@/lib/format";

export default async function DonorsPage({ params, searchParams }: PageProps<"/[locale]/admin/donors">) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Admin.donors");
  const f = makeFormatters(locale);
  const query = typeof q === "string" ? q : "";
  const donors = await searchDonors(query);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>

      <form className="flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          {t("search")}
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder={t("search")}
          className="min-w-64 flex-1 rounded-lg border border-gray-200 bg-brand-white px-3 py-2.5 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
        />
        <button type="submit" className="rounded-lg bg-brand-yellow px-5 py-2.5 font-accent font-semibold text-brand-black hover:brightness-95">
          {t("searchButton")}
        </button>
      </form>

      {donors.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-brand-white p-8 text-center text-sm text-gray-500">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-brand-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 font-accent text-xs uppercase tracking-wide text-gray-400">
              <tr>
                {(["id", "name", "email", "first", "user"] as const).map((c) => (
                  <th key={c} scope="col" className="px-4 py-3">
                    {t(`columns.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {donors.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/admin/donors/${d.id}`} className="font-semibold text-brand-blue hover:underline">
                      {d.id}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-medium">{d.name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{d.email}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">{f.date(d.firstDonationDate)}</td>
                  <td className="px-4 py-2.5">
                    {d.username && <span className="rounded-full bg-brand-yellow px-2.5 py-0.5 font-accent text-xs font-semibold">{d.username}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
