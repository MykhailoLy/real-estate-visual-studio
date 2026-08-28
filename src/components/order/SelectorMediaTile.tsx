import Image from "next/image";
import { ImageIcon } from "lucide-react";

// ============================================================
// SelectorMediaTile — 16:9 media frame for Image Enhancement
// type cards and Day Sky Style cards.
//
// Renders an admin-managed service-options image via next/image when
// present (lazy loaded, object-cover, accurate `sizes`), or a branded
// CSS placeholder when no published image exists — so a missing
// service-option key never shows a broken image.
// ============================================================

interface SelectorMediaTileProps {
  /** Public image URL (already resolved from site-media), or null. */
  url: string | null;
  /** Alt text for the image, or a sensible fallback label. */
  alt: string;
  /** Responsive `sizes` hint passed to next/image. */
  sizes?: string;
  /** Rounded corners variant. */
  rounded?: string;
}

export default function SelectorMediaTile({
  url,
  alt,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  rounded = "rounded-t-2xl",
}: SelectorMediaTileProps) {
  return (
    <div
      className={`relative w-full aspect-video overflow-hidden bg-gradient-to-br from-primary/10 via-surface to-secondary/10 ${rounded}`}
    >
      {url ? (
        <Image
          src={url}
          alt={alt}
          fill
          loading="lazy"
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        // CSS fallback — no broken image when the media key is unpublished.
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-light"
          aria-hidden
        >
          <ImageIcon className="w-8 h-8" />
          <span className="text-[11px] font-medium uppercase tracking-[0.15em]">
            Example coming soon
          </span>
        </div>
      )}
    </div>
  );
}
