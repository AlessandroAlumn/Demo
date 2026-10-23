import { getTranslations, setRequestLocale } from "next-intl/server";
import CopyButton from "@/components/CopyButton";
import ShareButtons from "@/components/ShareButtons";
import { Link, redirectTo } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getEarnedBadge } from "@/lib/donor-queries";
import { makeFormatters } from "@/lib/format";
import { referralLink, shareLinks } from "@/lib/share";

export default async function SharePage({ params, searchParams }: PageProps<"/[locale]/share/[badgeId]">) {
  const { locale, badgeId } = await params;
  const { period } = await searchParams;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirectTo("/login", locale);
  if (user.role === "admin") redirectTo("/admin", locale);
  if (user.gamificationOptOut) redirectTo("/donations", locale);

  const t = await getTranslations("Share");
  const f = makeFormatters(locale);
  const periodKey = typeof period === "string" ? period : undefined;
  const badge = await getEarnedBadge(user.donorId!, badgeId, periodKey, locale);

  if (!badge) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <h1 className="text-3xl text-brand-black">{t("title")}</h1>
        <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">{t("notEarned")}</p>
        <Link href={`/badges/${badgeId}`} className="font-accent text-sm font-semibold text-brand-blue hover:underline">
          ← {t("back")}
        </Link>
      </div>
    );
  }

  const text = t("message", { badge: badge.name });
  const url = referralLink(user.referralCode);
  const links = shareLinks(text, url);
  const query = `locale=${locale}&period=${encodeURIComponent(badge.periodKey)}`;
  const cardUrl = `/api/share-card/${badge.id}?${query}&format=card`;
  const storyUrl = `/api/share-card/${badge.id}?${query}&format=story&download=1`;
  const labels = {
    shareOn: t("shareOn"),
    networks: {
      whatsapp: t("networks.whatsapp"),
      x: t("networks.x"),
      facebook: t("networks.facebook"),
      linkedin: t("networks.linkedin"),
    },
    instagram: t("instagram"),
    instagramHint: t("instagramHint"),
    downloadCard: t("downloadCard"),
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Link href={`/badges/${badge.id}`} className="font-accent text-sm font-semibold text-brand-blue hover:underline">
        ← {t("back")}
      </Link>
      <header>
        <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
        <p className="mt-1 font-light text-gray-500">{t("subtitle")}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <p className="mb-2 font-accent text-xs font-semibold uppercase tracking-wide text-gray-400">{t("preview")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardUrl}
            alt={badge.name}
            width={1200}
            height={630}
            className="w-full rounded-2xl border border-gray-200 shadow-sm"
          />
          <p className="mt-2 text-sm text-gray-500">
            {badge.icon} {badge.name} · {t("earnedOn", { date: f.date(badge.awardedAt) })}
          </p>
        </section>

        <section className="space-y-5 lg:col-span-2">
          <div>
            <p className="mb-2 font-accent text-xs font-semibold uppercase tracking-wide text-gray-400">{t("messageTitle")}</p>
            <p className="rounded-xl border border-gray-200 bg-brand-white p-4 text-sm leading-relaxed">{text}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <CopyButton text={`${text} ${url}`} label={t("copy")} copiedLabel={t("copied")} />
              <span className="break-all text-xs text-gray-400">
                {t("yourLink")}: {url}
              </span>
            </div>
          </div>

          <ShareButtons badgeId={badge.id} links={links} labels={labels} storyUrl={storyUrl} cardUrl={`${cardUrl}&download=1`} />

          <p className="text-xs text-gray-400">{t("aliasNote", { alias: user.alias ?? user.username })}</p>
        </section>
      </div>
    </div>
  );
}
