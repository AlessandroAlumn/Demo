import { getTranslations, setRequestLocale } from "next-intl/server";
import { titleFor } from "@/lib/page-title";
import CompanySearch from "@/components/CompanySearch";
import { Link, redirectTo } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBadgeCatalog, loadCompanies } from "@/lib/donor-queries";
import { makeFormatters } from "@/lib/format";

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) =>
  titleFor(params, "Header", "matching");

export default async function MatchingPage({ params }: PageProps<"/[locale]/matching">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirectTo("/login", locale);
  if (user.role === "admin") redirectTo("/admin", locale);

  const t = await getTranslations("Matching");
  const f = makeFormatters(locale);
  const [companies, catalog] = await Promise.all([loadCompanies(), getBadgeCatalog(user.donorId!, user.id, locale)]);
  const doubleImpact = catalog.items
    .filter((b) => b.id === "B-G1" || b.id === "B-G2")
    .flatMap((b) => b.earned.map((e) => ({ id: b.id, icon: b.icon, ...e })));

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
        <p className="mt-1 font-light text-gray-500">{t("subtitle")}</p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-brand-white p-6 shadow-sm">
        <h2 className="text-xl text-brand-black">{t("howTitle")}</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {(["step1", "step2", "step3"] as const).map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-yellow font-accent text-sm font-bold text-brand-black">
                {i + 1}
              </span>
              <p className="text-sm text-gray-600">{t(step)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-brand-white p-6 shadow-sm">
        <h2 className="text-xl text-brand-black">{t("searchTitle")}</h2>
        <div className="mt-3">
          <CompanySearch
            companies={companies}
            labels={{
              placeholder: t("placeholder"),
              hint: t("hint"),
              matches: t("matches"),
              noMatch: t("noMatch"),
              via: t("via", { platform: "{platform}" }),
              none: t("none", { query: "{query}" }),
            }}
          />
        </div>
        <p className="mt-3 text-xs text-gray-400">{t("mockNote")}</p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-brand-white p-6 shadow-sm">
          <h2 className="text-xl text-brand-black">{t("moreTitle")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href="https://doublethedonation.com/" target="_blank" rel="noopener noreferrer" className="font-accent font-semibold text-brand-blue hover:underline">
                {t("ddt")} ↗
              </a>
            </li>
            <li>
              <a href="https://benevity.com/" target="_blank" rel="noopener noreferrer" className="font-accent font-semibold text-brand-blue hover:underline">
                {t("benevity")} ↗
              </a>
            </li>
          </ul>
          <p className="mt-4 text-sm font-light text-gray-600">{t("hr")}</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-brand-white p-6 shadow-sm">
          <h2 className="text-xl text-brand-black">{t("badgesTitle")}</h2>
          {doubleImpact.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">{t("noBadges")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {doubleImpact.map((b) => (
                <li key={`${b.id}-${b.periodKey}`} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span aria-hidden className="mr-2 text-xl">
                      {b.icon}
                    </span>
                    <span className="font-medium">{b.name}</span>
                  </span>
                  <span className="flex items-center gap-3 text-gray-400">
                    {f.date(b.awardedAt)}
                    <Link
                      href={`/share/${b.id}?period=${encodeURIComponent(b.periodKey)}`}
                      className="font-accent font-semibold text-brand-blue hover:underline"
                    >
                      ↗
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
