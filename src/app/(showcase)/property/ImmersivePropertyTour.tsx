"use client";

import Image from "next/image";
import { ExternalLink, Loader2, Maximize2, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PROPERTY_MEDIA_LABELS } from "@/features/property-showcase/media-labels";
import { normalizeTourInput } from "@/features/property-showcase/provider-urls";
import type {
  PropertyLanguageCode,
  PropertyVirtualTour,
} from "@/features/property-showcase/types";

type ImmersivePropertyTourProps = {
  propertyTitle: string;
  tour?: PropertyVirtualTour;
  posterAlt: string;
  locale?: PropertyLanguageCode;
  onVirtualTourOpened?: () => void;
};

type FrameStatus =
  | "poster"
  | "opening"
  | "frame-visible"
  | "frame-unconfirmed";

export default function ImmersivePropertyTour({
  propertyTitle,
  tour,
  posterAlt,
  locale = "en",
  onVirtualTourOpened,
}: ImmersivePropertyTourProps) {
  const tourRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<FrameStatus>("poster");
  const labels = PROPERTY_MEDIA_LABELS[locale] ?? PROPERTY_MEDIA_LABELS.en;
  const posterImage = tour?.posterImage ?? "/property-demo/living-room.svg";
  const normalizedTour = tour
    ? normalizeTourInput(tour.provider, {
        embedUrl: tour.embedUrl,
        externalUrl: tour.externalUrl,
      })
    : null;
  const embedUrl = normalizedTour?.embedUrl;
  const externalUrl = normalizedTour?.externalUrl;
  const hasEmbed = Boolean(embedUrl);
  const showIframe = hasEmbed && status !== "poster";
  const frameIsVisible =
    status === "frame-visible" || status === "frame-unconfirmed";

  useEffect(() => {
    if (status !== "opening") return undefined;

    const timeout = window.setTimeout(() => {
      setStatus((current) =>
        current === "opening" ? "frame-unconfirmed" : current,
      );
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [status]);

  function activate() {
    if (status !== "poster") return;
    onVirtualTourOpened?.();
    if (hasEmbed) setStatus("opening");
  }

  async function openFullscreen() {
    const element = tourRef.current;
    if (!element || !document.fullscreenEnabled) return;

    activate();
    try {
      await element.requestFullscreen();
    } catch {
      // The provider remains available when browser fullscreen is blocked.
    }
  }

  return (
    <section
      id="virtual-tour"
      className="scroll-mt-36 bg-[#071426] py-12 text-white sm:py-16"
    >
      <div className="mx-auto max-w-[1680px] px-3 sm:px-6 lg:px-8">
        <h2 className="mb-5 px-1 text-2xl font-semibold sm:text-3xl">
          {labels.virtualTour}
        </h2>
        <div
          ref={tourRef}
          className="overflow-hidden rounded-lg border border-white/10 bg-black shadow-[0_28px_80px_rgba(0,0,0,0.35)]"
        >
          <div className="relative min-h-[68svh] sm:min-h-[78svh]">
            {showIframe ? (
              <iframe
                src={embedUrl}
                title={`360 virtual tour of ${propertyTitle}`}
                className={`absolute inset-0 h-full w-full border-0 bg-black transition-opacity duration-300 ${
                  frameIsVisible ? "opacity-100" : "opacity-0"
                }`}
                allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"
                allowFullScreen
                scrolling="no"
                loading="lazy"
                onLoad={() => setStatus("frame-visible")}
                referrerPolicy="strict-origin-when-cross-origin"
                data-testid="virtual-tour-iframe"
              />
            ) : null}

            {!frameIsVisible ? (
              <>
                <Image
                  src={posterImage}
                  alt={posterAlt}
                  fill
                  sizes="100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/20" />
              </>
            ) : null}

            {status === "poster" && hasEmbed ? (
              <div className="absolute inset-0 grid place-items-center px-4">
                <button
                  type="button"
                  onClick={activate}
                  className="group inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0f2440] shadow-xl transition hover:bg-[#f2e8c7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  aria-label={labels.virtualTourCta}
                >
                  <Play className="h-5 w-5 fill-current" aria-hidden />
                  {labels.virtualTourCta}
                </button>
              </div>
            ) : null}

            {status === "opening" ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <Loader2
                  className="h-9 w-9 animate-spin text-white drop-shadow-lg"
                  aria-hidden
                />
                <span className="sr-only">{labels.virtualTourCta}</span>
              </div>
            ) : null}

            {!hasEmbed && externalUrl ? (
              <div className="absolute inset-0 grid place-items-center px-4">
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onVirtualTourOpened}
                  className="inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0f2440] shadow-xl transition hover:bg-[#f2e8c7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  <ExternalLink className="h-5 w-5" aria-hidden />
                  {labels.virtualTourCta}
                </a>
              </div>
            ) : null}
          </div>

          {hasEmbed && status !== "poster" ? (
            <div
              data-testid="virtual-tour-controls"
              className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 bg-[#071426] px-3 py-3 sm:px-4"
            >
              {externalUrl ? (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white transition hover:border-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  {labels.openOriginalTour}
                </a>
              ) : null}
              <button
                type="button"
                onClick={openFullscreen}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0f2440] transition hover:bg-[#f2e8c7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm"
                aria-label={`${labels.fullscreen}: ${labels.virtualTour}`}
              >
                <Maximize2 className="h-4 w-4" aria-hidden />
                {labels.fullscreen}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
