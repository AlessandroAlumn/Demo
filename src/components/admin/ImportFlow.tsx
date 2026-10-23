"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  confirmImportAction,
  previewImportAction,
  type ImportState,
} from "@/app/[locale]/(app)/admin/import/actions";
import type { ImportIssue, ImportSection } from "@/lib/importer";

type Report = Extract<ImportState, { stage: "preview" | "done" }>["report"];
type Totals = { donations: number; subscriptions: number };

function Section({ title, section, issueTotal }: { title: string; section: ImportSection; issueTotal: number }) {
  const t = useTranslations("Admin.import");
  if (section.total === 0 && section.issues.length === 0) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-brand-white p-4">
      <h3 className="font-accent text-sm font-semibold text-brand-black">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{t("rows", { total: section.total, valid: section.valid })}</p>
      <p className="mt-1 text-sm font-medium">{t("counts", { new: section.new, updated: section.updated, unchanged: section.unchanged })}</p>
      {section.removed > 0 && <p className="text-sm text-gray-500">{t("removed", { n: section.removed })}</p>}
      {issueTotal > 0 && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
          <p className="font-semibold">{t("problems", { n: issueTotal })}</p>
          <p className="text-xs">{t("skipNote")}</p>
          <ul className="mt-2 space-y-0.5 text-xs">
            {section.issues.map((i: ImportIssue, idx: number) => (
              <li key={idx}>
                {t("line", { row: i.row })}
                {i.field ? ` [${i.field}]` : ""}: {i.message}
              </li>
            ))}
          </ul>
          {issueTotal > section.issues.length && (
            <p className="mt-1 text-xs">{t("showing", { shown: section.issues.length, total: issueTotal })}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ReportView({ report, totals }: { report: Report; totals: Totals }) {
  const t = useTranslations("Admin.import");
  return (
    <div className="space-y-3">
      <Section title={t("donations")} section={report.donations} issueTotal={totals.donations} />
      <Section title={t("subscriptions")} section={report.subscriptions} issueTotal={totals.subscriptions} />
      <p className="text-sm text-gray-600">{t("donors", { new: report.donors.new, updated: report.donors.updated })}</p>
    </div>
  );
}

/** Upload, then preview, then confirm. Nothing is saved until the confirm step. */
export default function ImportFlow() {
  const t = useTranslations("Admin.import");
  const [preview, previewAction, previewing] = useActionState<ImportState, FormData>(previewImportAction, { stage: "idle" });
  const [done, confirmAction, importing] = useActionState<ImportState, FormData>(confirmImportAction, { stage: "idle" });

  const finished = done.stage === "done" ? done : null;
  const shown = finished ?? (preview.stage === "preview" ? preview : null);
  const error = done.stage === "error" ? done.error : preview.stage === "error" ? preview.error : null;
  const file =
    "mt-1 block w-full rounded-lg border border-gray-200 bg-brand-white text-sm file:mr-3 file:rounded-l-lg file:border-0 file:bg-brand-black file:px-3 file:py-2 file:font-accent file:text-sm file:font-semibold file:text-brand-white";

  return (
    <div className="space-y-6">
      <form action={previewAction} className="space-y-4 rounded-2xl border border-gray-200 bg-brand-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="donations" className="font-accent text-sm font-semibold text-brand-black">
              {t("donationsFile")}
            </label>
            <input id="donations" name="donations" type="file" accept=".csv,text/csv" className={file} />
          </div>
          <div>
            <label htmlFor="subscriptions" className="font-accent text-sm font-semibold text-brand-black">
              {t("subscriptionsFile")}
            </label>
            <input id="subscriptions" name="subscriptions" type="file" accept=".csv,text/csv" className={file} />
          </div>
        </div>
        <p className="text-xs text-gray-400">{t("optional")}</p>
        <button
          type="submit"
          disabled={previewing || importing}
          className="rounded-lg bg-brand-yellow px-5 py-2.5 font-accent font-semibold text-brand-black hover:brightness-95 disabled:opacity-60"
        >
          {t("preview")}
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {t(`errors.${error}`)}
        </p>
      )}

      {shown && (
        <section className="space-y-4 rounded-2xl border border-gray-200 bg-brand-white p-5 shadow-sm">
          <h2 className="text-xl text-brand-black">{finished ? t("doneTitle") : t("previewTitle")}</h2>
          <ReportView report={shown.report} totals={shown.issueTotals} />
          {finished ? (
            <p className="rounded-lg bg-brand-yellow-soft px-3 py-2 text-sm text-gray-600">{t("after")}</p>
          ) : (
            preview.stage === "preview" && (
              <form action={confirmAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="token" value={preview.token} />
                <button
                  type="submit"
                  disabled={importing}
                  className="rounded-lg bg-brand-black px-5 py-2.5 font-accent font-semibold text-brand-white hover:bg-gray-500 disabled:opacity-60"
                >
                  {t("confirm")}
                </button>
              </form>
            )
          )}
        </section>
      )}
    </div>
  );
}
