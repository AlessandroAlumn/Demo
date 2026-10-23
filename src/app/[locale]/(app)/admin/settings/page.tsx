import { getTranslations, setRequestLocale } from "next-intl/server";
import { titleFor } from "@/lib/page-title";
import SettingsForm, { type SettingField } from "@/components/admin/SettingsForm";
import TimeMachine from "@/components/admin/TimeMachine";
import { db } from "@/lib/db";
import { DEMO_END_DATE } from "@/lib/pipeline";
import { loadSettings } from "@/lib/settings";
import { EDITABLE_SETTINGS, settingToText } from "@/lib/settings-edit";

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }) =>
  titleFor(params, "Admin.nav", "settings");

export default async function SettingsPage({ params }: PageProps<"/[locale]/admin/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin.settings");
  const settings = await loadSettings(db);

  const fields: SettingField[] = EDITABLE_SETTINGS.map((key) => {
    const value = settings[key];
    return {
      key,
      text: settingToText(value),
      kind: typeof value === "number" ? "number" : typeof value === "string" ? "text" : "json",
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-3xl text-brand-black md:text-4xl">{t("title")}</h1>
        <p className="mt-1 font-light text-gray-500">{t("subtitle")}</p>
      </header>

      <section>
        <h2 className="mb-3 text-2xl text-brand-black">{t("clock")}</h2>
        <TimeMachine today={settings.simulatedToday} endDate={DEMO_END_DATE} variant="panel" />
        <p className="mt-2 text-xs text-gray-400">{t("readOnly", { launch: settings.launchDate, today: settings.simulatedToday })}</p>
      </section>

      <SettingsForm fields={fields} />
    </div>
  );
}
