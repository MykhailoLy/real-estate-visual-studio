"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface PropertyGalleryImage {
  src: string;
  alt: string;
  label: string;
}

type PropertyGalleryProps = {
  images: PropertyGalleryImage[];
  eyebrow?: string;
  title?: string;
  description?: string;
};

export default function PropertyGallery({
  images,
  eyebrow = "Photo gallery",
  title = "Explore the residence.",
  description = "Select any image to open the full-screen gallery.",
}: PropertyGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeGallery = useCallback(() => {
    setActiveIndex(null);
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
        setActiveIndex((current) =>
          current === null ? null : (current - 1 + images.length) % images.length,
        );
      }
      if (event.key === "ArrowRight") {
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

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, closeGallery, images.length]);

  if (images.length === 0) return null;

  const activeImage = activeIndex === null ? null : images[activeIndex];

  const showPrevious = () => {
    setActiveIndex((current) =>
      current === null ? 0 : (current - 1 + images.length) % images.length,
    );
  };

  const showNext = () => {
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

        <div className="grid auto-rows-[190px] gap-3 sm:auto-rows-[250px] sm:grid-cols-2 lg:auto-rows-[285px] lg:grid-cols-4">
          {images.map((image, index) => {
            const featured = index === 0;
            return (
              <button
                key={`${image.src}-${index}`}
                type="button"
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setActiveIndex(index);
                }}
                className={`group relative overflow-hidden rounded-2xl bg-white/5 text-left focus-visible:outline-white ${
                  featured ? "sm:col-span-2 sm:row-span-2 lg:col-span-2" : ""
                }`}
                aria-label={`Open gallery image: ${image.label}`}
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes={featured ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
                  className="object-cover transition duration-500 group-hover:scale-[1.025]"
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
      </div>

      {activeImage ? (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#06101f]/96 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Property gallery: ${activeImage.label}`}
          onClick={closeGallery}
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              closeGallery();
            }}
            className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 sm:right-7 sm:top-7"
            aria-label="Close gallery"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showPrevious();
            }}
            className="absolute left-3 z-10 grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 sm:left-7"
            aria-label="Previous gallery image"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>

          <div
            className="relative h-[76vh] w-full max-w-7xl overflow-hidden rounded-2xl bg-black/20"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={activeImage.src}
              alt={activeImage.alt}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 pb-6 pt-16 sm:px-8 sm:pb-8">
              <p className="text-base font-semibold text-white sm:text-lg">{activeImage.label}</p>
              <p className="mt-1 text-xs text-white/55">
                {(activeIndex ?? 0) + 1} of {images.length}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showNext();
            }}
            className="absolute right-3 z-10 grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 sm:right-7"
            aria-label="Next gallery image"
          >
            <ChevronRight className="h-6 w-6" aria-hidden />
          </button>
        </div>
      ) : null}
    </section>
  );
}
