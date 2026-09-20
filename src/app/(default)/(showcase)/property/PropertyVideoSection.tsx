"use client";

import Image from "next/image";
import { ExternalLink, Loader2, Maximize2, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { localizedText } from "@/features/property-showcase/localization";
import { PROPERTY_MEDIA_LABELS } from "@/features/property-showcase/media-labels";
import type {
  PropertyLanguageCode,
  PropertyVideoItem,
} from "@/features/property-showcase/types";

type PropertyVideoSectionProps = {
  propertyTitle: string;
  videos: PropertyVideoItem[];
  posterFallback: string;
  locale: PropertyLanguageCode;
  primaryLanguage: PropertyLanguageCode;
  onVideoStarted?: () => void;
};

type PlayerStatus = "poster" | "opening" | "frame-visible" | "frame-unconfirmed";

export default function PropertyVideoSection({
  propertyTitle,
  videos,
  posterFallback,
  locale,
  primaryLanguage,
  onVideoStarted,
}: PropertyVideoSectionProps) {
  const [selectedId, setSelectedId] = useState(videos[0]?.id ?? "");
  const [playerState, setPlayerState] = useState<{
    videoId: string;
    status: PlayerStatus;
  }>({ videoId: videos[0]?.id ?? "", status: "poster" });
  const playerRef = useRef<HTMLDivElement>(null);
  const labels = PROPERTY_MEDIA_LABELS[locale] ?? PROPERTY_MEDIA_LABELS.en;
  const selected =
    videos.find((video) => video.id === selectedId) ?? videos[0];
  const status =
    selected && playerState.videoId === selected.id
      ? playerState.status
      : "poster";

  useEffect(() => {
    if (!selected || status !== "opening") return undefined;

    const timeout = window.setTimeout(() => {
      setPlayerState((current) =>
        current.videoId === selected.id && current.status === "opening"
          ? { ...current, status: "frame-unconfirmed" }
          : current,
      );
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [selected, status]);

  if (!selected) return null;

  const title =
    localizedText(selected.title, locale, primaryLanguage) ||
    `${labels.video}: ${propertyTitle}`;
  const poster = selected.posterUrl?.trim() || posterFallback;
  const canEmbed = Boolean(selected.embedUrl?.trim());
  const externalUrl = selected.externalUrl?.trim() || selected.embedUrl?.trim();
  const frameIsVisible =
    status === "frame-visible" || status === "frame-unconfirmed";

  async function openFullscreen() {
    if (!playerRef.current || !document.fullscreenEnabled) return;
    try {
      await playerRef.current.requestFullscreen();
    } catch {
      // The player and external fallback remain available without fullscreen.
    }
  }

  return (
    <section
      id="video"
      data-testid="property-video-section"
      className="scroll-mt-24 bg-white py-12 sm:py-16"
    >
      <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-10">
        <h2 className="mb-5 text-2xl font-semibold text-[#0f2440] sm:text-3xl">
          {labels.video}
        </h2>
        <div className={videos.length > 1 ? "grid gap-5 lg:grid-cols-[1fr_280px]" : ""}>
          <div
            ref={playerRef}
            className="overflow-hidden rounded-lg border border-black/10 bg-black shadow-[0_24px_70px_rgba(15,36,64,0.16)]"
          >
            <div className="relative aspect-video w-full">
              {status !== "poster" && canEmbed ? (
                <iframe
                  key={selected.id}
                  src={selected.embedUrl}
                  title={title}
                  className={`absolute inset-0 h-full w-full border-0 bg-black transition-opacity duration-300 ${
                    frameIsVisible ? "opacity-100" : "opacity-0"
                  }`}
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  loading="lazy"
                  onLoad={() =>
                    setPlayerState({
                      videoId: selected.id,
                      status: "frame-visible",
                    })
                  }
                  referrerPolicy="strict-origin-when-cross-origin"
                  data-testid="property-video-iframe"
                />
              ) : null}

              {!frameIsVisible ? (
                <>
                  <Image
                    src={poster}
                    alt={title}
                    fill
                    sizes="(min-width: 1024px) 75vw, 100vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20" />
                </>
              ) : null}

              {status === "poster" ? (
                <div className="absolute inset-0 grid place-items-center px-4">
                  {canEmbed ? (
                    <button
                      type="button"
                      onClick={() => {
                        onVideoStarted?.();
                        setPlayerState({
                          videoId: selected.id,
                          status: "opening",
                        });
                      }}
                      className="inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0f2440] shadow-xl transition hover:bg-[#f2e8c7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                      aria-label={`${labels.videoCta}: ${title}`}
                    >
                      <Play className="h-5 w-5 fill-current" aria-hidden />
                      {labels.videoCta}
                    </button>
                  ) : externalUrl ? (
                    <a
                      href={externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={onVideoStarted}
                      className="inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0f2440] shadow-xl transition hover:bg-[#f2e8c7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                      <ExternalLink className="h-5 w-5" aria-hidden />
                      {labels.videoCta}
                    </a>
                  ) : null}
                </div>
              ) : null}

              {status === "opening" ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <Loader2 className="h-9 w-9 animate-spin text-white" aria-hidden />
                  <span className="sr-only">{labels.videoCta}</span>
                </div>
              ) : null}
            </div>

            {canEmbed && status !== "poster" ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 bg-[#071426] px-3 py-3 sm:px-4">
                {externalUrl ? (
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white transition hover:border-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    {labels.openVideo}
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={openFullscreen}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0f2440] transition hover:bg-[#f2e8c7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm"
                  aria-label={`${labels.fullscreen}: ${title}`}
                >
                  <Maximize2 className="h-4 w-4" aria-hidden />
                  {labels.fullscreen}
                </button>
              </div>
            ) : null}
          </div>

          {videos.length > 1 ? (
            <div
              aria-label="Property videos"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:max-h-[min(68vh,620px)] lg:grid-cols-1 lg:overflow-y-auto lg:pr-1"
            >
              {videos.map((video, index) => {
                const itemTitle =
                  localizedText(video.title, locale, primaryLanguage) ||
                  `${labels.video} ${index + 1}`;
                return (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(video.id);
                      setPlayerState({ videoId: video.id, status: "poster" });
                    }}
                    aria-pressed={video.id === selected.id}
                    className={`min-w-0 rounded-lg border bg-white p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f2440] ${
                      video.id === selected.id
                        ? "border-[#0f2440] shadow-sm"
                        : "border-black/10 hover:border-[#0f2440]/45"
                    }`}
                  >
                    <span className="line-clamp-2 text-sm font-bold leading-5 text-[#0f2440]">
                      {itemTitle}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {video.provider === "cloudflare-stream"
                        ? "Cloudflare Stream"
                        : video.provider === "youtube"
                          ? "YouTube"
                          : video.provider.charAt(0).toUpperCase() + video.provider.slice(1)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
