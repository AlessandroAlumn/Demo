import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getBadgeAdminList } from "@/lib/admin-queries";
import { ruleFields } from "@/lib/rule-edit";

export default async function AdminBadgesPage({ params }: PageProps<"/[locale]/admin/badges">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tCategories] = await Promise.all([getTranslations("Admin.badges"), getTranslations("Categories")]);
  const badges = await getBadgeAdminList(locale);
  const category = tCategories as unknown as (k: string) => string;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
        <p className="mt-1 font-light text-gray-500">{t("subtitle")}</p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-brand-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 font-accent text-xs uppercase tracking-wide text-gray-400">
            <tr>
              {(["badge", "category", "rule", "awards", "rarity", "status"] as const).map((c) => (
                <th key={c} scope="col" className="px-4 py-3">
                  {t(`columns.${c}`)}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {badges.map((b) => (
              <tr key={b.id} className={b.active ? "" : "text-gray-400"}>
                <td className="px-4 py-2.5">
                  <span aria-hidden className="mr-2 text-lg">
                    {b.icon}
                  </span>
                  <span className="font-medium">{b.name}</span>
                  <span className="ml-2 font-mono text-xs text-gray-400">{b.id}</span>
                </td>
                <td className="px-4 py-2.5">{category(b.category)}</td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {b.rule.type}
                  {ruleFields(b.rule).map((f) => ` ${f.key}=${f.value}`).join("")}
                  {b.manualOnly && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 font-sans text-[11px]">{t("manual")}</span>}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{b.awards}</td>
                <td className="px-4 py-2.5 tabular-nums">{b.rarityPct}%</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2.5 py-0.5 font-accent text-xs font-semibold ${b.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                    {b.active ? t("active") : t("inactive")}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/admin/badges/${b.id}`} className="font-accent text-sm font-semibold text-brand-blue hover:underline">
                    {t("edit")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
