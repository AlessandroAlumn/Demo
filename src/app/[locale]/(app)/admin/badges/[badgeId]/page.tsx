import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BadgeEditForm from "@/components/admin/BadgeEditForm";
import { Link } from "@/i18n/navigation";
import { getBadgeForEdit } from "@/lib/admin-queries";
import { ruleFields } from "@/lib/rule-edit";

export default async function EditBadgePage({ params }: PageProps<"/[locale]/admin/badges/[badgeId]">) {
  const { locale, badgeId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin.badges");
  const badge = await getBadgeForEdit(badgeId);
  if (!badge) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Link href="/admin/badges" className="font-accent text-sm font-semibold text-brand-blue hover:underline">
        ← {t("back")}
      </Link>
      <h1 className="text-3xl text-brand-black md:text-4xl">{t("editTitle", { id: badge.id })}</h1>
      <BadgeEditForm
        badge={{ id: badge.id, nameEs: badge.nameEs, nameEn: badge.nameEn, descEs: badge.descEs, descEn: badge.descEn, icon: badge.icon, active: badge.active }}
        fields={ruleFields(badge.rule)}
        ruleType={badge.rule.type}
      />
    </div>
  );
}
