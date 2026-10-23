// Helpers for sharing a badge: the donation link with the donor's referral code, the share URL of each
// network, and alias cleanup. Pure, so it is easy to test.

import type { ShareNetwork } from "./constants";

export const DONATE_BASE = "https://alumnusb.org/dona";
export const ALIAS_MAX_LENGTH = 30;

/** The donate link; with a code the "referred a friend" badges can be credited. */
export function referralLink(code: string | null | undefined): string {
  return code ? `${DONATE_BASE}?ref=${encodeURIComponent(code)}` : DONATE_BASE;
}

/**
 * Share URLs per network. Only WhatsApp and X accept a prefilled message; Facebook and LinkedIn share just
 * the link. Instagram has no web share URL: the user downloads the story image instead.
 */
export function shareLinks(text: string, url: string): Record<Exclude<ShareNetwork, "instagram">, string> {
  const message = `${text} ${url}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  };
}

/** Trims, collapses spaces, strips angle brackets and caps the length. Empty means "no alias". */
export function normalizeAlias(input: string): string | null {
  const cleaned = input.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, ALIAS_MAX_LENGTH).trim();
  return cleaned === "" ? null : cleaned;
}
