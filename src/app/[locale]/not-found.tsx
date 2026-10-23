import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("Errors");
  return (
    <section className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="font-serif text-7xl font-bold text-brand-yellow" aria-hidden>
        404
      </p>
      <h1 className="mt-2 text-3xl text-brand-black">{t("notFoundTitle")}</h1>
      <p className="mt-3 font-light text-gray-500">{t("notFoundText")}</p>
      <Link href="/" className="mt-6 inline-block rounded-lg bg-brand-yellow px-5 py-2.5 font-accent font-semibold text-brand-black hover:brightness-95">
        {t("home")}
      </Link>
    </section>
  );
}
