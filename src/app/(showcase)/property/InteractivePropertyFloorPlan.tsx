"use client";

import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Maximize2,
  MousePointer2,
  Play,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  normalizeInteractiveFloorPlanInput,
  type NormalizedInteractiveFloorPlanUrl,
} from "@/features/property-showcase/provider-urls";
import type {
  PropertyFloorPlan,
  PropertyGalleryImage,
} from "@/features/property-showcase/types";

type InteractivePropertyFloorPlanProps = {
  propertyTitle: string;
  floorPlan: PropertyFloorPlan;
  gallery: PropertyGalleryImage[];
};

const fallbackPositions = [
  { xPercent: 48, yPercent: 48 },
  { xPercent: 49, yPercent: 16 },
  { xPercent: 24, yPercent: 58 },
  { xPercent: 66, yPercent: 52 },
  { xPercent: 34, yPercent: 35 },
];

export default function InteractivePropertyFloorPlan(
  props: InteractivePropertyFloorPlanProps,
) {
  const externalPlan = normalizeInteractiveFloorPlanInput({
    provider: props.floorPlan.interactiveProvider,
    externalUrl: props.floorPlan.interactiveExternalUrl,
    embedUrl: props.floorPlan.interactiveEmbedUrl,
    interactiveUrl: props.floorPlan.interactiveUrl,
  });

  if (externalPlan) {
    return (
      <ExternalInteractiveFloorPlan {...props} externalPlan={externalPlan} />
    );
  }

  return <NativeInteractiveFloorPlan {...props} />;
}

function ExternalInteractiveFloorPlan({
  propertyTitle,
  floorPlan,
  externalPlan,
}: InteractivePropertyFloorPlanProps & {
  externalPlan: NormalizedInteractiveFloorPlanUrl;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"poster" | "loading" | "loaded" | "failed">(
    "poster",
  );
  const canEmbed = Boolean(externalPlan.embedUrl);
  const openPlanUrl = externalPlan.externalUrl ?? externalPlan.embedUrl ?? "";
  const showIframe = canEmbed && status !== "poster" && status !== "failed";

  useEffect(() => {
    if (status !== "loading") return undefined;

    const timeout = window.setTimeout(() => {
      setStatus((current) => (current === "loading" ? "failed" : current));
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [status]);

  function activate() {
    if (canEmbed) {
      setStatus("loading");
    }
  }

  const openFullscreen = async () => {
    const element = stageRef.current;
    if (!element || !document.fullscreenEnabled) return;
    activate();
    try {
      await element.requestFullscreen();
    } catch {
      // The embedded plan remains available without browser fullscreen.
    }
  };

  return (
    <section
      id="interactive-floor-plan"
      className="scroll-mt-36 bg-[#0f2440] py-6 text-white sm:py-10"
    >
      <div className="mx-auto max-w-[1680px] px-3 sm:px-6 lg:px-8">
        <div
          ref={stageRef}
          className="relative min-h-[78svh] overflow-hidden rounded-[1.5rem] bg-[#111] shadow-[0_35px_120px_rgba(0,0,0,0.35)] sm:min-h-[86svh] sm:rounded-[2rem]"
        >
          {showIframe ? (
            <iframe
              src={externalPlan.embedUrl}
              title={`Interactive floor plan of ${propertyTitle}`}
              className={`absolute inset-0 h-full w-full border-0 bg-white transition-opacity duration-300 ${
                status === "loaded" ? "opacity-100" : "opacity-0"
              }`}
              allow="fullscreen; accelerometer; gyroscope"
              allowFullScreen
              loading="lazy"
              onLoad={() => setStatus("loaded")}
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : null}

          {status !== "loaded" ? (
            <>
              <Image
                src={floorPlan.imageUrl}
                alt={`${floorPlan.title.en} for ${propertyTitle}`}
                fill
                sizes="100vw"
                className="object-contain bg-[#ece9e2] p-5 sm:p-10"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/5 to-black/55" />
            </>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4 sm:p-6 lg:p-8">
            <div className="rounded-2xl border border-white/15 bg-black/55 p-4 backdrop-blur-md sm:p-5">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4bc6a] sm:text-xs">
                <MousePointer2 className="h-4 w-4" aria-hidden />
                Interactive floor plan
              </p>
              <h2 className="mt-2 text-xl font-semibold sm:text-3xl">
                Walk through the home room by room.
              </h2>
              {status === "poster" ? (
                <p className="mt-2 hidden text-sm text-white/65 sm:block">
                  The provider experience loads only after it is opened.
                </p>
              ) : null}
            </div>
            {canEmbed ? (
              <button
                type="button"
                onClick={openFullscreen}
                className="pointer-events-auto grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/20 bg-black/60 text-white shadow-lg backdrop-blur transition hover:bg-black/80 sm:h-14 sm:w-14"
                aria-label="Open interactive floor plan fullscreen"
              >
                <Maximize2 className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
              </button>
            ) : null}
          </div>

          {status === "poster" && canEmbed ? (
            <div className="absolute inset-0 z-[5] grid place-items-center px-4">
              <button
                type="button"
                onClick={activate}
                className="group flex flex-col items-center gap-4 rounded-[2rem] border border-white/20 bg-black/55 px-8 py-7 text-center shadow-2xl backdrop-blur-md transition hover:scale-[1.02] hover:bg-black/70"
              >
                <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-[#0f2440] shadow-xl transition group-hover:scale-105 sm:h-20 sm:w-20">
                  <Play className="ml-1 h-7 w-7 fill-current sm:h-9 sm:w-9" aria-hidden />
                </span>
                <span>
                  <span className="block text-base font-bold sm:text-lg">
                    Open interactive floor plan
                  </span>
                  <span className="mt-1 block text-xs text-white/65 sm:text-sm">
                    Loaded directly from {externalPlan.providerName}
                  </span>
                </span>
              </button>
            </div>
          ) : null}

          {status === "loading" ? (
            <div className="absolute inset-0 z-[6] grid place-items-center px-4">
              <div className="flex flex-col items-center gap-3 rounded-[1.5rem] border border-white/15 bg-black/60 px-6 py-5 text-center backdrop-blur-md">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                <p className="text-sm font-bold">Loading {externalPlan.providerName}</p>
                <p className="max-w-sm text-xs leading-5 text-white/65">
                  If the provider blocks embedding, the tour will open securely in a new tab.
                </p>
              </div>
            </div>
          ) : null}

          {status === "failed" || !canEmbed ? (
            <div className="absolute inset-0 z-[6] grid place-items-center px-4">
              <div className="max-w-lg rounded-[1.5rem] border border-white/15 bg-black/65 p-6 text-center shadow-2xl backdrop-blur-md">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4bc6a]">
                  {externalPlan.providerName}
                </p>
                <h3 className="mt-3 text-2xl font-semibold">
                  Open the interactive plan in a new tab.
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  This provider may restrict iframe playback. The full experience opens securely with the provider controls intact.
                </p>
                <a
                  href={openPlanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#0f2440] transition hover:bg-[#f2e8c7]"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  Open interactive plan
                </a>
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="rounded-2xl border border-white/15 bg-black/55 px-4 py-3 backdrop-blur-md">
                <p className="text-sm font-semibold">{propertyTitle}</p>
                <p className="mt-1 text-xs text-white/55">
                  {status === "loaded"
                    ? `${externalPlan.providerName} interactive plan`
                    : "Ready to open"}
                </p>
              </div>
              <div className="pointer-events-auto flex flex-wrap gap-2">
                {openPlanUrl ? (
                  <a
                    href={openPlanUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/55 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-black/75"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Open interactive plan
                  </a>
                ) : null}
                {canEmbed ? (
                  <button
                    type="button"
                    onClick={openFullscreen}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#0f2440] transition hover:bg-[#f2e8c7]"
                  >
                    <Maximize2 className="h-4 w-4" aria-hidden />
                    View fullscreen
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NativeInteractiveFloorPlan({
  propertyTitle,
  floorPlan,
  gallery,
}: InteractivePropertyFloorPlanProps) {
  const rooms = useMemo(
    () =>
      gallery
        .filter((image) => image.roomId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [gallery],
  );
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id ?? "");
  const stageRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(
    rooms.findIndex((room) => room.id === selectedRoomId),
    0,
  );
  const selectedRoom = rooms[selectedIndex];

  if (!selectedRoom) return null;

  const selectRelativeRoom = (offset: number) => {
    const nextIndex = (selectedIndex + offset + rooms.length) % rooms.length;
    setSelectedRoomId(rooms[nextIndex].id);
  };

  const openFullscreen = async () => {
    const element = stageRef.current;
    if (!element || !document.fullscreenEnabled) return;
    try {
      await element.requestFullscreen();
    } catch {
      // The split-screen experience remains available without fullscreen.
    }
  };

  return (
    <section
      id="interactive-floor-plan"
      className="scroll-mt-36 bg-[#0f2440] py-6 text-white sm:py-10"
    >
      <div className="mx-auto max-w-[1680px] px-3 sm:px-6 lg:px-8">
        <div
          ref={stageRef}
          className="flex min-h-[82svh] flex-col overflow-hidden rounded-[1.5rem] bg-[#151515] shadow-[0_35px_120px_rgba(0,0,0,0.35)] sm:rounded-[2rem]"
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/45 px-4 py-4 sm:px-6 lg:px-8">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4bc6a] sm:text-xs">
                <MousePointer2 className="h-4 w-4" aria-hidden />
                Interactive floor plan
              </p>
              <p className="mt-1 text-sm font-semibold sm:text-lg">
                {propertyTitle} · {selectedRoom.label.en}
              </p>
            </div>
            <button
              type="button"
              onClick={openFullscreen}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/8 text-white transition hover:bg-white/15 sm:h-12 sm:w-12"
              aria-label="Open interactive floor plan fullscreen"
            >
              <Maximize2 className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="grid flex-1 lg:grid-cols-[0.46fr_0.54fr]">
            <div className="relative min-h-[430px] bg-[#ece9e2] p-3 sm:min-h-[560px] sm:p-6 lg:min-h-0">
              <Image
                src={floorPlan.imageUrl}
                alt={`${floorPlan.title.en} for ${propertyTitle}`}
                fill
                sizes="(min-width: 1024px) 46vw, 100vw"
                className="object-contain p-6 sm:p-10"
              />

              {rooms.map((room, index) => {
                const isSelected = room.id === selectedRoom.id;
                const position =
                  room.hotspot ?? fallbackPositions[index % fallbackPositions.length];
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoomId(room.id)}
                    aria-label={`Show ${room.label.en}`}
                    aria-pressed={isSelected}
                    className={`absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-xs font-bold shadow-xl transition hover:scale-110 sm:h-11 sm:w-11 ${
                      isSelected
                        ? "bg-[#c7a94e] text-[#0f2440]"
                        : "bg-[#0f2440] text-white"
                    }`}
                    style={{
                      left: `${position.xPercent}%`,
                      top: `${position.yPercent}%`,
                    }}
                  >
                    {room.label.en.charAt(0)}
                  </button>
                );
              })}
            </div>

            <div className="flex min-h-[520px] flex-col bg-black lg:min-h-0">
              <div className="relative flex-1 overflow-hidden">
                <Image
                  src={selectedRoom.src}
                  alt={selectedRoom.alt.en}
                  fill
                  sizes="(min-width: 1024px) 54vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/65" />
                <button
                  type="button"
                  onClick={() => selectRelativeRoom(-1)}
                  className="absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 sm:left-6 sm:h-14 sm:w-14"
                  aria-label="Previous room"
                >
                  <ChevronLeft className="h-6 w-6" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => selectRelativeRoom(1)}
                  className="absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 sm:right-6 sm:h-14 sm:w-14"
                  aria-label="Next room"
                >
                  <ChevronRight className="h-6 w-6" aria-hidden />
                </button>
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 lg:p-8">
                  <p className="text-2xl font-semibold sm:text-3xl">
                    {selectedRoom.label.en}
                  </p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
                    {selectedRoom.note?.en ?? selectedRoom.alt.en}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#d4bc6a]">
                    {selectedIndex + 1} of {rooms.length} room groups
                  </p>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto border-t border-white/10 bg-[#111] p-3 sm:p-4">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`relative h-20 min-w-28 overflow-hidden rounded-xl border-2 transition sm:h-24 sm:min-w-36 ${
                      room.id === selectedRoom.id
                        ? "border-[#c7a94e]"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                    aria-label={`Open ${room.label.en}`}
                  >
                    <Image
                      src={room.src}
                      alt=""
                      fill
                      sizes="144px"
                      className="object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1.5 text-left text-[10px] font-semibold text-white sm:text-xs">
                      {room.label.en}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
