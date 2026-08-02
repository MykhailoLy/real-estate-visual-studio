"use client";

import { Download, Share2 } from "lucide-react";

type PropertyShowcaseActionsProps = {
  title: string;
  brochureUrl?: string;
};

export default function PropertyShowcaseActions({
  title,
  brochureUrl,
}: PropertyShowcaseActionsProps) {
  const shareProperty = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      // Closing the native share sheet or denying clipboard access needs no error UI.
    }
  };

  return (
    <div className="absolute right-4 top-4 flex gap-2 sm:right-6 sm:top-6 lg:right-10">
      <button
        type="button"
        onClick={shareProperty}
        aria-label="Share this property"
        className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur transition hover:bg-black/40"
      >
        <Share2 className="h-4 w-4" aria-hidden />
      </button>
      {brochureUrl ? (
        <a
          href={brochureUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Download property brochure"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur transition hover:bg-black/40"
        >
          <Download className="h-4 w-4" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
