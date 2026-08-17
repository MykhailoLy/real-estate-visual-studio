"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceOptionMedia } from "@/lib/site-media";
import {
  STAGING_STYLE_CARDS,
  type StagingStyleCard,
} from "@/data/order-options";
import ExampleDialog from "./ExampleDialog";
import {
  hasExampleMedia,
  resolveFurnitureStyleThumbnail,
} from "./virtual-staging-style-state";

interface StyleSelectorProps {
  value: string;
  onChange: (label: string) => void;
  mediaByKey: Record<string, ServiceOptionMedia>;
  groupName?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  disabled?: boolean;
}

/** Global visual selector used once for the complete Virtual Staging order. */
export default function StyleSelector({
  value,
  onChange,
  mediaByKey,
  groupName,
  ariaLabelledBy,
  ariaDescribedBy,
  ariaInvalid = false,
  disabled = false,
}: StyleSelectorProps) {
  const [previewMediaKey, setPreviewMediaKey] = useState<string | null>(null);
  const previewCard = STAGING_STYLE_CARDS.find(
    (card) => card.mediaKey === previewMediaKey,
  );
  const previewMedia = previewCard
    ? mediaByKey[previewCard.mediaKey] ?? null
    : null;

  return (
    <>
      <div
        role="radiogroup"
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabelledBy ? undefined : "Furniture style for entire order"}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5"
      >
        {STAGING_STYLE_CARDS.map((card, index) => (
          <StyleCard
            key={card.label}
            card={card}
            media={mediaByKey[card.mediaKey] ?? null}
            selected={value === card.label}
            onSelect={() => onChange(card.label)}
            onPreview={() => setPreviewMediaKey(card.mediaKey)}
            groupName={groupName}
            disabled={disabled}
            validationControl={index === 0}
          />
        ))}
      </div>

      {previewCard ? (
        <ExampleDialog
          open={Boolean(previewMediaKey)}
          onOpenChange={(open) => {
            if (!open) setPreviewMediaKey(null);
          }}
          title={`${previewCard.label} furniture style`}
          description={
            previewMedia?.description?.trim() || previewCard.description
          }
          media={previewMedia}
        />
      ) : null}
    </>
  );
}

function StyleCard({
  card,
  media,
  selected,
  onSelect,
  onPreview,
  groupName,
  disabled,
  validationControl,
}: {
  card: StagingStyleCard;
  media: ServiceOptionMedia | null;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  groupName?: string;
  disabled: boolean;
  validationControl: boolean;
}) {
  const [adminImageFailed, setAdminImageFailed] = useState(false);
  const [staticImageFailed, setStaticImageFailed] = useState(false);
  const adminThumbnailUrl = resolveFurnitureStyleThumbnail(media, null);
  const hasPreview = hasExampleMedia(media);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-white transition-all",
        "focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-1",
        selected
          ? "border-primary ring-2 ring-primary/30 shadow-sm"
          : "border-border hover:border-primary/40 hover:shadow-sm",
        disabled && "opacity-60",
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={card.label}
        data-style={card.label}
        data-group={groupName}
        data-validation-control={validationControl ? "" : undefined}
        disabled={disabled}
        onClick={onSelect}
        className="flex h-full w-full flex-col text-left focus-visible:outline-none disabled:cursor-not-allowed"
      >
        <span className="relative block aspect-[4/3] w-full bg-stone-100">
          {adminThumbnailUrl && !adminImageFailed ? (
            <Image
              src={adminThumbnailUrl}
              alt={media?.altText?.trim() || `${card.label} furniture example`}
              fill
              loading="lazy"
              sizes="(min-width: 1280px) 18vw, (min-width: 768px) 30vw, 48vw"
              onError={() => setAdminImageFailed(true)}
              className="object-cover"
            />
          ) : !staticImageFailed ? (
            // The legacy public path remains a graceful fallback. These files
            // are optional, so a failed request becomes a named placeholder.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.imageSrc}
              alt={card.label}
              loading="lazy"
              onError={() => setStaticImageFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-stone-100 via-stone-50 to-stone-200">
              <span className="px-2 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground/75">
                {card.label}
              </span>
            </span>
          )}
        </span>
        <span
          className={cn(
            "flex min-h-12 w-full flex-1 items-center border-t px-2.5 py-2 pr-10 text-xs font-medium",
            selected
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-border text-foreground",
          )}
        >
          {card.label}
        </span>
      </button>

      <button
        type="button"
        onClick={onPreview}
        disabled={!hasPreview}
        aria-label={`View ${card.label} style example`}
        title={hasPreview ? `View ${card.label} style example` : "Example not available yet"}
        className="absolute bottom-0.5 right-0.5 grid h-11 w-11 place-items-center rounded-full border border-border bg-white/95 text-primary shadow-sm transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
      </button>

      {selected ? (
        <span
          className="pointer-events-none absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-white shadow-sm"
          aria-hidden="true"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      ) : null}
    </div>
  );
}
