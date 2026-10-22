"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default function LanguageToggle() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div
      role="group"
      aria-label={t("language")}
      className="flex overflow-hidden rounded-full border border-gray-400 font-accent text-xs font-semibold"
    >
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={l === locale}
          onClick={() => router.replace(pathname, { locale: l })}
          className={
            l === locale
              ? "bg-brand-yellow px-3 py-1 text-brand-black"
              : "px-3 py-1 text-brand-white hover:bg-gray-500"
          }
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
