// ============================================================
// GalleryCategoryCard — full-bleed image card for gallery landing
//
// Shows a category image with a dark gradient overlay and white
// title + description text. The entire card is a single <Link>
// so keyboard and pointer users can activate it anywhere.
//
// Image is an admin-uploaded portfolio after-image. Falls back
// to a CSS gradient placeholder when the Supabase URL is not
// yet available (e.g. fresh deploy without secrets).
// ============================================================

import Link from "next/link";
import Image from "next/image";

interface GalleryCategoryCardProps {
  /** Target gallery detail URL, e.g. /gallery/virtual-staging */
  href: string;
  /** Public URL of the representative image (after-image). Null → placeholder. */
  imageUrl: string | null;
  /** Alt text for the representative image. */
  imageAlt: string;
  /** Service display label, rendered as the card heading. */
  title: string;
  /** One-sentence description rendered beneath the title. */
  description: string;
}

export default function GalleryCategoryCard({
  href,
  imageUrl,
  imageAlt,
  title,
  description,
}: GalleryCategoryCardProps) {
  return (
    <Link
      href={href}
      className="group relative block rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shadow-sm hover:shadow-xl transition-shadow duration-300"
    >
      {/* ── Image / placeholder ──────────────────────────── */}
      <div className="aspect-[4/3] relative bg-stone-200 overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            // Cards: 3-up desktop, 2-up tablet, 1-up mobile.
            sizes="(min-width: 1500px) 452px, (min-width: 1024px) calc(33.333vw - 48px), (min-width: 768px) calc(50vw - 34px), calc(100vw - 32px)"
            className="object-cover transition-transform duration-500 will-change-transform group-hover:scale-[1.04]"
          />
        ) : (
          /* Placeholder gradient when no image URL is available */
          <div className="absolute inset-0 bg-gradient-to-br from-stone-300 via-stone-200 to-stone-300" />
        )}

        {/* ── Dark gradient overlay (always present) ───────── */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10 transition-opacity duration-300 group-hover:from-black/85 group-hover:via-black/40"
        />

        {/* ── Text content over gradient ───────────────────── */}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-white leading-tight mb-1.5 tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-white/80 leading-relaxed line-clamp-2">
            {description}
          </p>
          {/* Subtle "View gallery →" cue */}
          <p
            aria-hidden
            className="mt-3 text-[11px] font-bold tracking-[0.16em] uppercase text-white/60 group-hover:text-white/90 transition-colors duration-200"
          >
            View gallery →
          </p>
        </div>
      </div>
    </Link>
  );
}
