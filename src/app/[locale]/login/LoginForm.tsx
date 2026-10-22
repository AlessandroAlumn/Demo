"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { loginAction, type LoginState } from "./actions";

const DEMO_USERS = [...Array.from({ length: 20 }, (_, i) => `User${i + 1}`), "admin"];

export default function LoginForm() {
  const t = useTranslations("Login");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [username, setUsername] = useState("");

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />

      <div>
        <label htmlFor="username" className="block font-accent text-sm font-semibold text-brand-black">
          {t("username")}
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-brand-white px-3 py-2 text-brand-text outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
        />
      </div>

      <div>
        <label htmlFor="password" className="block font-accent text-sm font-semibold text-brand-black">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="off"
          placeholder={t("passwordPlaceholder")}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-brand-text placeholder:text-gray-300 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
        />
        <p className="mt-1 text-xs text-gray-400">{t("demoNote")}</p>
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t(`errors.${state.error}`)}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-yellow px-4 py-2.5 font-accent font-semibold text-brand-black transition hover:brightness-95 disabled:opacity-60"
      >
        {t("submit")}
      </button>

      <div>
        <p className="font-accent text-xs font-semibold uppercase tracking-wide text-gray-400">
          {t("tryUsers")}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DEMO_USERS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUsername(u)}
              className="rounded-full border border-gray-200 bg-brand-white px-2.5 py-1 font-accent text-xs font-medium text-gray-500 hover:border-brand-blue hover:text-brand-blue"
            >
              {u}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
