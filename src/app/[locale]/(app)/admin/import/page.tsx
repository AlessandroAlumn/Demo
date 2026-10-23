import { getTranslations, setRequestLocale } from "next-intl/server";
import { titleFor } from "@/lib/page-title";
import ImportFlow from "@/components/admin/ImportFlow";
import { db } from "@/lib/db";

type LastImport = {
  at: string;
  demoDate: string;
  report: { donations: { total: number; new: number; updated: number; unchanged: number }; subscriptions: { total: number }; donors: { new: number; updated: number } };
};

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) =>
  titleFor(params, "Admin.nav", "import");

export default async function ImportPage({ params }: PageProps<"/[locale]/admin/import">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin.import");
  const row = await db.setting.findUnique({ where: { key: "lastImport" } });
  const last = (row?.value ?? null) as LastImport | null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
        <p className="mt-1 font-light text-gray-500">{t("subtitle")}</p>
      </header>

      <ImportFlow />

      <section className="rounded-2xl border border-gray-200 bg-brand-white p-5 text-sm shadow-sm">
        <h2 className="text-lg text-brand-black">{t("last")}</h2>
        {last ? (
          <>
            <p className="mt-1 text-gray-500">
              {t("lastAt", { date: new Date(last.at).toISOString().slice(0, 16).replace("T", " "), demo: last.demoDate })}
            </p>
            <p className="mt-1">
              {t("donations")}: {t("counts", { new: last.report.donations.new, updated: last.report.donations.updated, unchanged: last.report.donations.unchanged })}
            </p>
            <p>{t("donors", { new: last.report.donors.new, updated: last.report.donors.updated })}</p>
          </>
        ) : (
          <p className="mt-1 text-gray-500">{t("never")}</p>
        )}
      </section>
    </div>
  );
}
