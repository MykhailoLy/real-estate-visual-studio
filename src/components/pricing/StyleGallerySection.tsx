"use client";

import { useMemo, useState } from "react";
import StyleGalleryCard from "./StyleGalleryCard";
import ImageLightbox, { type LightboxImage } from "./ImageLightbox";
import { STAGING_STYLE_GALLERY } from "@/data/staging-style-gallery";

export interface StyleGalleryImageOverride {
  title: string;
  src: string;
  alt: string;
}

export type StyleGalleryCopy = Record<
  string,
  {
    label: string;
    description?: string;
  }
>;

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
  imageOverrides = [],
  copy,
  helperText = "Tap any style to browse multiple staged examples. You can also send a reference image or link, or ask us to match the style of a specific listing or brand.",
  examplesLabel = "examples",
  openGalleryPrefix = "Open ",
  openGallerySuffix = " style gallery",
}: {
  imageOverrides?: StyleGalleryImageOverride[];
  copy?: StyleGalleryCopy;
  helperText?: string;
  examplesLabel?: string;
  openGalleryPrefix?: string;
  openGallerySuffix?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState(0);

  const imagesByTitle = useMemo(() => {
    const out = new Map<string, LightboxImage[]>();
    for (const override of imageOverrides) {
      const key = normalizeStyleTitle(override.title);
      if (!key) continue;
      const images = out.get(key) ?? [];
      images.push({
        src: override.src,
        alt: override.alt,
      });
      out.set(key, images);
    }
    return out;
  }, [imageOverrides]);

  const activeEntry = useMemo(
    () => STAGING_STYLE_GALLERY.find((e) => e.id === openId) ?? null,
    [openId]
  );

  const activeImages = useMemo(() => {
    if (!activeEntry) return [];
    return imagesByTitle.get(normalizeStyleTitle(activeEntry.label)) ?? [];
  }, [activeEntry, imagesByTitle]);

  const handleOpen = (id: string, imageIndex: number) => {
    const entry = STAGING_STYLE_GALLERY.find((e) => e.id === id);
    if (!entry) return;

    const images = imagesByTitle.get(normalizeStyleTitle(entry.label)) ?? [];
    if (images.length === 0) return;

    setOpenId(id);
    setOpenIndex(Math.min(Math.max(0, imageIndex), images.length - 1));
  };

  const handleClose = () => {
    setOpenId(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
        {STAGING_STYLE_GALLERY.map((entry) => {
          const uploadedImages = imagesByTitle.get(
            normalizeStyleTitle(entry.label)
          ) ?? [];
          return (
            <StyleGalleryCard
              key={entry.id}
              entry={entry}
              coverOverride={uploadedImages[0]}
              exampleCount={uploadedImages.length}
              labels={{
                label: copy?.[entry.id]?.label,
                description: copy?.[entry.id]?.description,
                examples: examplesLabel,
                openGallery: `${openGalleryPrefix}${
                  copy?.[entry.id]?.label ?? entry.label
                }${openGallerySuffix}`,
              }}
              onOpen={handleOpen}
            />
          );
        })}
      </div>

      <p className="text-xs lg:text-sm text-muted mt-6 leading-relaxed">
        {helperText}
      </p>

      {activeEntry && activeImages.length > 0 && (
        <ImageLightbox
          key={activeEntry.id}
          variant="photo"
          images={activeImages}
          initialIndex={openIndex}
          title={copy?.[activeEntry.id]?.label ?? activeEntry.label}
          onClose={handleClose}
        />
      )}
    </>
  );
}
