import { getTranslations, setRequestLocale } from "next-intl/server";
import NotificationItem from "@/components/NotificationItem";
import { redirectTo } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { countUnread, loadNotifications } from "@/lib/feed";
import { makeFormatters } from "@/lib/format";
import { markAllReadAction } from "./actions";

export default async function FeedPage({ params }: PageProps<"/[locale]/feed">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirectTo("/login", locale);
  if (user.role === "admin") redirectTo("/admin", locale);
  if (user.gamificationOptOut) redirectTo("/donations", locale);

  const t = await getTranslations("Feed");
  const f = makeFormatters(locale);
  const [items, unread] = await Promise.all([
    loadNotifications(user.id, locale, { channel: "feed" }),
    countUnread(user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
          <p className="mt-1 font-light text-gray-500">{t("subtitle")}</p>
        </div>
        {unread > 0 ? (
          <form action={markAllReadAction}>
            <button
              type="submit"
              className="rounded-lg border border-gray-200 bg-brand-white px-4 py-2 font-accent text-sm font-semibold text-brand-black hover:border-brand-blue hover:text-brand-blue"
            >
              {t("markAllRead")} ({unread})
            </button>
          </form>
        ) : (
          items.length > 0 && <p className="text-sm text-gray-400">{t("allRead")}</p>
        )}
      </header>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-brand-white p-8 text-center text-sm text-gray-500">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <NotificationItem
              key={item.id}
              item={item}
              dateLabel={f.date(item.date)}
              markReadLabel={t("markRead")}
              progressLabel={item.progress ? t("campaignGoal", { raised: f.money(item.progress.raised), goal: f.money(item.progress.goal) }) : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
