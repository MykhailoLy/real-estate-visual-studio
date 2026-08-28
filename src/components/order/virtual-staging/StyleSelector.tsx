"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceOptionMedia } from "@/lib/site-media";
import { STAGING_STYLE_CARDS } from "@/data/order-options";
import ExampleDialog from "@/components/order/ExampleDialog";
import {
  hasExampleMedia,
  resolveFurnitureStyleThumbnail,
} from "./virtual-staging-style-state";

export interface VisualStyleCard {
  label: string;
  imageSrc?: string | null;
  mediaKey?: string | null;
  description: string;
}

interface StyleSelectorProps {
  value: string;
  onChange: (label: string) => void;
  mediaByKey: Record<string, ServiceOptionMedia>;
  cards?: readonly VisualStyleCard[];
  groupName?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  disabled?: boolean;
  compact?: boolean;
  previewTitle?: (card: VisualStyleCard) => string;
  imageAlt?: (card: VisualStyleCard) => string;
}

/** Shared visual selector used by staging and compatible service style fields. */
export default function StyleSelector({
  value,
  onChange,
  mediaByKey,
  cards = STAGING_STYLE_CARDS,
  groupName,
  ariaLabelledBy,
  ariaDescribedBy,
  ariaLabel = "Furniture style for entire order",
  ariaInvalid = false,
  disabled = false,
  compact = false,
  previewTitle = (card) => `${card.label} furniture style`,
  imageAlt = (card) => `${card.label} furniture example`,
}: StyleSelectorProps) {
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);
  const previewCard = cards.find((card) => card.label === previewLabel);
  const previewMedia = previewCard?.mediaKey
    ? mediaByKey[previewCard.mediaKey] ?? null
    : null;

  return (
    <>
      <div
        role="radiogroup"
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        className={cn(
          "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 min-[1600px]:grid-cols-5",
          compact ? "gap-2" : "gap-3",
        )}
      >
        {cards.map((card, index) => (
          <StyleCard
            key={card.label}
            card={card}
            media={card.mediaKey ? mediaByKey[card.mediaKey] ?? null : null}
            selected={value === card.label}
            onSelect={() => onChange(card.label)}
            onPreview={() => setPreviewLabel(card.label)}
            groupName={groupName}
            disabled={disabled}
            validationControl={index === 0}
            compact={compact}
            imageAlt={imageAlt(card)}
          />
        ))}
      </div>

      {previewCard ? (
        <ExampleDialog
          open={Boolean(previewLabel)}
          onOpenChange={(open) => {
            if (!open) setPreviewLabel(null);
          }}
          title={previewTitle(previewCard)}
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
  compact,
  imageAlt,
}: {
  card: VisualStyleCard;
  media: ServiceOptionMedia | null;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  groupName?: string;
  disabled: boolean;
  validationControl: boolean;
  compact: boolean;
  imageAlt: string;
}) {
  const [adminImageFailed, setAdminImageFailed] = useState(false);
  const [staticImageFailed, setStaticImageFailed] = useState(false);
  const adminThumbnailUrl = resolveFurnitureStyleThumbnail(media, null);
  const hasPreview = hasExampleMedia(media);
  const hasVisual = Boolean(card.mediaKey || card.imageSrc);

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
        {hasVisual ? (
          <span
            className={cn(
              "relative block w-full bg-stone-100",
              compact ? "aspect-[2/1]" : "aspect-[3/2]",
            )}
          >
            {adminThumbnailUrl && !adminImageFailed ? (
              <Image
                src={adminThumbnailUrl}
                alt={media?.altText?.trim() || imageAlt}
                fill
                loading="lazy"
                sizes="(min-width: 1600px) 14vw, (min-width: 1024px) 19vw, (min-width: 768px) 29vw, 46vw"
                onError={() => setAdminImageFailed(true)}
                className="object-cover"
              />
            ) : card.imageSrc && !staticImageFailed ? (
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
        ) : null}
        <span
          className={cn(
            "flex w-full flex-1 items-center px-3 pr-11 font-medium leading-5",
            compact
              ? hasVisual
                ? "min-h-10 border-t py-1.5 text-xs"
                : "min-h-20 py-3 text-sm"
              : "min-h-12 border-t py-2 text-sm",
            selected
              ? "border-primary/30 bg-primary/5 text-primary"
              : hasVisual
                ? "border-border text-foreground"
                : "text-foreground",
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
        className={cn(
          "absolute bottom-0.5 right-0.5 grid place-items-center rounded-full border border-border bg-white/95 text-primary shadow-sm transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40",
          compact ? "h-10 w-10" : "h-11 w-11",
        )}
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
