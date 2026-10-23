import { getTranslations, setRequestLocale } from "next-intl/server";
import CopyButton from "@/components/CopyButton";
import { redirectTo } from "@/i18n/navigation";
import { SOCIAL_NETWORKS, SOCIAL_URLS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/donor-queries";
import { ALIAS_MAX_LENGTH, referralLink } from "@/lib/share";
import { claimFollowAction, savePreferencesAction } from "./actions";

export default async function ProfilePage({ params, searchParams }: PageProps<"/[locale]/profile">) {
  const { locale } = await params;
  const { saved } = await searchParams;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirectTo("/login", locale);
  if (user.role === "admin") redirectTo("/admin", locale);

  const [t, tNetworks] = await Promise.all([getTranslations("Profile"), getTranslations("Networks")]);
  const profile = await getProfile(user.id, user.donorId!);
  const link = referralLink(profile.referralCode);
  const network = tNetworks as unknown as (key: string) => string;
  const input =
    "mt-1 w-full rounded-lg border border-gray-200 bg-brand-white px-3 py-2 text-brand-text outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30";
  const label = "block font-accent text-sm font-semibold text-brand-black";

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
        <p className="mt-1 font-light text-gray-500">{t("subtitle")}</p>
      </header>

      {saved && (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800">
          ✓ {t("saved")}
        </p>
      )}

      <form action={savePreferencesAction} className="space-y-5 rounded-2xl border border-gray-200 bg-brand-white p-6 shadow-sm">
        <div>
          <p className={label}>{t("username")}</p>
          <p className="mt-1 text-sm text-gray-500">{profile.username}</p>
        </div>

        <div>
          <label htmlFor="language" className={label}>
            {t("language")}
          </label>
          <select id="language" name="language" defaultValue={profile.locale} className={input}>
            <option value="es">{t("languages.es")}</option>
            <option value="en">{t("languages.en")}</option>
          </select>
        </div>

        <div>
          <label htmlFor="alias" className={label}>
            {t("alias")}
          </label>
          <input
            id="alias"
            name="alias"
            type="text"
            maxLength={ALIAS_MAX_LENGTH}
            defaultValue={profile.alias ?? ""}
            placeholder={t("aliasPlaceholder")}
            className={input}
          />
          <p className="mt-1 text-xs text-gray-400">{t("aliasHelp", { username: profile.username })}</p>
        </div>

        <div>
          <p className={label}>{t("privacy")}</p>
          <label className="mt-2 flex items-start gap-3 text-sm">
            <input type="checkbox" name="optOut" defaultChecked={profile.optOut} className="mt-1 h-4 w-4 accent-brand-blue" />
            <span>
              <span className="font-medium text-brand-black">{t("optOut")}</span>
              <span className="mt-0.5 block text-xs font-light text-gray-500">{t("optOutHelp")}</span>
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-brand-yellow px-5 py-2.5 font-accent font-semibold text-brand-black hover:brightness-95"
        >
          {t("save")}
        </button>
      </form>

      <section className="rounded-2xl border border-gray-200 bg-brand-white p-6 shadow-sm">
        <h2 className="text-xl text-brand-black">{t("socialTitle")}</h2>
        <p className="mt-1 text-sm font-light text-gray-500">{t("socialHelp")}</p>
        <ul className="mt-4 divide-y divide-gray-100">
          {SOCIAL_NETWORKS.map((n) => {
            const status = profile.claims[n] ?? "none";
            return (
              <li key={n} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="font-medium text-brand-black">{network(n)}</span>
                <span className="flex flex-wrap items-center gap-3">
                  <a
                    href={SOCIAL_URLS[n]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-accent text-sm font-semibold text-brand-blue hover:underline"
                  >
                    {t("follow")} ↗
                  </a>
                  {status !== "none" && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-accent text-xs font-semibold ${
                        status === "approved"
                          ? "bg-green-100 text-green-800"
                          : status === "pending"
                            ? "bg-brand-yellow-soft text-brand-black"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {t(`status.${status}`)}
                    </span>
                  )}
                  {(status === "none" || status === "rejected") && (
                    <form action={claimFollowAction}>
                      <input type="hidden" name="network" value={n} />
                      <button
                        type="submit"
                        className="rounded-lg border border-gray-200 px-3 py-1.5 font-accent text-sm font-semibold hover:border-brand-blue hover:text-brand-blue"
                      >
                        {status === "rejected" ? t("tryAgain") : t("iFollowed")}
                      </button>
                    </form>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-brand-white p-6 shadow-sm">
        <h2 className="text-xl text-brand-black">{t("referralTitle")}</h2>
        <p className="mt-1 text-sm font-light text-gray-500">{t("referralHelp")}</p>
        <p className="mt-4 font-accent text-xs font-semibold uppercase tracking-wide text-gray-400">{t("referralLink")}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <code className="break-all rounded-lg bg-gray-50 px-3 py-2 text-sm">{link}</code>
          <CopyButton text={link} label={t("copy")} copiedLabel={t("copied")} />
        </div>
        <p className="mt-3 text-sm text-gray-500">{t("invited", { n: profile.referredDonors })}</p>
      </section>
    </div>
  );
}
