import type {
  PropertyShowcase,
  PropertyVideoItem,
  PropertyVideoProvider,
} from "./types.ts";

export interface NormalizedPropertyVideo {
  provider: PropertyVideoProvider;
  providerName: string;
  externalUrl?: string;
  embedUrl?: string;
  playbackId?: string;
  inputKind: "url" | "iframe" | "playback-id";
  canEmbed: boolean;
}

export interface PropertyVideoValidationResult {
  ok: boolean;
  property?: PropertyShowcase;
  errors: string[];
}

const VIDEO_PROVIDER_LABELS: Record<PropertyVideoProvider, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  "cloudflare-stream": "Cloudflare Stream",
  mux: "Mux",
  custom: "Trusted custom provider",
};

const KNOWN_VIDEO_FRAME_ORIGINS = [
  "https://www.youtube.com",
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://iframe.videodelivery.net",
  "https://player.mux.com",
] as const;

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function configuredCustomVideoOrigins(): string[] {
  const raw =
    typeof process !== "undefined"
      ? process.env.PROPERTY_SHOWCASE_TRUSTED_VIDEO_ORIGINS
      : undefined;
  if (!raw) return [];

  return unique(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        try {
          const url = new URL(value);
          if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            url.port ||
            url.pathname !== "/" ||
            url.search ||
            url.hash
          ) {
            return "";
          }
          return url.origin.toLowerCase();
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );
}

export function getTrustedPropertyVideoFrameOrigins(): string[] {
  return unique([
    ...KNOWN_VIDEO_FRAME_ORIGINS,
    ...configuredCustomVideoOrigins(),
  ]);
}

function extractIframeSource(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i);
  return (match?.[2] ?? trimmed).replace(/&amp;/g, "&").trim();
}

function safeHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(extractIframeSource(value));
    if (url.protocol !== "https:" || url.username || url.password || url.port) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function isIframeInput(value: string): boolean {
  return value.trim().toLowerCase().startsWith("<iframe");
}

function safePlaybackId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && /^[A-Za-z0-9_-]{6,240}$/.test(trimmed)
    ? trimmed
    : undefined;
}

function youtubeVideoId(url: URL): string | undefined {
  const hostname = url.hostname.toLowerCase();
  const candidate =
    hostname === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")
        ? url.pathname.split("/").filter(Boolean)[1]
        : url.searchParams.get("v") ?? undefined;
  return candidate && /^[A-Za-z0-9_-]{6,20}$/.test(candidate)
    ? candidate
    : undefined;
}

function normalizeYouTube(value: string): NormalizedPropertyVideo | null {
  const url = safeHttpsUrl(value);
  if (!url) return null;
  const origin = url.origin.toLowerCase();
  if (
    ![
      "https://youtube.com",
      "https://www.youtube.com",
      "https://m.youtube.com",
      "https://youtu.be",
      "https://www.youtube-nocookie.com",
    ].includes(origin)
  ) {
    return null;
  }
  const playbackId = youtubeVideoId(url);
  if (!playbackId) return null;
  return {
    provider: "youtube",
    providerName: VIDEO_PROVIDER_LABELS.youtube,
    externalUrl: `https://www.youtube.com/watch?v=${playbackId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${playbackId}`,
    playbackId,
    inputKind: isIframeInput(value) ? "iframe" : "url",
    canEmbed: true,
  };
}

function vimeoVideoId(url: URL): string | undefined {
  const segments = url.pathname.split("/").filter(Boolean);
  const candidate = url.hostname.toLowerCase() === "player.vimeo.com"
    ? segments[1]
    : segments[0];
  return candidate && /^\d{5,20}$/.test(candidate) ? candidate : undefined;
}

function normalizeVimeo(value: string): NormalizedPropertyVideo | null {
  const url = safeHttpsUrl(value);
  if (!url) return null;
  const origin = url.origin.toLowerCase();
  if (
    ![
      "https://vimeo.com",
      "https://www.vimeo.com",
      "https://player.vimeo.com",
    ].includes(origin)
  ) {
    return null;
  }
  const playbackId = vimeoVideoId(url);
  if (!playbackId) return null;
  return {
    provider: "vimeo",
    providerName: VIDEO_PROVIDER_LABELS.vimeo,
    externalUrl: `https://vimeo.com/${playbackId}`,
    embedUrl: `https://player.vimeo.com/video/${playbackId}`,
    playbackId,
    inputKind: isIframeInput(value) ? "iframe" : "url",
    canEmbed: true,
  };
}

function streamPlaybackId(url: URL): string | undefined {
  return safePlaybackId(url.pathname.split("/").filter(Boolean)[0]);
}

function normalizeCloudflareStream(
  value: string,
): NormalizedPropertyVideo | null {
  const url = safeHttpsUrl(value);
  if (!url) return null;
  const origin = url.origin.toLowerCase();
  if (
    ![
      "https://iframe.videodelivery.net",
      "https://watch.videodelivery.net",
    ].includes(origin)
  ) {
    return null;
  }
  const playbackId = streamPlaybackId(url);
  if (!playbackId) return null;
  return {
    provider: "cloudflare-stream",
    providerName: VIDEO_PROVIDER_LABELS["cloudflare-stream"],
    externalUrl: `https://watch.videodelivery.net/${playbackId}`,
    embedUrl: `https://iframe.videodelivery.net/${playbackId}`,
    playbackId,
    inputKind: isIframeInput(value) ? "iframe" : "url",
    canEmbed: true,
  };
}

function normalizeMux(value: string): NormalizedPropertyVideo | null {
  const url = safeHttpsUrl(value);
  if (!url || url.origin.toLowerCase() !== "https://player.mux.com") {
    return null;
  }
  const playbackId = safePlaybackId(url.pathname.split("/").filter(Boolean)[0]);
  if (!playbackId) return null;
  const playerUrl = `https://player.mux.com/${playbackId}`;
  return {
    provider: "mux",
    providerName: VIDEO_PROVIDER_LABELS.mux,
    externalUrl: playerUrl,
    embedUrl: playerUrl,
    playbackId,
    inputKind: isIframeInput(value) ? "iframe" : "url",
    canEmbed: true,
  };
}

function normalizeCustom(value: string): NormalizedPropertyVideo | null {
  const url = safeHttpsUrl(value);
  if (!url || !configuredCustomVideoOrigins().includes(url.origin.toLowerCase())) {
    return null;
  }
  const iframe = isIframeInput(value);
  return {
    provider: "custom",
    providerName: VIDEO_PROVIDER_LABELS.custom,
    externalUrl: url.toString(),
    embedUrl: iframe ? url.toString() : undefined,
    inputKind: iframe ? "iframe" : "url",
    canEmbed: iframe,
  };
}

function normalizeByProvider(
  provider: PropertyVideoProvider,
  value: string,
): NormalizedPropertyVideo | null {
  switch (provider) {
    case "youtube":
      return normalizeYouTube(value);
    case "vimeo":
      return normalizeVimeo(value);
    case "cloudflare-stream":
      return normalizeCloudflareStream(value);
    case "mux":
      return normalizeMux(value);
    case "custom":
      return normalizeCustom(value);
  }
}

function normalizeExplicitEmbed(
  provider: PropertyVideoProvider,
  value: string,
): NormalizedPropertyVideo | null {
  const normalized = normalizeByProvider(provider, value);
  if (!normalized) return null;
  if (provider !== "custom") return normalized.embedUrl ? normalized : null;
  return {
    ...normalized,
    embedUrl: normalized.externalUrl,
    canEmbed: Boolean(normalized.externalUrl),
    inputKind: "iframe",
  };
}

export function normalizePropertyVideoInput(
  provider: PropertyVideoProvider,
  input: {
    value?: string;
    externalUrl?: string;
    embedUrl?: string;
    playbackId?: string;
  },
): NormalizedPropertyVideo | null {
  const primaryValue = input.value?.trim();
  const embedValue = input.embedUrl?.trim();
  const externalValue = input.externalUrl?.trim();
  const direct = primaryValue ? normalizeByProvider(provider, primaryValue) : null;
  const embed = embedValue ? normalizeExplicitEmbed(provider, embedValue) : null;
  const external = externalValue
    ? normalizeByProvider(provider, externalValue)
    : null;

  if (primaryValue && !direct) return null;
  if (embedValue && !embed?.embedUrl) return null;
  if (externalValue && !external) return null;

  const candidate = direct ?? embed ?? external;
  const playbackId =
    candidate?.playbackId ?? safePlaybackId(input.playbackId);

  if (!candidate && playbackId) {
    if (provider === "cloudflare-stream") {
      return normalizeCloudflareStream(
        `https://iframe.videodelivery.net/${playbackId}`,
      );
    }
    if (provider === "mux") {
      return normalizeMux(`https://player.mux.com/${playbackId}`);
    }
  }
  if (!candidate) return null;

  return {
    ...candidate,
    externalUrl: external?.externalUrl ?? direct?.externalUrl ?? candidate.externalUrl,
    embedUrl: embed?.embedUrl ?? direct?.embedUrl ?? candidate.embedUrl,
    playbackId,
    canEmbed: Boolean(embed?.embedUrl ?? direct?.embedUrl ?? candidate.embedUrl),
  };
}

function normalizeStoredVideo(
  video: PropertyVideoItem,
  errors: string[],
): PropertyVideoItem {
  const normalized = normalizePropertyVideoInput(video.provider, {
    externalUrl: video.externalUrl,
    embedUrl: video.embedUrl,
    playbackId: video.playbackId,
  });
  if (!normalized) {
    errors.push(`Unsupported or unsafe ${video.provider} video URL.`);
    return video;
  }

  return {
    ...video,
    provider: normalized.provider,
    externalUrl: normalized.externalUrl,
    embedUrl: normalized.embedUrl,
    playbackId: normalized.playbackId,
  };
}

export function normalizePropertyVideoUrls(
  property: PropertyShowcase,
): PropertyVideoValidationResult {
  if (!property.videos) return { ok: true, property, errors: [] };
  const errors: string[] = [];
  const items = property.videos.items.map((video) =>
    normalizeStoredVideo(video, errors),
  );
  return {
    ok: errors.length === 0,
    property:
      errors.length === 0
        ? { ...property, videos: { ...property.videos, items } }
        : undefined,
    errors,
  };
}

export function sortedUsablePropertyVideos(
  property: PropertyShowcase,
): PropertyVideoItem[] {
  if (!property.videos || property.videos.enabled === false) return [];
  return property.videos.items
    .filter((video) => {
      if (video.enabled === false) return false;
      return Boolean(video.embedUrl?.trim() || video.externalUrl?.trim());
    })
    .sort((a, b) => {
      if (a.primary !== b.primary) return a.primary ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });
}
