"use client";

import { useMemo, useState } from "react";
import StyleGalleryCard from "./StyleGalleryCard";
import ImageLightbox from "./ImageLightbox";
import { STAGING_STYLE_GALLERY } from "@/data/staging-style-gallery";

export interface StyleGalleryCoverOverride {
  title: string;
  src: string;
  alt: string;
}

function normalizeStyleTitle(title: string): string {
  return title.trim().toLowerCase();
}

/**
 * Client-side wrapper for the Virtual Staging "Style Options" gallery.
 *
 * Owns the lightbox state (which style is open, which image index) so
 * the surrounding pricing page can stay a server component with its
 * usual `metadata` export. Pure presentational — no pricing or order
 * form behaviour is touched.
 *
 * The ImageLightbox is mounted only while a style is active, so its
 * internal state (current image index, failed-src tracking) seeds
 * naturally from props on every open. No setState-in-effect needed.
 */
export default function StyleGallerySection({
  coverOverrides = [],
}: {
  coverOverrides?: StyleGalleryCoverOverride[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState(0);

  const coverByTitle = useMemo(() => {
    const out = new Map<string, StyleGalleryCoverOverride>();
    for (const override of coverOverrides) {
      const key = normalizeStyleTitle(override.title);
      if (!key || out.has(key)) continue;
      out.set(key, override);
    }
    return out;
  }, [coverOverrides]);

  const activeEntry = useMemo(
    () => STAGING_STYLE_GALLERY.find((e) => e.id === openId) ?? null,
    [openId]
  );

  const handleOpen = (id: string, imageIndex: number) => {
    setOpenId(id);
    setOpenIndex(imageIndex);
  };

  const handleClose = () => {
    setOpenId(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
        {STAGING_STYLE_GALLERY.map((entry) => (
          <StyleGalleryCard
            key={entry.id}
            entry={entry}
            coverOverride={coverByTitle.get(normalizeStyleTitle(entry.label))}
            onOpen={handleOpen}
          />
        ))}
      </div>

      <p className="text-xs lg:text-sm text-muted mt-6 leading-relaxed">
        Tap any style to browse multiple staged examples. You can also send a
        reference image or link, or ask us to match the style of a specific
        listing or brand.
      </p>

      {activeEntry && (
        <ImageLightbox
          key={activeEntry.id}
          images={activeEntry.images}
          initialIndex={openIndex}
          title={activeEntry.label}
          onClose={handleClose}
        />
      )}
    </>
  );
}
