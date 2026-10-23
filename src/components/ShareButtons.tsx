"use client";

import { startTransition } from "react";
import { recordShareAction } from "@/app/[locale]/(app)/share/actions";

type Network = "whatsapp" | "x" | "facebook" | "linkedin";

/**
 * One button per network. Each opens the network's share page in a new tab and, at the same time,
 * records the share (it earns the Proud Supporter badge). The Instagram button downloads the story image.
 */
export default function ShareButtons({
  badgeId,
  links,
  labels,
  storyUrl,
  cardUrl,
}: {
  badgeId: string;
  links: Record<Network, string>;
  labels: { shareOn: string; networks: Record<Network, string>; instagram: string; instagramHint: string; downloadCard: string };
  storyUrl: string;
  cardUrl: string;
}) {
  const record = (network: string) => startTransition(() => void recordShareAction(badgeId, network));
  const button =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 font-accent text-sm font-semibold transition hover:brightness-95";

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 font-accent text-xs font-semibold uppercase tracking-wide text-gray-400">{labels.shareOn}</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(links) as Network[]).map((network) => (
            <a
              key={network}
              href={links[network]}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => record(network)}
              className={`${button} bg-brand-black text-brand-white`}
            >
              {labels.networks[network]}
            </a>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={storyUrl}
          download
          onClick={() => record("instagram")}
          className={`${button} bg-brand-yellow text-brand-black`}
        >
          {labels.instagram}
        </a>
        <a href={cardUrl} download className={`${button} border border-gray-200 bg-brand-white text-brand-black`}>
          {labels.downloadCard}
        </a>
      </div>
      <p className="text-xs text-gray-400">{labels.instagramHint}</p>
    </div>
  );
}
