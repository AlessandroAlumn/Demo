"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveSettingsAction, type SettingsState } from "@/app/[locale]/(app)/admin/settings/actions";

export type SettingField = { key: string; text: string; kind: "number" | "text" | "json" };

/** One field per setting: numbers and text directly, structures as JSON. Nothing is saved if any value is invalid. */
export default function SettingsForm({ fields }: { fields: SettingField[] }) {
  const t = useTranslations("Admin.settings");
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, { status: "idle" });
  const errors = state.status === "error" ? state.errors : {};
  const input = "mt-1 w-full rounded-lg border bg-brand-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30";

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-gray-200 bg-brand-white p-6 shadow-sm">
      <div className="grid gap-5 md:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className={field.kind === "json" ? "md:col-span-2" : ""}>
            <label htmlFor={field.key} className="font-accent text-sm font-semibold text-brand-black">
              {t(`keys.${field.key}.label` as never)}
              {field.kind === "json" && <span className="ml-2 font-normal text-gray-400">{t("json")}</span>}
            </label>
            {field.kind === "json" ? (
              <textarea
                id={field.key}
                name={field.key}
                rows={Math.min(14, field.text.split("\n").length + 1)}
                defaultValue={field.text}
                spellCheck={false}
                className={`${input} font-mono text-xs ${errors[field.key] ? "border-red-300" : "border-gray-200"}`}
              />
            ) : (
              <input
                id={field.key}
                name={field.key}
                type="text"
                inputMode={field.kind === "number" ? "decimal" : "text"}
                defaultValue={field.text}
                className={`${input} ${errors[field.key] ? "border-red-300" : "border-gray-200"}`}
              />
            )}
            <p className="mt-1 text-xs text-gray-400">{t(`keys.${field.key}.help` as never)}</p>
            {errors[field.key] && (
              <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                {errors[field.key]}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-yellow px-5 py-2.5 font-accent font-semibold text-brand-black hover:brightness-95 disabled:opacity-60">
          {t("save")}
        </button>
        {state.status === "saved" && (
          <p role="status" className="text-sm font-medium text-green-800">
            ✓ {state.changed.length > 0 ? t("saved", { changed: state.changed.join(", ") }) : t("nothing")}
          </p>
        )}
      </div>
    </form>
  );
}
