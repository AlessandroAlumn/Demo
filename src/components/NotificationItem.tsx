import { Link } from "@/i18n/navigation";
import { markReadAction } from "@/app/[locale]/(app)/feed/actions";
import type { RenderedNotification } from "@/lib/render-notification";
import ProgressBar from "./ProgressBar";

const TONES: Record<RenderedNotification["tone"], string> = {
  good: "border-brand-yellow bg-brand-yellow-soft",
  warn: "border-red-200 bg-red-50",
  info: "border-gray-200 bg-brand-white",
  neutral: "border-gray-200 bg-brand-white",
};

/** One feed entry: icon, text, optional detail / progress bar / button, date and read state. */
export default function NotificationItem({
  item,
  dateLabel,
  markReadLabel,
  progressLabel,
  unreadLabel,
}: {
  item: RenderedNotification;
  dateLabel: string;
  /** Shown only in the feed (the bell has its own "mark all"). */
  markReadLabel?: string;
  /** Caption under a campaign progress bar, e.g. "$900 of $1,800". */
  progressLabel?: string;
  /** Accessible name of the unread dot. */
  unreadLabel?: string;
}) {
  return (
    <li className={`relative flex gap-3 rounded-xl border p-4 ${TONES[item.tone]} ${item.read ? "opacity-80" : ""}`}>
      <span aria-hidden className="text-2xl leading-none">
        {item.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-brand-black">
          {!item.read && (
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-blue align-middle" aria-label={unreadLabel} />
          )}
          {item.text}
        </p>
        {item.detail && <p className="mt-1 text-sm font-light text-gray-500">{item.detail}</p>}
        {item.progress && (
          <div className="mt-2 max-w-sm">
            <ProgressBar value={item.progress.raised} max={item.progress.goal} label={progressLabel} />
            {progressLabel && <p className="mt-1 text-xs text-gray-400">{progressLabel}</p>}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
          <time dateTime={item.date}>{dateLabel}</time>
          {item.cta &&
            (item.cta.external ? (
              <a href={item.cta.href} className="font-accent text-sm font-semibold text-brand-blue hover:underline">
                {item.cta.label} →
              </a>
            ) : (
              <Link href={item.cta.href} className="font-accent text-sm font-semibold text-brand-blue hover:underline">
                {item.cta.label} →
              </Link>
            ))}
          {markReadLabel && !item.read && (
            <form action={markReadAction}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="hover:text-brand-blue hover:underline">
                {markReadLabel}
              </button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
