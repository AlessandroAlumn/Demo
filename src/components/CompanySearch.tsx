"use client";

import { useMemo, useState } from "react";

export type CompanyOption = { name: string; matches: boolean; platform: string | null };

/** Type-ahead over the (mock) list of employers that match donations. */
export default function CompanySearch({
  companies,
  labels,
}: {
  companies: CompanyOption[];
  labels: {
    placeholder: string;
    hint: string;
    matches: string;
    noMatch: string;
    /** Templates with a {platform} / {query} placeholder (functions cannot cross into a client component). */
    via: string;
    none: string;
  };
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const results = useMemo(
    () => (q.length < 2 ? [] : companies.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8)),
    [companies, q],
  );

  return (
    <div>
      <label htmlFor="company" className="sr-only">
        {labels.placeholder}
      </label>
      <input
        id="company"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={labels.placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-gray-200 bg-brand-white px-3 py-2.5 text-brand-text outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
      />
      {q.length < 2 ? (
        <p className="mt-2 text-xs text-gray-400">{labels.hint}</p>
      ) : results.length === 0 ? (
        <p className="mt-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600" role="status">
          {labels.none.replace("{query}", query.trim())}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-brand-white" role="status">
          {results.map((c) => (
            <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="font-medium text-brand-black">{c.name}</span>
              <span className="flex items-center gap-2">
                {c.matches && c.platform && <span className="text-xs text-gray-400">{labels.via.replace("{platform}", c.platform)}</span>}
                <span
                  className={`rounded-full px-2.5 py-0.5 font-accent text-xs font-semibold ${
                    c.matches ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {c.matches ? labels.matches : labels.noMatch}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
