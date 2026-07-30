"use client";

import Image from "next/image";
import { Expand, ExternalLink, Maximize2, MoveHorizontal, ScanLine } from "lucide-react";
import { useRef } from "react";
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
  const posterImage = tour?.posterImage ?? "/property-demo/living-room.svg";
  const hasEmbed = Boolean(tour?.embedUrl);

  const openFullscreen = async () => {
    const element = tourRef.current;
    if (!element || !document.fullscreenEnabled) return;

    try {
      await element.requestFullscreen();
    } catch {
      // The embedded provider remains usable when browser fullscreen is blocked.
    }
  };

  return (
    <section id="virtual-tour" className="scroll-mt-36 bg-[#071426] py-6 text-white sm:py-10">
      <div className="mx-auto max-w-[1680px] px-3 sm:px-6 lg:px-8">
        <div
          ref={tourRef}
          className="relative min-h-[76svh] overflow-hidden rounded-[1.5rem] bg-black shadow-[0_35px_120px_rgba(0,0,0,0.42)] sm:min-h-[82svh] sm:rounded-[2rem]"
        >
          {hasEmbed ? (
            <iframe
              src={tour?.embedUrl}
              title={`360 virtual tour of ${propertyTitle}`}
              className="absolute inset-0 h-full w-full border-0"
              allow="fullscreen; accelerometer; gyroscope"
              allowFullScreen
              loading="lazy"
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
              <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/0 to-black/65" />
            </>
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4 sm:p-6 lg:p-8">
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
                  A Kuula, Matterport or compatible panorama will fill this media stage when its embed URL is added.
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
                  360 tour placeholder
                </span>
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="rounded-2xl border border-white/15 bg-black/45 px-4 py-3 backdrop-blur-md">
                <p className="text-sm font-semibold">{propertyTitle}</p>
                <p className="mt-1 text-xs text-white/55">
                  {hasEmbed ? `${tour?.provider ?? "360"} interactive experience` : "Add an embed URL to activate the live tour"}
                </p>
              </div>

              <div className="pointer-events-auto flex flex-wrap gap-2">
                {tour?.externalUrl ? (
                  <a
                    href={tour.externalUrl}
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
