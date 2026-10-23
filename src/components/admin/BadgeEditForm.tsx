"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveBadgeAction, type BadgeFormState } from "@/app/[locale]/(app)/admin/badges/actions";
import type { RuleField } from "@/lib/rule-edit";

type Badge = {
  id: string;
  nameEs: string;
  nameEn: string;
  descEs: string;
  descEn: string;
  icon: string;
  active: boolean;
};

/** Texts, icon, active flag and the rule's thresholds. The rule's type is fixed. */
export default function BadgeEditForm({ badge, fields, ruleType }: { badge: Badge; fields: RuleField[]; ruleType: string }) {
  const t = useTranslations("Admin.badges");
  const [state, action, pending] = useActionState<BadgeFormState, FormData>(saveBadgeAction, { status: "idle" });
  const errors = state.status === "error" ? state.errors : {};
  const input = "mt-1 w-full rounded-lg border border-gray-200 bg-brand-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30";
  const label = "font-accent text-sm font-semibold text-brand-black";
  const err = (k: string) => (errors[k] ? <p className="mt-1 text-xs text-red-700">{errors[k] === "required" ? t("errors.required") : errors[k]}</p> : null);

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-gray-200 bg-brand-white p-6 shadow-sm">
      <input type="hidden" name="id" value={badge.id} />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="nameEs" className={label}>{t("nameEs")}</label>
          <input id="nameEs" name="nameEs" defaultValue={badge.nameEs} className={input} />
          {err("nameEs")}
        </div>
        <div>
          <label htmlFor="nameEn" className={label}>{t("nameEn")}</label>
          <input id="nameEn" name="nameEn" defaultValue={badge.nameEn} className={input} />
          {err("nameEn")}
        </div>
        <div>
          <label htmlFor="descEs" className={label}>{t("descEs")}</label>
          <textarea id="descEs" name="descEs" rows={3} defaultValue={badge.descEs} className={input} />
          {err("descEs")}
        </div>
        <div>
          <label htmlFor="descEn" className={label}>{t("descEn")}</label>
          <textarea id="descEn" name="descEn" rows={3} defaultValue={badge.descEn} className={input} />
          {err("descEn")}
        </div>
      </div>
      <p className="text-xs text-gray-400">{t("placeholdersNote")}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="icon" className={label}>{t("icon")}</label>
          <input id="icon" name="icon" defaultValue={badge.icon} maxLength={8} className={input} />
          {err("icon")}
        </div>
        <label className="flex items-center gap-3 self-end pb-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={badge.active} className="h-4 w-4 accent-brand-blue" />
          <span className="font-medium">{t("activeLabel")}</span>
        </label>
      </div>

      <div>
        <p className={label}>
          {t("thresholds")} <span className="ml-1 font-mono text-xs font-normal text-gray-400">{ruleType}</span>
        </p>
        {fields.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">{t("noThresholds")}</p>
        ) : (
          <div className="mt-2 grid gap-4 md:grid-cols-3">
            {fields.map((field) => (
              <div key={field.key}>
                <label htmlFor={`rule_${field.key}`} className="text-sm text-gray-600">
                  {t(`fields.${field.key}`)}
                </label>
                {field.kind === "number" ? (
                  <input id={`rule_${field.key}`} name={`rule_${field.key}`} type="number" step="any" min="0" defaultValue={field.value} className={input} />
                ) : (
                  <select id={`rule_${field.key}`} name={`rule_${field.key}`} defaultValue={field.value} className={input}>
                    {field.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
        {err("rule")}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-yellow px-5 py-2.5 font-accent font-semibold text-brand-black hover:brightness-95 disabled:opacity-60"
        >
          {t("save")}
        </button>
        {state.status === "saved" && (
          <p role="status" className="text-sm font-medium text-green-800">
            ✓ {t("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
