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
  getInteractiveFloorPlanOpenAction,
  normalizeInteractiveFloorPlanInput,
  type NormalizedInteractiveFloorPlanUrl,
} from "@/features/property-showcase/provider-urls";
import {
  localizedText,
  PUBLIC_UI_LABELS,
} from "@/features/property-showcase/localization";
import { PROPERTY_MEDIA_LABELS } from "@/features/property-showcase/media-labels";
import type {
  PropertyFloorPlan,
  PropertyGalleryImage,
  PropertyInteractiveFloorPlanTour,
  PropertyLanguageCode,
} from "@/features/property-showcase/types";

type InteractivePropertyFloorPlanProps = {
  propertyTitle: string;
  floorPlan?: PropertyFloorPlan;
  interactiveTour?: PropertyInteractiveFloorPlanTour;
  gallery: PropertyGalleryImage[];
  locale?: PropertyLanguageCode;
  primaryLanguage?: PropertyLanguageCode;
  onInteractiveFloorPlanOpened?: () => void;
};

const fallbackPositions = [
  { xPercent: 48, yPercent: 48 },
  { xPercent: 49, yPercent: 16 },
  { xPercent: 24, yPercent: 58 },
  { xPercent: 66, yPercent: 52 },
  { xPercent: 34, yPercent: 35 },
];

type EmbeddedFrameStatus =
  | "poster"
  | "opening"
  | "frame-visible"
  | "frame-unconfirmed";

export default function InteractivePropertyFloorPlan(
  props: InteractivePropertyFloorPlanProps,
) {
  const externalPlan = props.interactiveTour?.enabled
    ? normalizeInteractiveFloorPlanInput({
        provider: props.interactiveTour.provider,
        externalUrl: props.interactiveTour.externalUrl,
        embedUrl: props.interactiveTour.embedUrl,
      })
    : props.floorPlan
      ? normalizeInteractiveFloorPlanInput({
          provider: props.floorPlan.interactiveProvider,
          externalUrl: props.floorPlan.interactiveExternalUrl,
          embedUrl: props.floorPlan.interactiveEmbedUrl,
          interactiveUrl: props.floorPlan.interactiveUrl,
        })
      : null;

  if (externalPlan) {
    return (
      <ExternalInteractiveFloorPlan {...props} externalPlan={externalPlan} />
    );
  }

  if (!props.floorPlan) return null;
  return <NativeInteractiveFloorPlan {...props} floorPlan={props.floorPlan} />;
}

function ExternalInteractiveFloorPlan({
  propertyTitle,
  floorPlan,
  interactiveTour,
  gallery,
  locale,
  primaryLanguage,
  onInteractiveFloorPlanOpened,
  externalPlan,
}: InteractivePropertyFloorPlanProps & {
  externalPlan: NormalizedInteractiveFloorPlanUrl;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<EmbeddedFrameStatus>("poster");
  const canEmbed = Boolean(externalPlan.embedUrl);
  const openAction = getInteractiveFloorPlanOpenAction(externalPlan);
  const openPlanUrl = openAction?.url ?? "";
  const posterImage =
    interactiveTour?.posterImage ?? floorPlan?.imageUrl ?? gallery[0]?.src ?? "";
  const language = locale ?? primaryLanguage ?? "en";
  const fallbackLanguage = primaryLanguage ?? language;
  const ui = PUBLIC_UI_LABELS[language] ?? PUBLIC_UI_LABELS.en;
  const mediaLabels =
    PROPERTY_MEDIA_LABELS[language] ?? PROPERTY_MEDIA_LABELS.en;
  const openPlanLabel = openAction?.isOriginalUrl
    ? mediaLabels.openOriginalInteractivePlan
    : mediaLabels.openInteractivePlanNewTab;
  const posterTitle =
    localizedText(floorPlan?.title, language, fallbackLanguage) ||
    ui.interactiveFloorPlan;
  const showIframe = canEmbed && status !== "poster";
  const showPoster =
    !canEmbed || status === "poster" || status === "opening";
  const iframeIsVisible =
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
    onInteractiveFloorPlanOpened?.();
    if (canEmbed) {
      setStatus("opening");
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
      className="scroll-mt-36 bg-[#0f2440] py-12 text-white sm:py-16"
    >
      <div className="mx-auto max-w-[1680px] px-3 sm:px-6 lg:px-8">
        <h2 className="mb-5 px-1 text-2xl font-semibold sm:text-3xl">
          {ui.interactiveFloorPlan}
        </h2>
        <div
          ref={stageRef}
          className="overflow-hidden rounded-lg border border-white/10 bg-[#111] shadow-[0_28px_80px_rgba(0,0,0,0.3)]"
        >
          <div className="relative min-h-[68svh] sm:min-h-[78svh]">
          {showIframe ? (
            <iframe
              src={externalPlan.embedUrl}
              title={`${ui.interactiveFloorPlan}: ${propertyTitle}`}
              className={`absolute inset-0 h-full w-full border-0 bg-white transition-opacity duration-300 ${
                iframeIsVisible ? "opacity-100" : "opacity-0"
              }`}
              allow="fullscreen; accelerometer; gyroscope"
              allowFullScreen
              loading="lazy"
              onLoad={() => setStatus("frame-visible")}
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : null}

          {showPoster ? (
            <>
              {posterImage ? (
                <Image
                  src={posterImage}
                  alt={`${posterTitle} for ${propertyTitle}`}
                  fill
                  sizes="100vw"
                  className="object-contain bg-[#ece9e2] p-5 sm:p-10"
                />
              ) : null}
              <div className="absolute inset-0 bg-black/15" />
            </>
          ) : null}

          {status === "poster" && canEmbed ? (
            <div className="absolute inset-0 z-[5] grid place-items-center px-4">
              <button
                type="button"
                onClick={activate}
                className="inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0f2440] shadow-xl transition hover:bg-[#f2e8c7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                aria-label={ui.interactiveFloorPlanCta}
              >
                <Play className="h-5 w-5 fill-current" aria-hidden />
                {ui.interactiveFloorPlanCta}
              </button>
            </div>
          ) : null}

          {status === "opening" ? (
            <div className="pointer-events-none absolute inset-0 z-[6] grid place-items-center">
              <Loader2 className="h-9 w-9 animate-spin text-white drop-shadow-lg" aria-hidden />
              <span className="sr-only">{ui.interactiveFloorPlanCta}</span>
            </div>
          ) : null}

          {!canEmbed ? (
            <div className="absolute inset-0 z-[6] grid place-items-center px-4">
              <a
                href={openPlanUrl}
                target="_blank"
                rel="noreferrer"
                onClick={onInteractiveFloorPlanOpened}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0f2440] shadow-xl transition hover:bg-[#f2e8c7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <ExternalLink className="h-5 w-5" aria-hidden />
                {ui.interactiveFloorPlanCta}
              </a>
            </div>
          ) : null}

          </div>

          {canEmbed && status !== "poster" ? (
            <div
              data-testid="interactive-plan-controls"
              className="flex flex-col gap-3 border-t border-white/10 bg-[#071426] px-3 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-4"
            >
              {openPlanUrl ? (
                <span className="text-xs text-white/60">
                  {mediaLabels.interactivePlanTrouble}
                </span>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {openPlanUrl ? (
                  <a
                    href={openPlanUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white transition hover:border-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    {openPlanLabel}
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={openFullscreen}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0f2440] transition hover:bg-[#f2e8c7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm"
                  aria-label={`${mediaLabels.fullscreen}: ${ui.interactiveFloorPlan}`}
                >
                  <Maximize2 className="h-4 w-4" aria-hidden />
                  {mediaLabels.fullscreen}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function NativeInteractiveFloorPlan({
  propertyTitle,
  floorPlan,
  gallery,
  locale,
  primaryLanguage,
  onInteractiveFloorPlanOpened,
}: InteractivePropertyFloorPlanProps & { floorPlan: PropertyFloorPlan }) {
  const language = locale ?? primaryLanguage ?? "en";
  const fallbackLanguage = primaryLanguage ?? language;
  const ui = PUBLIC_UI_LABELS[language] ?? PUBLIC_UI_LABELS.en;
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
    onInteractiveFloorPlanOpened?.();
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
                {ui.interactiveFloorPlan}
              </p>
              <p className="mt-1 text-sm font-semibold sm:text-lg">
                {propertyTitle} {"\u00b7"}{" "}
                {localizedText(selectedRoom.label, language, fallbackLanguage)}
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
                alt={`${localizedText(
                  floorPlan.title,
                  language,
                  fallbackLanguage,
                )} for ${propertyTitle}`}
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
                    aria-label={`Show ${localizedText(
                      room.label,
                      language,
                      fallbackLanguage,
                    )}`}
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
                    {localizedText(room.label, language, fallbackLanguage).charAt(0)}
                  </button>
                );
              })}
            </div>

            <div className="flex min-h-[520px] flex-col bg-black lg:min-h-0">
              <div className="relative flex-1 overflow-hidden">
                <Image
                  src={selectedRoom.src}
                  alt={localizedText(
                    selectedRoom.alt,
                    language,
                    fallbackLanguage,
                  )}
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
                    {localizedText(selectedRoom.label, language, fallbackLanguage)}
                  </p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
                    {localizedText(
                      selectedRoom.note ?? selectedRoom.alt,
                      language,
                      fallbackLanguage,
                    )}
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
                    aria-label={`Open ${localizedText(
                      room.label,
                      language,
                      fallbackLanguage,
                    )}`}
                  >
                    <Image
                      src={room.src}
                      alt=""
                      fill
                      sizes="144px"
                      className="object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1.5 text-left text-[10px] font-semibold text-white sm:text-xs">
                      {localizedText(room.label, language, fallbackLanguage)}
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
