"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// Shown if a page fails while rendering; "Try again" re-fetches the page without reloading the app.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("Errors");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section role="alert" className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-5xl" aria-hidden>
        ⚠️
      </p>
      <h1 className="mt-3 text-3xl text-brand-black">{t("errorTitle")}</h1>
      <p className="mt-3 font-light text-gray-500">{t("errorText")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg bg-brand-yellow px-5 py-2.5 font-accent font-semibold text-brand-black hover:brightness-95"
        >
          {t("retry")}
        </button>
        <Link href="/" className="rounded-lg border border-gray-200 bg-brand-white px-5 py-2.5 font-accent font-semibold text-brand-black hover:border-brand-blue">
          {t("home")}
        </Link>
      </div>
    </section>
  );
}
