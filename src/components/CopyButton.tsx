"use client";

import { useState } from "react";

/** Copies a text to the clipboard and says so for a moment. */
export default function CopyButton({
  text,
  label,
  copiedLabel,
  className = "",
}: {
  text: string;
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context or permissions): leave the text selectable on the page.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`rounded-lg border border-gray-200 bg-brand-white px-3 py-1.5 font-accent text-sm font-semibold text-brand-black hover:border-brand-blue hover:text-brand-blue ${className}`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
