"use client";

import { Download, Share2 } from "lucide-react";

type PropertyShowcaseActionsProps = {
  title: string;
  text: string;
  canonicalUrl: string;
  brochureUrl?: string;
  showShare?: boolean;
  onShare?: () => void;
  onBrochureDownload?: () => void;
};

export default function PropertyShowcaseActions({
  title,
  text,
  canonicalUrl,
  brochureUrl,
  showShare = true,
  onShare,
  onBrochureDownload,
}: PropertyShowcaseActionsProps) {
  const shareProperty = async () => {
    onShare?.();
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: canonicalUrl });
        return;
      }
      await navigator.clipboard.writeText(
        [text, canonicalUrl].filter(Boolean).join("\n"),
      );
    } catch {
      // Closing the native share sheet or denying clipboard access needs no error UI.
    }
  };

  return (
    <div className="absolute right-4 top-4 flex gap-2 sm:right-6 sm:top-6 lg:right-10">
      {showShare ? (
        <button
          type="button"
          onClick={shareProperty}
          aria-label="Share this property"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur transition hover:bg-black/40 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
        >
          <Share2 className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
      {brochureUrl ? (
        <a
          href={brochureUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Download property brochure"
          onClick={onBrochureDownload}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur transition hover:bg-black/40"
        >
          <Download className="h-4 w-4" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
