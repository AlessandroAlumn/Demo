import { getTranslations, setRequestLocale } from "next-intl/server";

// Placeholder: the backoffice pages are built in step 11.
export default async function AdminHomePage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin");

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
      <p className="mt-2 max-w-2xl font-light text-gray-500">{t("placeholder")}</p>
    </section>
  );
}
