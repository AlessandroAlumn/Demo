"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { timeMachineAction, type TimeState } from "@/app/[locale]/(app)/admin/actions";

/**
 * The demo's time machine: +1 day / week / month, jump to a date, or reset. `bar` is the floating strip shown
 * on every admin page (compact on a phone: the date picker and Reset hide behind a "⋯" button); `panel` is the
 * roomier version in Settings.
 */
export default function TimeMachine({
  today,
  launchDate,
  endDate,
  variant,
}: {
  today: string;
  launchDate: string;
  endDate: string;
  variant: "bar" | "panel";
}) {
  const t = useTranslations("Admin.time");
  const [state, action, pending] = useActionState<TimeState, FormData>(timeMachineAction, { status: "idle" });
  const [expanded, setExpanded] = useState(false);
  const bar = variant === "bar";

  const button =
    "rounded-lg px-3 py-1.5 font-accent text-sm font-semibold transition disabled:opacity-50 " +
    (bar ? "bg-brand-yellow text-brand-black hover:brightness-95" : "border border-gray-200 bg-brand-white text-brand-black hover:border-brand-blue");

  const message =
    state.status === "ran"
      ? t("ran", { days: state.days, to: state.to, awards: state.awards, notifications: state.notifications })
      : state.status === "error"
        ? t(`errors.${state.error}`)
        : null;
  // On a phone the extra controls are collapsed until asked for (a single group, so the form never has two date fields).
  const extras = bar && !expanded ? "hidden md:flex" : "flex";

  return (
    <form
      action={action}
      aria-label={t("title")}
      className={
        bar
          ? "fixed inset-x-0 bottom-0 z-40 border-t border-gray-500 bg-brand-black px-3 py-2 text-brand-white shadow-lg sm:px-4 sm:py-2.5"
          : "rounded-2xl border border-gray-200 bg-brand-white p-5 shadow-sm"
      }
    >
      <div className={`mx-auto flex flex-wrap items-center gap-x-4 gap-y-2 ${bar ? "max-w-6xl" : ""}`}>
        <p className={`font-accent text-sm font-semibold ${bar ? "text-brand-yellow" : "text-brand-black"}`}>⏱ {t("today", { date: today })}</p>

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" name="op" value="day" disabled={pending} className={button}>
            {t("day")}
          </button>
          <button type="submit" name="op" value="week" disabled={pending} className={button}>
            {t("week")}
          </button>
          <button type="submit" name="op" value="month" disabled={pending} className={button}>
            {t("month")}
          </button>
          {bar && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={t("more")}
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg border border-gray-400 px-3 py-1.5 font-accent text-sm font-semibold text-brand-white hover:bg-gray-500 md:hidden"
            >
              ⋯
            </button>
          )}
        </div>

        <div className={`${extras} flex-wrap items-center gap-x-4 gap-y-2`}>
          <div className="flex items-center gap-2">
            <label htmlFor={`jump-${variant}`} className="sr-only">
              {t("jump")}
            </label>
            <input
              id={`jump-${variant}`}
              type="date"
              name="date"
              min={launchDate}
              max={endDate}
              className="rounded-lg border border-gray-300 bg-brand-white px-2 py-1 text-sm text-brand-text"
            />
            <button type="submit" name="op" value="jump" disabled={pending} className={button}>
              {t("go")}
            </button>
          </div>

          <button
            type="submit"
            name="op"
            value="reset"
            disabled={pending}
            onClick={(e) => {
              if (!window.confirm(t("resetConfirm"))) e.preventDefault();
            }}
            className={`rounded-lg border px-3 py-1.5 font-accent text-sm font-semibold disabled:opacity-50 ${
              bar ? "border-gray-400 text-brand-white hover:bg-gray-500" : "border-red-200 text-red-700 hover:bg-red-50"
            }`}
          >
            {t("reset")}
          </button>
        </div>

        <p
          role="status"
          aria-live="polite"
          className={`text-sm ${state.status === "error" ? "text-red-400" : bar ? "text-gray-200" : "text-gray-500"}`}
        >
          {pending ? t("running") : message}
        </p>
      </div>
      {!bar && <p className="mt-2 text-xs text-gray-400">{t("ends", { date: endDate })}</p>}
    </form>
  );
}
