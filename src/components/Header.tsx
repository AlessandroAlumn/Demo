import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { logoutAction } from "@/app/[locale]/login/actions";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getToday } from "@/lib/clock";
import LanguageToggle from "./LanguageToggle";

export default async function Header() {
  const t = await getTranslations("Header");
  const locale = await getLocale();
  const [user, today] = await Promise.all([getCurrentUser(), getToday()]);

  return (
    <header className="bg-brand-black text-brand-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" aria-label="AlumnUSB">
            <Image src="/brand/logo-white.png" alt="AlumnUSB" width={150} height={47} priority />
          </Link>
          {user && (
            <nav className="flex items-center gap-4 font-accent text-sm font-medium">
              {user.role === "admin" ? (
                <Link href="/admin" className="hover:text-brand-yellow">
                  {t("admin")}
                </Link>
              ) : (
                <Link href="/dashboard" className="hover:text-brand-yellow">
                  {t("dashboard")}
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-brand-yellow px-3 py-1 font-accent text-xs font-semibold text-brand-black sm:inline">
            {t("demo", { date: today })}
          </span>
          <LanguageToggle />
          {user && (
            <form action={logoutAction} className="flex items-center gap-2">
              <input type="hidden" name="locale" value={locale} />
              <span className="hidden font-accent text-sm text-gray-200 sm:inline">{user.username}</span>
              <button
                type="submit"
                className="rounded-full border border-gray-400 px-3 py-1 font-accent text-xs font-semibold hover:bg-gray-500"
              >
                {t("logout")}
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
