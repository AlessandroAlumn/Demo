import { getTranslations, setRequestLocale } from "next-intl/server";
import BarChart from "@/components/admin/BarChart";
import { Link } from "@/i18n/navigation";
import { getOverview } from "@/lib/admin-queries";
import { makeFormatters } from "@/lib/format";

export default async function AdminOverviewPage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin.overview");
  const f = makeFormatters(locale);
  const o = await getOverview();

  const kpis: { key: string; value: string; href?: string; tone?: "warn" | "highlight" }[] = [
    { key: "raised", value: f.money(o.totalRaised), tone: "highlight" },
    { key: "month", value: f.money(o.raisedThisMonth) },
    { key: "donors", value: f.number(o.donorsTotal), href: "/admin/donors" },
    { key: "donorsMonth", value: f.number(o.donorsThisMonth) },
    { key: "recurring", value: f.number(o.activeRecurring) },
    { key: "mrr", value: f.money(o.mrr) },
    { key: "atRisk", value: f.number(o.atRisk), href: "/admin/at-risk", tone: o.atRisk > 0 ? "warn" : undefined },
    { key: "badges", value: f.number(o.badgesAwarded), href: "/admin/badges" },
    { key: "claims", value: f.number(o.pendingClaims), href: "/admin/claims", tone: o.pendingClaims > 0 ? "warn" : undefined },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
        <p className="mt-1 font-light text-gray-500">{t("subtitle")}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => {
          const body = (
            <>
              <p className="font-accent text-xs font-semibold uppercase tracking-wide opacity-70">{t(`kpis.${k.key}`)}</p>
              <p className="mt-1 font-serif text-3xl font-bold">{k.value}</p>
            </>
          );
          const style =
            k.tone === "highlight"
              ? "bg-brand-yellow text-brand-black"
              : k.tone === "warn"
                ? "border border-red-200 bg-red-50 text-red-900"
                : "border border-gray-200 bg-brand-white text-brand-black";
          return k.href ? (
            <Link key={k.key} href={k.href} className={`rounded-2xl p-5 shadow-sm transition hover:shadow-md ${style}`}>
              {body}
            </Link>
          ) : (
            <div key={k.key} className={`rounded-2xl p-5 shadow-sm ${style}`}>
              {body}
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-brand-white p-5 shadow-sm">
        <h2 className="text-xl text-brand-black">{t("chart")}</h2>
        <div className="mt-3">
          <BarChart
            label={t("chart")}
            format={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${Math.round(v)}`)}
            data={o.monthly.map((m) => ({
              label: new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { month: "short", timeZone: "UTC" }).format(new Date(`${m.month}-01T00:00:00Z`)),
              value: m.total,
            }))}
          />
        </div>
      </section>
    </div>
  );
}
