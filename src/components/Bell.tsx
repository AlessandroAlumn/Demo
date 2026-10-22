"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { markAllReadAction } from "@/app/[locale]/(app)/feed/actions";

export type BellItem = {
  id: string;
  icon: string;
  text: string;
  detail?: string;
  dateLabel: string;
  read: boolean;
};

/** Notification bell: unread count and a dropdown with the latest items. */
export default function Bell({
  items,
  unread,
  labels,
}: {
  items: BellItem[];
  unread: number;
  labels: { title: string; markAllRead: string; empty: string; seeAll: string };
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={labels.title}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full border border-gray-400 px-2.5 py-1 text-base hover:bg-gray-500"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-brand-yellow px-1 text-center font-accent text-[11px] font-bold leading-5 text-brand-black">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-gray-200 bg-brand-white text-brand-text shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <p className="font-accent text-sm font-semibold text-brand-black">{labels.title}</p>
            {unread > 0 && (
              <form action={markAllReadAction}>
                <button type="submit" className="text-xs text-brand-blue hover:underline">
                  {labels.markAllRead}
                </button>
              </form>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">{labels.empty}</p>
          ) : (
            <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className={`flex gap-3 px-4 py-3 text-sm ${item.read ? "" : "bg-brand-yellow-soft/60"}`}>
                  <span aria-hidden className="text-lg leading-none">
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-brand-black">{item.text}</p>
                    {item.detail && <p className="mt-0.5 text-xs font-light text-gray-500">{item.detail}</p>}
                    <p className="mt-1 text-xs text-gray-400">{item.dateLabel}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/feed"
            onClick={() => setOpen(false)}
            className="block border-t border-gray-100 px-4 py-2.5 text-center font-accent text-sm font-semibold text-brand-blue hover:bg-gray-50"
          >
            {labels.seeAll}
          </Link>
        </div>
      )}
    </div>
  );
}
