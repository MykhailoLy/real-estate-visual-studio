"use client";

import Image from "next/image";
import {
  Expand,
  ExternalLink,
  Loader2,
  Maximize2,
  MoveHorizontal,
  Play,
  ScanLine,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { normalizeTourInput } from "@/features/property-showcase/provider-urls";
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
  const [status, setStatus] = useState<"poster" | "loading" | "loaded" | "failed">(
    "poster",
  );
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
  const showEmbed = hasEmbed && status !== "poster" && status !== "failed";

  useEffect(() => {
    if (status !== "loading") return undefined;

    const timeout = window.setTimeout(() => {
      setStatus((current) => (current === "loading" ? "failed" : current));
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [status]);

  function activate() {
    if (hasEmbed) setStatus("loading");
  }

  const openFullscreen = async () => {
    const element = tourRef.current;
    if (!element || !document.fullscreenEnabled) return;

    activate();
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
              className={`absolute inset-0 h-full w-full border-0 bg-black transition-opacity duration-300 ${
                status === "loaded" ? "opacity-100" : "opacity-0"
              }`}
              allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"
              allowFullScreen
              scrolling="no"
              loading="lazy"
              onLoad={() => setStatus("loaded")}
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : null}

          {status !== "loaded" ? (
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
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4 sm:p-6 lg:p-8">
            <div className="max-w-2xl rounded-2xl border border-white/15 bg-black/45 p-4 backdrop-blur-md sm:p-5">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4bc6a] sm:text-xs">
                <ScanLine className="h-4 w-4" aria-hidden />
                360 virtual tour
              </p>
              <h2 className="mt-2 text-xl font-semibold sm:text-3xl">
                Enter the property without leaving the page.
              </h2>
              {!hasEmbed ? (
                <p className="mt-2 hidden max-w-xl text-sm leading-6 text-white/65 sm:block">
                  Open the provider tour in a secure new tab.
                </p>
              ) : status === "poster" ? (
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
            <div className="absolute inset-0 z-[6] grid place-items-center px-4">
              <div className="max-w-lg rounded-[1.5rem] border border-white/15 bg-black/65 p-6 text-center shadow-2xl backdrop-blur-md">
                <MoveHorizontal className="mx-auto h-7 w-7" aria-hidden />
                <h3 className="mt-3 text-2xl font-semibold">
                  Open the 360 tour in a new tab.
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  The provider link is preserved, but it is not available as an iframe embed.
                </p>
                {externalUrl ? (
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#0f2440] transition hover:bg-[#f2e8c7]"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Open 360 tour
                  </a>
                ) : null}
              </div>
            </div>
          ) : status === "poster" ? (
            <div className="absolute inset-0 z-[5] grid place-items-center px-4">
              <button
                type="button"
                onClick={activate}
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
                    Loaded directly from {normalizedTour?.providerName ?? "the tour provider"}
                  </span>
                </span>
              </button>
            </div>
          ) : null}

          {status === "loading" ? (
            <div className="absolute inset-0 z-[6] grid place-items-center px-4">
              <div className="flex flex-col items-center gap-3 rounded-[1.5rem] border border-white/15 bg-black/60 px-6 py-5 text-center backdrop-blur-md">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                <p className="text-sm font-bold">
                  Loading {normalizedTour?.providerName ?? "360 tour"}
                </p>
                <p className="max-w-sm text-xs leading-5 text-white/65">
                  If the provider blocks embedding, the tour will open securely in a new tab.
                </p>
              </div>
            </div>
          ) : null}

          {status === "failed" ? (
            <div className="absolute inset-0 z-[6] grid place-items-center px-4">
              <div className="max-w-lg rounded-[1.5rem] border border-white/15 bg-black/65 p-6 text-center shadow-2xl backdrop-blur-md">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4bc6a]">
                  {normalizedTour?.providerName ?? "360 tour"}
                </p>
                <h3 className="mt-3 text-2xl font-semibold">
                  Open the 360 tour in a new tab.
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  This provider may restrict iframe playback. The full experience opens securely with the provider controls intact.
                </p>
                {externalUrl ? (
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#0f2440] transition hover:bg-[#f2e8c7]"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Open 360 tour
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="rounded-2xl border border-white/15 bg-black/45 px-4 py-3 backdrop-blur-md">
                <p className="text-sm font-semibold">{propertyTitle}</p>
                <p className="mt-1 text-xs text-white/55">
                  {showEmbed
                    ? `${normalizedTour?.providerName ?? "360"} interactive experience`
                    : hasEmbed
                      ? "Ready to load the external interactive tour"
                      : "Open the original tour"}
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
