"use client";

import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  OptimizedImage,
  OptimizedImagePreloader,
} from "@/components/media/OptimizedImage";
import StaticImageStage from "@/components/media/StaticImageStage";
import { useViewerScrollLock } from "@/components/media/useViewerScrollLock";
import { getPropertyGalleryImageContext } from "@/components/media/image-delivery";
import {
  hasCollapsedPropertyGalleryImages,
  propertyGalleryCompactLayout,
  visiblePropertyGalleryImageCount,
} from "@/features/property-showcase/mobile-gallery";

export interface PropertyGalleryImage {
  src: string;
  alt: string;
  label: string;
  objectPosition?: string;
}

type PropertyGalleryProps = {
  images: PropertyGalleryImage[];
  eyebrow?: string;
  title?: string;
  description?: string;
  showAllLabel?: (count: number) => string;
  showFewerLabel?: string;
  onGalleryOpen?: () => void;
};

function primaryGridClass(imageCount: number): string {
  const layout = propertyGalleryCompactLayout(imageCount);
  if (layout === "single") {
    return "grid grid-cols-1 gap-3 sm:auto-rows-[420px]";
  }

  if (layout === "pair") {
    return "grid grid-cols-2 gap-3 sm:auto-rows-[280px] lg:auto-rows-[440px]";
  }

  return "grid grid-cols-2 gap-3 sm:auto-rows-[250px] sm:grid-cols-2 lg:auto-rows-[285px] lg:grid-cols-4";
}

function primaryImageClass(imageCount: number, index: number): string {
  const layout = propertyGalleryCompactLayout(imageCount);
  if (layout === "single") {
    return "col-span-full aspect-[16/10] sm:col-span-1 sm:aspect-auto";
  }

  if (layout === "pair") {
    return "aspect-[4/3] sm:aspect-auto";
  }

  const mobileWide = index >= 2;
  const featured = index === 0;
  const desktopWide =
    (imageCount === 3 && index > 0) ||
    (imageCount === 4 && index === 1);

  return `${mobileWide ? "col-span-2 aspect-[16/10] sm:col-span-1 sm:aspect-auto" : "aspect-[4/3] sm:aspect-auto"} ${
    featured ? "sm:col-span-2 sm:row-span-2 lg:col-span-2" : ""
  } ${desktopWide ? "lg:col-span-2" : ""}`;
}

export default function PropertyGallery({
  images,
  eyebrow = "Photo gallery",
  title = "Explore the residence.",
  description = "Select any image to open the full-screen gallery.",
  showAllLabel = (count) => `Show all ${count} photos`,
  showFewerLabel = "Show fewer photos",
  onGalleryOpen,
}: PropertyGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showAllImages, setShowAllImages] = useState(false);
  const [activeImageReady, setActiveImageReady] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const showAllButtonRef = useRef<HTMLButtonElement>(null);
  const collapseAnchorRef = useRef<HTMLDivElement>(null);
  const collapseAnchorTopRef = useRef<number | null>(null);
  const shouldRestoreToggleFocusRef = useRef(false);
  const rootScrollBehaviorRef = useRef("");
  useViewerScrollLock(activeIndex !== null);

  const closeGallery = useCallback(() => {
    setActiveIndex(null);
    setActiveImageReady(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (activeIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeGallery();
        return;
      }
      if (event.key === "ArrowLeft") {
        setActiveImageReady(false);
        setActiveIndex((current) =>
          current === null ? null : (current - 1 + images.length) % images.length,
        );
      }
      if (event.key === "ArrowRight") {
        setActiveImageReady(false);
        setActiveIndex((current) =>
          current === null ? null : (current + 1) % images.length,
        );
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href]:not([aria-disabled="true"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1) ?? first;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    closeButtonRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, closeGallery, images.length]);

  useEffect(() => {
    if (!shouldRestoreToggleFocusRef.current || showAllImages) return;

    const anchorTopBeforeCollapse = collapseAnchorTopRef.current;

    const compensateScrollPosition = () => {
      const anchorTopAfterCollapse =
        collapseAnchorRef.current?.getBoundingClientRect().top;

      if (
        anchorTopBeforeCollapse === null ||
        anchorTopAfterCollapse === undefined
      ) {
        return;
      }

      // React has committed the compact layout. Correct the actual measured
      // browser scroll-anchor delta against the visible last compact tile.
      window.scrollBy({
        top: anchorTopAfterCollapse - anchorTopBeforeCollapse,
        behavior: "instant",
      });
    };

    compensateScrollPosition();
    showAllButtonRef.current?.focus({ preventScroll: true });

    const timeout = window.setTimeout(() => {
      // Focus can trigger a delayed browser adjustment even with
      // preventScroll, so correct the same measured delta once more.
      compensateScrollPosition();
      collapseAnchorTopRef.current = null;
      shouldRestoreToggleFocusRef.current = false;
      document.documentElement.style.scrollBehavior = rootScrollBehaviorRef.current;
    }, 32);

    return () => {
      window.clearTimeout(timeout);
      document.documentElement.style.scrollBehavior = rootScrollBehaviorRef.current;
    };
  }, [showAllImages]);

  if (images.length === 0) return null;

  const activeImage = activeIndex === null ? null : images[activeIndex];
  const hasCollapsedImages = hasCollapsedPropertyGalleryImages(images.length);
  const visibleImageCount = visiblePropertyGalleryImageCount(
    images.length,
    showAllImages,
  );
  const primaryImages = images.slice(0, Math.min(images.length, 5));
  const additionalImages = showAllImages ? images.slice(5) : [];

  const captureCollapseAnchor = () => {
    collapseAnchorTopRef.current =
      collapseAnchorRef.current?.getBoundingClientRect().top ?? null;
  };

  const collapseGallery = () => {
    if (collapseAnchorTopRef.current === null) {
      captureCollapseAnchor();
    }
    shouldRestoreToggleFocusRef.current = true;
    rootScrollBehaviorRef.current = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    setShowAllImages(false);
  };

  const showPrevious = () => {
    setActiveImageReady(false);
    setActiveIndex((current) =>
      current === null ? 0 : (current - 1 + images.length) % images.length,
    );
  };

  const showNext = () => {
    setActiveImageReady(false);
    setActiveIndex((current) =>
      current === null ? 0 : (current + 1) % images.length,
    );
  };

  return (
    <section className="bg-[#0f2440] py-16 text-white sm:py-20 lg:py-28">
      <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-10">
        <div className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d4bc6a]">
              {eyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
              {title}
            </h2>
          </div>
          <p className="max-w-lg text-sm leading-6 text-white/55 sm:text-right">
            {description}
          </p>
        </div>

        <div
          id="property-gallery-grid"
          data-testid="property-gallery-grid"
          className={primaryGridClass(primaryImages.length)}
        >
          {primaryImages.map((image, index) => {
            const showDisclosure =
              hasCollapsedImages && !showAllImages && index === visibleImageCount - 1;
            return (
              <div
                key={`${image.src}-${index}`}
                ref={
                  index === primaryImages.length - 1 ? collapseAnchorRef : undefined
                }
                data-testid={`property-gallery-image-${index}`}
                className={`relative overflow-hidden rounded-2xl bg-white/5 ${primaryImageClass(
                  primaryImages.length,
                  index,
                )}`}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    triggerRef.current = event.currentTarget;
                    onGalleryOpen?.();
                    setActiveImageReady(false);
                    setActiveIndex(index);
                  }}
                  className="group absolute inset-0 text-left focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white"
                  aria-label={`Open gallery image: ${image.label}`}
                >
                  <OptimizedImage
                    src={image.src}
                    alt={image.alt}
                    context={getPropertyGalleryImageContext(
                      primaryImages.length,
                      index,
                    )}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-[1.025]"
                    style={{ objectPosition: image.objectPosition }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
                  <span className="absolute bottom-4 left-4 text-sm font-semibold text-white sm:bottom-5 sm:left-5">
                    {image.label}
                  </span>
                  <span className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/15 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Expand className="h-4 w-4" aria-hidden />
                  </span>
                </button>
                {showDisclosure ? (
                  <button
                    ref={showAllButtonRef}
                    type="button"
                    onClick={() => setShowAllImages(true)}
                    className="absolute inset-x-3 bottom-3 z-10 inline-flex min-h-11 items-center justify-center rounded-full border border-white/35 bg-[#0f2440]/85 px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-[#0f2440] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:inset-x-4 sm:bottom-4"
                    data-testid="property-gallery-toggle"
                    aria-controls="property-gallery-additional-images"
                    aria-expanded={false}
                    aria-label={showAllLabel(images.length)}
                  >
                    {showAllLabel(images.length)}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        {additionalImages.length > 0 ? (
          <div
            id="property-gallery-additional-images"
            data-testid="property-gallery-additional-images"
            className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {additionalImages.map((image, additionalIndex) => {
              const index = additionalIndex + 5;
              return (
                <button
                  key={`${image.src}-${index}`}
                  type="button"
                  data-testid={`property-gallery-image-${index}`}
                  onClick={(event) => {
                    triggerRef.current = event.currentTarget;
                    onGalleryOpen?.();
                    setActiveImageReady(false);
                    setActiveIndex(index);
                  }}
                  className="group relative aspect-[16/10] overflow-hidden rounded-2xl bg-white/5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  aria-label={`Open gallery image: ${image.label}`}
                >
                  <OptimizedImage
                    src={image.src}
                    alt={image.alt}
                    context="property-gallery-additional"
                    fill
                    className="object-cover transition duration-500 group-hover:scale-[1.025]"
                    style={{ objectPosition: image.objectPosition }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
                  <span className="absolute bottom-4 left-4 text-sm font-semibold text-white sm:bottom-5 sm:left-5">
                    {image.label}
                  </span>
                  <span className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/15 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Expand className="h-4 w-4" aria-hidden />
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {hasCollapsedImages && showAllImages ? (
          <button
            type="button"
            onClick={collapseGallery}
            onPointerDown={captureCollapseAnchor}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                captureCollapseAnchor();
              }
            }}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/35 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
            data-testid="property-gallery-collapse"
            aria-controls="property-gallery-additional-images"
            aria-expanded
          >
            {showFewerLabel}
          </button>
        ) : null}
      </div>

      {activeImage ? (
        <div
          ref={dialogRef}
          className="static-image-viewer-overlay static-image-viewer-root fixed inset-0 z-[100] grid h-[100dvh] w-screen grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden bg-[#06101f]/96 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Property gallery: ${activeImage.label}`}
          onClick={closeGallery}
        >
          <div
            className="static-image-viewer-header mx-auto grid w-full max-w-[1600px] grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <span aria-hidden />
            <p className="truncate text-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 sm:text-xs">
              Photo gallery
            </p>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                closeGallery();
              }}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="Close gallery"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="static-image-viewer-layout mx-auto grid min-h-0 w-full max-w-[1728px] grid-cols-[3rem_minmax(0,1fr)_3rem] grid-rows-[minmax(0,1fr)_auto] gap-x-2 gap-y-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] sm:gap-x-4">
            <div
              className="relative col-span-3 row-start-1 min-h-0 overflow-hidden rounded-xl bg-black/20 sm:col-span-1 sm:col-start-2 sm:rounded-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <StaticImageStage
                key={activeImage.src}
                variant="photo"
                src={activeImage.src}
                alt={activeImage.alt}
                context="property-lightbox"
                loading="eager"
                onLoad={() => setActiveImageReady(true)}
                data-testid="property-gallery-lightbox-image"
                stageClassName="h-full w-full"
              />
              {activeImageReady && images.length > 1 ? (
                <OptimizedImagePreloader
                  src={images[((activeIndex ?? 0) + 1) % images.length].src}
                  context="property-lightbox"
                />
              ) : null}
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showPrevious();
              }}
              className="static-image-viewer-control col-start-1 row-start-2 grid h-11 w-11 place-items-center self-center justify-self-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:row-start-1 sm:h-12 sm:w-12"
              aria-label="Previous gallery image"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden />
            </button>

            <div
              className="col-start-2 row-start-2 min-w-0 text-center"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="truncate text-sm font-semibold text-white sm:text-base">
                {activeImage.label}
              </p>
              <p className="mt-0.5 text-xs text-white/55">
                {(activeIndex ?? 0) + 1} of {images.length}
              </p>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showNext();
              }}
              className="static-image-viewer-control col-start-3 row-start-2 grid h-11 w-11 place-items-center self-center justify-self-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:row-start-1 sm:h-12 sm:w-12"
              aria-label="Next gallery image"
            >
              <ChevronRight className="h-6 w-6" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
