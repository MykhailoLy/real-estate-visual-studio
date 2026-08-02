import type {
  PropertyFloorPlan,
  PropertyShowcase,
  PropertyTourProvider,
  PropertyVirtualTour,
} from "./types";

export interface NormalizedProviderUrl {
  provider: PropertyTourProvider;
  providerName: string;
  externalUrl: string;
  embedUrl?: string;
  canEmbed: boolean;
  inputKind: "url" | "iframe";
}

export interface ProviderUrlValidationResult {
  ok: boolean;
  property?: PropertyShowcase;
  errors: string[];
}

interface ProviderConfig {
  label: string;
  origins: readonly string[];
  embedOrigins: readonly string[];
  normalizeEmbed?: (url: URL) => URL | null;
}

const KNOWN_PROVIDER_CONFIGS: Record<
  Exclude<PropertyTourProvider, "custom">,
  ProviderConfig
> = {
  kuula: {
    label: "Kuula",
    origins: ["https://kuula.co", "https://mls.kuu.la"],
    embedOrigins: ["https://kuula.co"],
    normalizeEmbed: normalizeKuulaEmbedUrl,
  },
  matterport: {
    label: "Matterport",
    origins: ["https://my.matterport.com"],
    embedOrigins: ["https://my.matterport.com"],
  },
  cubiCasa: {
    label: "CubiCasa",
    origins: ["https://unbranded.visithome.ai", "https://visithome.ai"],
    embedOrigins: ["https://unbranded.visithome.ai", "https://visithome.ai"],
  },
  floorfy: {
    label: "Floorfy",
    origins: ["https://floorfy.com", "https://www.floorfy.com"],
    embedOrigins: ["https://floorfy.com", "https://www.floorfy.com"],
  },
  nodalview: {
    label: "Nodalview",
    origins: ["https://nodalview.com", "https://www.nodalview.com"],
    embedOrigins: ["https://www.nodalview.com"],
    normalizeEmbed: normalizeNodalviewEmbedUrl,
  },
};

const TOUR_PROVIDER_ORDER: readonly PropertyTourProvider[] = [
  "kuula",
  "matterport",
  "cubiCasa",
  "floorfy",
  "nodalview",
  "custom",
];

const PROPERTY_MEDIA_URL_REPAIRS = [
  ["/storage/v1/obmuject/", "/storage/v1/object/"],
  ["/storage/v1/objet/", "/storage/v1/object/"],
] as const;

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function getCustomFrameOrigins(): string[] {
  const raw =
    typeof process !== "undefined"
      ? process.env.PROPERTY_SHOWCASE_TRUSTED_FRAME_ORIGINS
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
          return url.protocol === "https:" ? originOf(url) : "";
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );
}

function providerConfig(provider: PropertyTourProvider): ProviderConfig {
  if (provider === "custom") {
    const origins = getCustomFrameOrigins();
    return {
      label: "Trusted provider",
      origins,
      embedOrigins: origins,
    };
  }

  return KNOWN_PROVIDER_CONFIGS[provider];
}

function originOf(url: URL): string {
  return `${url.protocol}//${url.hostname.toLowerCase()}`;
}

function hasOrigin(url: URL, origins: readonly string[]): boolean {
  return origins.includes(originOf(url));
}

export function getTrustedPropertyFrameOrigins(): string[] {
  return unique([
    ...Object.values(KNOWN_PROVIDER_CONFIGS).flatMap(
      (config) => config.embedOrigins,
    ),
    ...getCustomFrameOrigins(),
  ]);
}

export function extractIframeSrc(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";

  const match = trimmed.match(/<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i);
  return (match?.[2] ?? trimmed).replace(/&amp;/g, "&").trim();
}

function inputKind(value: string | undefined): NormalizedProviderUrl["inputKind"] {
  return value?.trim().toLowerCase().startsWith("<iframe") ? "iframe" : "url";
}

function safeHttpsUrl(value: string | undefined): URL | null {
  const extracted = extractIframeSrc(value);
  if (!extracted) return null;

  try {
    const url = new URL(extracted);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function normalizeKuulaEmbedUrl(url: URL): URL | null {
  const embedUrl = new URL(url);

  if (embedUrl.hostname.toLowerCase() === "mls.kuu.la") {
    embedUrl.hostname = "kuula.co";
  }

  if (embedUrl.pathname.startsWith("/post/")) {
    embedUrl.pathname = embedUrl.pathname.replace(/^\/post\//, "/share/");
  }

  if (!embedUrl.pathname.startsWith("/share/")) {
    return null;
  }

  embedUrl.searchParams.set("initload", "1");
  if (!embedUrl.searchParams.has("fs")) embedUrl.searchParams.set("fs", "1");

  return embedUrl;
}

function normalizeNodalviewEmbedUrl(url: URL): URL | null {
  const embedUrl = new URL(url);
  embedUrl.hostname = "www.nodalview.com";
  embedUrl.searchParams.set("iframe", "true");
  return embedUrl;
}

function normalizeProviderUrl(
  provider: PropertyTourProvider,
  value: string | undefined,
): NormalizedProviderUrl | null {
  const url = safeHttpsUrl(value);
  if (!url) return null;

  const config = providerConfig(provider);
  if (!hasOrigin(url, config.origins) && !hasOrigin(url, config.embedOrigins)) {
    return null;
  }

  const normalizedEmbed =
    config.normalizeEmbed?.(url) ?? (hasOrigin(url, config.embedOrigins) ? url : null);
  const embedUrl =
    normalizedEmbed && hasOrigin(normalizedEmbed, config.embedOrigins)
      ? normalizedEmbed.toString()
      : undefined;

  return {
    provider,
    providerName: config.label,
    externalUrl: url.toString(),
    embedUrl,
    canEmbed: Boolean(embedUrl),
    inputKind: inputKind(value),
  };
}

export function normalizeTourInput(
  provider: PropertyTourProvider,
  input: {
    embedUrl?: string;
    externalUrl?: string;
  },
): NormalizedProviderUrl | null {
  const embedCandidate = normalizeProviderUrl(provider, input.embedUrl);
  const externalCandidate = normalizeProviderUrl(provider, input.externalUrl);
  const candidate = embedCandidate ?? externalCandidate;

  if (!candidate) return null;

  return {
    ...candidate,
    externalUrl:
      externalCandidate?.externalUrl ??
      embedCandidate?.externalUrl ??
      candidate.externalUrl,
    embedUrl: embedCandidate?.embedUrl ?? externalCandidate?.embedUrl,
    canEmbed: Boolean(embedCandidate?.embedUrl ?? externalCandidate?.embedUrl),
  };
}

export function normalizeTourEmbedUrl(
  provider: PropertyTourProvider,
  value: string | undefined,
): string | undefined {
  return normalizeProviderUrl(provider, value)?.embedUrl;
}

export function normalizeExternalInteractiveUrl(
  value: string | undefined,
  provider?: PropertyTourProvider,
): string | undefined {
  if (provider) return normalizeProviderUrl(provider, value)?.externalUrl;
  return normalizeAnyProviderUrl(value)?.externalUrl;
}

export function normalizeFloorPlanInteractiveUrl(
  value: string | undefined,
): NormalizedProviderUrl | null {
  return normalizeAnyProviderUrl(value);
}

function normalizeAnyProviderUrl(
  value: string | undefined,
): NormalizedProviderUrl | null {
  for (const provider of TOUR_PROVIDER_ORDER) {
    const result = normalizeProviderUrl(provider, value);
    if (result) return result;
  }

  return null;
}

function normalizeStoredTour(
  tour: PropertyVirtualTour | undefined,
  errors: string[],
): PropertyVirtualTour | undefined {
  if (!tour) return undefined;
  const hasTourUrl = Boolean(tour.embedUrl?.trim() || tour.externalUrl?.trim());
  if (!hasTourUrl) return tour;

  const normalized = normalizeTourInput(tour.provider, {
    embedUrl: tour.embedUrl,
    externalUrl: tour.externalUrl,
  });

  if (!normalized) {
    errors.push(`Unsupported or unsafe ${tour.provider} tour URL.`);
    return tour;
  }

  return {
    ...tour,
    embedUrl: normalized.embedUrl,
    externalUrl: normalized.externalUrl,
  };
}

function normalizeStoredFloorPlan(
  floorPlan: PropertyFloorPlan,
  errors: string[],
): PropertyFloorPlan {
  if (!floorPlan.interactiveUrl?.trim()) return floorPlan;
  const normalized = normalizeFloorPlanInteractiveUrl(floorPlan.interactiveUrl);

  if (!normalized) {
    errors.push(`Unsupported or unsafe interactive floor-plan URL.`);
    return floorPlan;
  }

  return {
    ...floorPlan,
    interactiveUrl: normalized.externalUrl,
  };
}

export function normalizePropertyProviderUrls(
  property: PropertyShowcase,
): ProviderUrlValidationResult {
  const errors: string[] = [];
  const next: PropertyShowcase = {
    ...property,
    virtualTour: normalizeStoredTour(property.virtualTour, errors),
    floorPlans: property.floorPlans.map((floorPlan) =>
      normalizeStoredFloorPlan(floorPlan, errors),
    ),
  };

  return {
    ok: errors.length === 0,
    property: errors.length === 0 ? next : undefined,
    errors,
  };
}

export function repairPropertyMediaUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  return PROPERTY_MEDIA_URL_REPAIRS.reduce(
    (current, [from, to]) => current.replace(from, to),
    trimmed,
  );
}

export function isPublicSupabaseObjectUrl(value: string | undefined): boolean {
  return Boolean(value?.includes("/storage/v1/object/public/"));
}
