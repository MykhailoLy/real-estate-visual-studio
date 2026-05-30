"use client";

/**
 * FloorPlansInteractive.tsx
 *
 * Two named "use client" components used by /pricing/floor-plans:
 *
 *   PortfolioExamplesGrid
 *     Renders the "What it is" before/after portfolio cards.
 *     Clicking any card with real images opens ImageLightbox
 *     showing both the before and after image.
 *
 *   StyleOptionsGrid
 *     Renders the "Style options" plan option cards.
 *     Each card shows one admin-uploaded image or a CSS placeholder.
 *     Clicking a card with a real image opens ImageLightbox.
 *     CSS-placeholder-only cards are non-interactive.
 *
 * Both components are independently stateful (each owns its own
 * lightbox state). Placing them in the same file is a convenience;
 * they are imported as named exports in page.tsx.
 *
 * The ImageLightbox at src/components/pricing/ImageLightbox.tsx
 * is reused unchanged — it already handles Escape, backdrop-click,
 * body-scroll-lock, and keyboard navigation.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import ImageLightbox from "@/components/pricing/ImageLightbox";

// ── Shared types (exported so page.tsx can build the props) ───

export interface PortfolioExampleCard {
  id: string;
  title: string;
  description: string | null;
  beforeUrl: string | null;
  afterUrl: string | null;
  beforeAlt: string;
  afterAlt: string;
}

export interface StyleOptionCard {
  /** 1-based position matching sort_order in site_media_items. */
  sortOrder: number;
  title: string;
  description: string;
  /** Resolved public URL from admin-uploaded image, or null. */
  imageUrl: string | null;
  imageAlt: string;
  /** CSS placeholder variant key used when imageUrl is null. */
  placeholderVariant: string;
}

// ── CSS placeholder visuals for style option cards ────────────
// A minimal gradient / texture per style so the cards look
// intentional even before real images are uploaded.

const PLACEHOLDER_BG: Record<string, string> = {
  modern: "bg-gradient-to-br from-stone-100 via-stone-50 to-stone-200",
  scandinavian: "bg-gradient-to-br from-sky-50 via-stone-50 to-white",
  minimal: "bg-white",
  classic: "bg-gradient-to-br from-amber-50 via-stone-100 to-stone-200",
  luxury: "bg-gradient-to-br from-stone-800 via-stone-700 to-stone-900",
  editorial: "bg-gradient-to-br from-rose-50 via-amber-50 to-stone-100",
  "clean-bw": "bg-white",
  "soft-color": "bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50",
  presentation: "bg-gradient-to-br from-primary/10 via-stone-50 to-secondary/10",
};

function StylePlaceholder({ variant, label }: { variant: string; label: string }) {
  const bg = PLACEHOLDER_BG[variant] ?? PLACEHOLDER_BG.modern;
  const isDark = variant === "luxury";
  return (
    <div className={`absolute inset-0 ${bg} flex items-center justify-center`}>
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,36,64,0.3) 1px,transparent 1px)," +
            "linear-gradient(90deg,rgba(15,36,64,0.3) 1px,transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      <span
        className={cn(
          "relative z-10 text-[11px] font-semibold tracking-[0.18em] uppercase px-3 py-1 rounded-full",
          isDark
            ? "text-white/80 bg-white/10"
            : "text-muted bg-white/70 backdrop-blur"
        )}
      >
        {label}
      </span>
    </div>
  );
}

// ── PortfolioExamplesGrid ─────────────────────────────────────

interface PortfolioGridProps {
  cards: PortfolioExampleCard[];
}

export function PortfolioExamplesGrid({ cards }: PortfolioGridProps) {
  const [open, setOpen] = useState<PortfolioExampleCard | null>(null);

  if (cards.length === 0) {
    return (
      <div className="relative aspect-[5/2] w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-stone-200 bg-stone-100 flex items-center justify-center">
        <span className="text-xs font-medium tracking-[0.15em] uppercase text-muted">
          Floor plan examples
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {cards.map((card) => {
          const hasImages = Boolean(card.beforeUrl && card.afterUrl);
          return (
            <article
              key={card.id}
              className="group bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
            >
              {/* Image area */}
              <button
                type="button"
                disabled={!hasImages}
                aria-label={
                  hasImages ? `View ${card.title} — before and after` : undefined
                }
                onClick={() => hasImages && setOpen(card)}
                className={cn(
                  "w-full aspect-[5/2] relative overflow-hidden bg-stone-100 block",
                  hasImages
                    ? "cursor-zoom-in focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                    : "cursor-default"
                )}
              >
                {hasImages ? (
                  <div className="absolute inset-0 flex">
                    {/* Before half — object-contain with white bg so plans are fully visible */}
                    <div className="relative w-1/2 overflow-hidden bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={card.beforeUrl!}
                        alt={card.beforeAlt}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-contain p-2 sm:p-3"
                      />
                      <span className="absolute bottom-2.5 left-2.5 inline-flex items-center px-2 py-0.5 rounded-full bg-white/90 backdrop-blur text-[9px] font-bold tracking-[0.18em] uppercase text-stone-700 shadow-sm">
                        Before
                      </span>
                    </div>
                    {/* After half — object-contain with white bg */}
                    <div className="relative w-1/2 overflow-hidden bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={card.afterUrl!}
                        alt={card.afterAlt}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-contain p-2 sm:p-3"
                      />
                      <span className="absolute bottom-2.5 right-2.5 inline-flex items-center px-2 py-0.5 rounded-full bg-white/90 backdrop-blur text-[9px] font-bold tracking-[0.18em] uppercase text-primary shadow-sm">
                        After
                      </span>
                    </div>
                    {/* Centerline */}
                    <div
                      aria-hidden
                      className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center">
                        <svg
                          viewBox="0 0 12 12"
                          className="w-3 h-3 text-primary"
                          fill="currentColor"
                          aria-hidden
                        >
                          <path d="M3 1L0 6l3 5V1zm6 0v10l3-5-3-5z" />
                        </svg>
                      </div>
                    </div>
                    {/* Hover overlay */}
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors"
                    />
                    <span
                      aria-hidden
                      className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur text-primary flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    >
                      ⤢
                    </span>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
                    <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted">
                      {card.title}
                    </span>
                  </div>
                )}
              </button>

              <div className="p-5 lg:p-6">
                <h3 className="text-base lg:text-lg font-bold text-primary tracking-tight">
                  {card.title}
                </h3>
                {card.description && (
                  <p className="mt-1.5 text-sm text-muted leading-relaxed line-clamp-3">
                    {card.description}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Lightbox */}
      {open && (() => {
        const imgs = [
          ...(open.beforeUrl ? [{ src: open.beforeUrl, alt: open.beforeAlt }] : []),
          ...(open.afterUrl ? [{ src: open.afterUrl, alt: open.afterAlt }] : []),
        ];
        return imgs.length > 0 ? (
          <ImageLightbox
            key={`portfolio-${open.id}`}
            images={imgs}
            title={open.title}
            onClose={() => setOpen(null)}
          />
        ) : null;
      })()}
    </>
  );
}

// ── StyleOptionsGrid ──────────────────────────────────────────

interface StyleGridProps {
  cards: StyleOptionCard[];
}

export function StyleOptionsGrid({ cards }: StyleGridProps) {
  const [open, setOpen] = useState<StyleOptionCard | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
        {cards.map((card) => {
          const hasImage = Boolean(card.imageUrl);
          return (
            <div
              key={card.sortOrder}
              className="group bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <button
                type="button"
                disabled={!hasImage}
                aria-label={hasImage ? `View ${card.title} example` : undefined}
                onClick={() => hasImage && setOpen(card)}
                className={cn(
                  "w-full relative aspect-video overflow-hidden bg-white block",
                  hasImage
                    ? "cursor-zoom-in focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                    : "cursor-default"
                )}
              >
                {hasImage ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.imageUrl!}
                      alt={card.imageAlt}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-contain p-2 sm:p-3"
                    />
                    <span
                      aria-hidden
                      className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur text-primary flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    >
                      ⤢
                    </span>
                  </>
                ) : (
                  <StylePlaceholder
                    variant={card.placeholderVariant}
                    label={card.title}
                  />
                )}
              </button>

              <div className="px-4 py-3.5 lg:px-5 lg:py-4">
                <h3 className="text-sm lg:text-base font-bold text-primary tracking-tight leading-tight">
                  {card.title}
                </h3>
                <p className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-2">
                  {card.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {open?.imageUrl && (
        <ImageLightbox
          key={`style-${open.sortOrder}`}
          images={[{ src: open.imageUrl, alt: open.imageAlt }]}
          title={open.title}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
