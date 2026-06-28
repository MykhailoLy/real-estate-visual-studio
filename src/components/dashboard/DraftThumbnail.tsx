"use client";

import { useState } from "react";
import { FileImage } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSavedDraftThumbnailExtraCount } from "@/lib/order-drafts/saved-drafts";
import type { OrderDraftSummary } from "@/lib/order-drafts/types";

export default function DraftThumbnail({
  draft,
  title,
  className,
}: {
  draft: OrderDraftSummary;
  title: string;
  className?: string;
}) {
  const previewUrl = draft.thumbnail?.previewUrl ?? null;
  const extraCount = getSavedDraftThumbnailExtraCount(draft);

  return (
    <DraftThumbnailContent
      key={previewUrl ?? "empty"}
      previewUrl={previewUrl}
      alt={draft.thumbnail?.originalFilename ?? title}
      extraCount={extraCount}
      className={className}
    />
  );
}

function DraftThumbnailContent({
  previewUrl,
  alt,
  extraCount,
  className,
}: {
  previewUrl: string | null;
  alt: string;
  extraCount: number;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);

  return (
    <div
      className={cn(
        "relative aspect-video w-full shrink-0 self-start overflow-hidden rounded-md border border-border bg-stone-100 sm:h-[102px] sm:w-[136px] sm:aspect-[4/3]",
        className,
      )}
    >
      {previewUrl && !broken ? (
        <>
          {!loaded && (
            <span className="absolute inset-0 animate-pulse bg-stone-100" />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setBroken(true)}
            className="h-full w-full object-cover"
          />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <FileImage className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
      )}
      {extraCount > 0 && (
        <span className="absolute bottom-2 right-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white shadow-sm">
          +{extraCount}
        </span>
      )}
    </div>
  );
}
