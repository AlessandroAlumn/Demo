"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { awardBadgeAction, type AwardState } from "@/app/[locale]/(app)/admin/donors/actions";

/** Give a badge by hand. The donor gets an N1 notification. */
export default function AwardForm({ donorId, badges }: { donorId: string; badges: { id: string; name: string }[] }) {
  const t = useTranslations("Admin.donors");
  const [state, action, pending] = useActionState<AwardState, FormData>(awardBadgeAction, { status: "idle" });
  const field = "mt-1 w-full rounded-lg border border-gray-200 bg-brand-white px-3 py-2 text-sm outline-none focus:border-brand-blue";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="donorId" value={donorId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="badgeId" className="font-accent text-sm font-semibold">
            {t("awardBadge")}
          </label>
          <select id="badgeId" name="badgeId" className={field} defaultValue="B-SO8">
            {badges.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.id})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="periodKey" className="font-accent text-sm font-semibold">
            {t("awardPeriod")}
          </label>
          <input id="periodKey" name="periodKey" className={field} />
        </div>
      </div>
      <p className="text-xs text-gray-400">{t("awardPeriodHelp")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-yellow px-4 py-2 font-accent text-sm font-semibold text-brand-black hover:brightness-95 disabled:opacity-60"
        >
          {t("awardButton")}
        </button>
        {state.status === "ok" && (
          <p role="status" className="text-sm font-medium text-green-800">
            ✓ {t("awarded")}
          </p>
        )}
        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-700">
            {t(`awardErrors.${state.error}`)}
          </p>
        )}
      </div>
    </form>
  );
}
