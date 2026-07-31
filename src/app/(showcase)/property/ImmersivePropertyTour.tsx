"use client";

import Image from "next/image";
import {
  Expand,
  ExternalLink,
  Maximize2,
  MoveHorizontal,
  Play,
  ScanLine,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  normalizeExternalInteractiveUrl,
  normalizeTourEmbedUrl,
} from "@/features/property-showcase/provider-urls";
import type { PropertyVirtualTour } from "@/features/property-showcase/types";

type ImmersivePropertyTourProps = {
  propertyTitle: string;
  tour?: PropertyVirtualTour;
  posterAlt: string;
};

export default function ImmersivePropertyTour({
  propertyTitle,
  tour,
  posterAlt,
}: ImmersivePropertyTourProps) {
  const tourRef = useRef<HTMLDivElement>(null);
  const [activated, setActivated] = useState(false);
  const posterImage = tour?.posterImage ?? "/property-demo/living-room.svg";
  const embedUrl = tour
    ? normalizeTourEmbedUrl(tour.provider, tour.embedUrl)
    : undefined;
  const externalUrl = normalizeExternalInteractiveUrl(
    tour?.externalUrl ?? tour?.embedUrl,
  );
  const hasEmbed = Boolean(embedUrl);
  const showEmbed = hasEmbed && activated;

  const openFullscreen = async () => {
    const element = tourRef.current;
    if (!element || !document.fullscreenEnabled) return;

    if (hasEmbed) setActivated(true);
    try {
      await element.requestFullscreen();
    } catch {
      // The embedded provider remains usable when browser fullscreen is blocked.
    }
  };

  return (
    <section
      id="virtual-tour"
      className="scroll-mt-36 bg-[#071426] py-6 text-white sm:py-10"
    >
      <div className="mx-auto max-w-[1680px] px-3 sm:px-6 lg:px-8">
        <div
          ref={tourRef}
          className="relative min-h-[76svh] overflow-hidden rounded-[1.5rem] bg-black shadow-[0_35px_120px_rgba(0,0,0,0.42)] sm:min-h-[82svh] sm:rounded-[2rem]"
        >
          {showEmbed ? (
            <iframe
              src={embedUrl}
              title={`360 virtual tour of ${propertyTitle}`}
              className="absolute inset-0 h-full w-full border-0 bg-black"
              allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"
              allowFullScreen
              scrolling="no"
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <>
              <Image
                src={posterImage}
                alt={posterAlt}
                fill
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black/70" />
            </>
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4 sm:p-6 lg:p-8">
            <div className="max-w-2xl rounded-2xl border border-white/15 bg-black/45 p-4 backdrop-blur-md sm:p-5">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4bc6a] sm:text-xs">
                <ScanLine className="h-4 w-4" aria-hidden />
                360 virtual tour
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] sm:text-3xl">
                Enter the property without leaving the page.
              </h2>
              {!hasEmbed ? (
                <p className="mt-2 hidden max-w-xl text-sm leading-6 text-white/65 sm:block">
                  Add a valid Kuula, Matterport or compatible share link to activate the live tour.
                </p>
              ) : !activated ? (
                <p className="mt-2 hidden max-w-xl text-sm leading-6 text-white/65 sm:block">
                  The provider loads only after the visitor starts the tour.
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={openFullscreen}
              className="pointer-events-auto grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-black/75 sm:h-14 sm:w-14"
              aria-label="Open virtual tour fullscreen"
            >
              <Maximize2 className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
            </button>
          </div>

          {!hasEmbed ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="flex flex-col items-center gap-3 rounded-full border border-white/20 bg-black/30 px-6 py-4 text-center backdrop-blur-sm">
                <MoveHorizontal className="h-7 w-7" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/85">
                  Tour link is not embeddable
                </span>
              </div>
            </div>
          ) : !activated ? (
            <div className="absolute inset-0 z-[5] grid place-items-center px-4">
              <button
                type="button"
                onClick={() => setActivated(true)}
                className="group flex flex-col items-center gap-4 rounded-[2rem] border border-white/20 bg-black/50 px-8 py-7 text-center shadow-2xl backdrop-blur-md transition hover:scale-[1.02] hover:bg-black/65"
              >
                <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-[#0f2440] shadow-xl transition group-hover:scale-105 sm:h-20 sm:w-20">
                  <Play className="ml-1 h-7 w-7 fill-current sm:h-9 sm:w-9" aria-hidden />
                </span>
                <span>
                  <span className="block text-base font-bold sm:text-lg">
                    Start 360 tour
                  </span>
                  <span className="mt-1 block text-xs text-white/65 sm:text-sm">
                    Loaded directly from {tour?.provider ?? "the tour provider"}
                  </span>
                </span>
              </button>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="rounded-2xl border border-white/15 bg-black/45 px-4 py-3 backdrop-blur-md">
                <p className="text-sm font-semibold">{propertyTitle}</p>
                <p className="mt-1 text-xs text-white/55">
                  {showEmbed
                    ? `${tour?.provider ?? "360"} interactive experience`
                    : hasEmbed
                      ? "Ready to load the external interactive tour"
                      : "Check the tour link in Properties"}
                </p>
              </div>

              <div className="pointer-events-auto flex flex-wrap gap-2">
                {externalUrl ? (
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-black/45 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-black/70"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Open original tour
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={openFullscreen}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#0f2440] transition hover:bg-[#f2e8c7]"
                >
                  <Expand className="h-4 w-4" aria-hidden />
                  View fullscreen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
