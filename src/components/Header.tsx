import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { logoutAction } from "@/app/[locale]/login/actions";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getToday } from "@/lib/clock";
import { countUnread, loadNotifications } from "@/lib/feed";
import { makeFormatters } from "@/lib/format";
import Bell from "./Bell";
import LanguageToggle from "./LanguageToggle";

export default async function Header() {
  const t = await getTranslations("Header");
  const locale = await getLocale();
  const f = makeFormatters(locale);
  const [user, today] = await Promise.all([getCurrentUser(), getToday()]);

  const isDonor = user?.role === "donor";
  const gamified = isDonor && !user.gamificationOptOut;
  const [items, unread] = gamified
    ? await Promise.all([loadNotifications(user.id, locale, { channel: "bell", limit: 8 }), countUnread(user.id)])
    : [[], 0];

  const navLink = "hover:text-brand-yellow";

  return (
    <header className="bg-brand-black text-brand-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" aria-label="AlumnUSB">
            <Image src="/brand/logo-white.png" alt="AlumnUSB" width={150} height={47} priority />
          </Link>
          {user && (
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 font-accent text-sm font-medium">
              {user.role === "admin" && (
                <Link href="/admin" className={navLink}>
                  {t("admin")}
                </Link>
              )}
              {gamified && (
                <Link href="/dashboard" className={navLink}>
                  {t("dashboard")}
                </Link>
              )}
              {isDonor && (
                <Link href="/donations" className={navLink}>
                  {t("donations")}
                </Link>
              )}
              {gamified && (
                <>
                  <Link href="/badges" className={navLink}>
                    {t("badges")}
                  </Link>
                  <Link href="/feed" className={navLink}>
                    {t("feed")}
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-brand-yellow px-3 py-1 font-accent text-xs font-semibold text-brand-black sm:inline">
            {t("demo", { date: today })}
          </span>
          <LanguageToggle />
          {gamified && (
            <Bell
              unread={unread}
              items={items.map((i) => ({
                id: i.id, icon: i.icon, text: i.text, detail: i.detail, dateLabel: f.date(i.date), read: i.read,
              }))}
              labels={{
                title: t("notifications"),
                markAllRead: t("markAllRead"),
                empty: t("noNotifications"),
                seeAll: t("seeAll"),
              }}
            />
          )}
          {user && (
            <form action={logoutAction} className="flex items-center gap-2">
              <input type="hidden" name="locale" value={locale} />
              <span className="hidden font-accent text-sm text-gray-200 md:inline">{user.username}</span>
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
