import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Home");

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl text-brand-black md:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-lg font-light text-gray-500">
        {t("subtitle")}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-brand-yellow p-6 text-brand-black shadow-sm">
          <p className="font-accent text-sm font-semibold uppercase tracking-wide">
            {t("sampleRank")}
          </p>
          <p className="mt-2 font-serif text-3xl font-bold">
            {t("sampleRankValue")}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-brand-white p-6 shadow-sm">
          <span className="inline-block rounded-full bg-tier-gold px-3 py-1 font-accent text-sm font-semibold text-brand-black">
            🏅 {t("sampleBadge")}
          </span>
          <a
            href="https://alumnusb.org/dona"
            className="mt-4 block font-accent font-semibold text-brand-blue hover:underline"
          >
            {t("cta")} →
          </a>
        </div>
      </div>
    </section>
  );
}
