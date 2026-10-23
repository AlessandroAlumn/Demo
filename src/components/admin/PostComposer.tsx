"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createPostAction, type PostFormState } from "@/app/[locale]/(app)/admin/posts/actions";

/** Bilingual composer with a live preview of how the post reads in each language. */
export default function PostComposer({ today }: { today: string }) {
  const t = useTranslations("Admin.posts");
  const [state, action, pending] = useActionState<PostFormState, FormData>(createPostAction, { status: "idle" });
  const errors = state.status === "error" ? state.errors : {};
  const [kind, setKind] = useState<"news" | "campaign">("news");
  const [v, setV] = useState({ titleEs: "", titleEn: "", bodyEs: "", bodyEn: "", goalAmount: "" });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));

  const input = "mt-1 w-full rounded-lg border border-gray-200 bg-brand-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30";
  const label = "font-accent text-sm font-semibold text-brand-black";
  const err = (k: string) => (errors[k] ? <p className="mt-1 text-xs text-red-700">{t(`errors.${errors[k]}` as never)}</p> : null);

  const preview = (lang: "Es" | "En") => {
    const title = v[`title${lang}`];
    const body = v[`body${lang}`];
    return (
      <div className="rounded-xl border border-gray-200 bg-brand-white p-4">
        <p className="font-accent text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t(`preview${lang}`)}</p>
        <p className="mt-1 text-sm font-medium text-brand-black">{kind === "campaign" ? "📣 " : "📰 "}{title || "…"}</p>
        <p className="mt-1 text-sm font-light text-gray-500">{body || "…"}</p>
        {kind === "campaign" && (
          <div className="mt-2 h-2 max-w-xs overflow-hidden rounded-full bg-gray-100" aria-hidden>
            <div className="h-full w-1/3 rounded-full bg-brand-yellow" />
          </div>
        )}
      </div>
    );
  };

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-gray-200 bg-brand-white p-6 shadow-sm">
      <h2 className="text-xl text-brand-black">{t("newTitle")}</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="kind" className={label}>{t("kind")}</label>
          <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as "news" | "campaign")} className={input}>
            <option value="news">{t("kinds.news")}</option>
            <option value="campaign">{t("kinds.campaign")}</option>
          </select>
        </div>
        <div>
          <label htmlFor="publishedAt" className={label}>{t("publishedAt")}</label>
          <input id="publishedAt" name="publishedAt" type="date" placeholder={today} className={input} />
          {err("publishedAt")}
        </div>
      </div>
      <p className="-mt-2 text-xs text-gray-400">{t("publishedAtHelp")}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="titleEs" className={label}>{t("titleEs")}</label>
          <input id="titleEs" name="titleEs" value={v.titleEs} onChange={set("titleEs")} className={input} />
          {err("titleEs")}
        </div>
        <div>
          <label htmlFor="titleEn" className={label}>{t("titleEn")}</label>
          <input id="titleEn" name="titleEn" value={v.titleEn} onChange={set("titleEn")} className={input} />
          {err("titleEn")}
        </div>
        <div>
          <label htmlFor="bodyEs" className={label}>{t("bodyEs")}</label>
          <textarea id="bodyEs" name="bodyEs" rows={3} value={v.bodyEs} onChange={set("bodyEs")} className={input} />
          {err("bodyEs")}
        </div>
        <div>
          <label htmlFor="bodyEn" className={label}>{t("bodyEn")}</label>
          <textarea id="bodyEn" name="bodyEn" rows={3} value={v.bodyEn} onChange={set("bodyEn")} className={input} />
          {err("bodyEn")}
        </div>
      </div>

      {kind === "campaign" && (
        <div className="grid gap-4 rounded-xl bg-gray-50 p-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="campaign" className={label}>{t("campaignSlug")}</label>
            <input id="campaign" name="campaign" placeholder="emergencia-sismo-2026" className={input} />
            <p className="mt-1 text-xs text-gray-400">{t("campaignSlugHelp")}</p>
            {err("campaign")}
          </div>
          <div>
            <label htmlFor="goalAmount" className={label}>{t("goal")}</label>
            <input id="goalAmount" name="goalAmount" type="number" min="1" step="any" value={v.goalAmount} onChange={set("goalAmount")} className={input} />
            {err("goalAmount")}
          </div>
          <div className="grid grid-cols-2 gap-2 md:col-span-4">
            <div>
              <label htmlFor="startDate" className={label}>{t("start")}</label>
              <input id="startDate" name="startDate" type="date" className={input} />
              {err("startDate")}
            </div>
            <div>
              <label htmlFor="endDate" className={label}>{t("end")}</label>
              <input id="endDate" name="endDate" type="date" className={input} />
              {err("endDate")}
            </div>
          </div>
        </div>
      )}

      <div>
        <p className={label}>{t("preview")}</p>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {preview("Es")}
          {preview("En")}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-yellow px-5 py-2.5 font-accent font-semibold text-brand-black hover:brightness-95 disabled:opacity-60">
          {t("publish")}
        </button>
        {state.status === "created" && (
          <p role="status" className="text-sm font-medium text-green-800">
            ✓ {t("created")}
          </p>
        )}
      </div>
    </form>
  );
}
