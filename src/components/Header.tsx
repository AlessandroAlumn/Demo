import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LanguageToggle from "./LanguageToggle";

export default function Header() {
  const t = useTranslations("Header");

  return (
    <header className="bg-brand-black text-brand-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" aria-label="AlumnUSB">
          <Image
            src="/brand/logo-white.png"
            alt="AlumnUSB"
            width={150}
            height={47}
            priority
          />
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-brand-yellow px-3 py-1 font-accent text-xs font-semibold text-brand-black sm:inline">
            {t("demo", { date: "2026-07-01" })}
          </span>
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
