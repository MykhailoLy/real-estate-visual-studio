import type {
  PropertyFloorPlan,
  PropertyInteractiveFloorPlanTour,
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

export interface NormalizedInteractiveFloorPlanUrl {
  provider: PropertyTourProvider;
  providerName: string;
  externalUrl?: string;
  embedUrl?: string;
  canEmbed: boolean;
  inputKind: "url" | "iframe";
}

export interface InteractiveFloorPlanOpenAction {
  url: string;
  label: string;
  isOriginalUrl: boolean;
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

interface NormalizeProviderUrlOptions {
  allowIframeAsEmbed?: boolean;
  allowUrlAsEmbed?: boolean;
  requireEmbed?: boolean;
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
  return url.origin.toLowerCase();
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
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (url.port) return null;
    return url;
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
  options: NormalizeProviderUrlOptions = {},
): NormalizedProviderUrl | null {
  const url = safeHttpsUrl(value);
  if (!url) return null;

  const config = providerConfig(provider);
  if (!hasOrigin(url, config.origins) && !hasOrigin(url, config.embedOrigins)) {
    return null;
  }

  const kind = inputKind(value);
  const shouldResolveEmbed =
    options.requireEmbed === true ||
    (kind === "iframe" && options.allowIframeAsEmbed !== false) ||
    (kind === "url" && options.allowUrlAsEmbed !== false);
  const normalizedEmbed = shouldResolveEmbed
    ? config.normalizeEmbed?.(url) ??
      (hasOrigin(url, config.embedOrigins) ? url : null)
    : null;
  const embedUrl =
    normalizedEmbed && hasOrigin(normalizedEmbed, config.embedOrigins)
      ? normalizedEmbed.toString()
      : undefined;

  if (options.requireEmbed && !embedUrl) return null;

  return {
    provider,
    providerName: config.label,
    externalUrl: url.toString(),
    embedUrl,
    canEmbed: Boolean(embedUrl),
    inputKind: kind,
  };
}

function normalizeProviderExternalUrl(
  provider: PropertyTourProvider,
  value: string | undefined,
): NormalizedProviderUrl | null {
  return normalizeProviderUrl(provider, value, {
    allowIframeAsEmbed: false,
    allowUrlAsEmbed: false,
  });
}

function normalizeProviderEmbedUrl(
  provider: PropertyTourProvider,
  value: string | undefined,
): NormalizedProviderUrl | null {
  return normalizeProviderUrl(provider, value, { requireEmbed: true });
}

export function normalizeTourPrimaryInput(
  value: string | undefined,
  preferredProvider?: PropertyTourProvider,
): NormalizedProviderUrl | null {
  const providers = preferredProvider
    ? [preferredProvider, ...TOUR_PROVIDER_ORDER.filter((item) => item !== preferredProvider)]
    : TOUR_PROVIDER_ORDER;

  for (const provider of providers) {
    const result = normalizeProviderUrl(provider, value);
    if (result) return result;
  }

  return null;
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
  if (provider) return normalizeProviderExternalUrl(provider, value)?.externalUrl;
  return normalizeAnyProviderExternalUrl(value)?.externalUrl;
}

export function normalizeFloorPlanInteractiveUrl(
  value: string | undefined,
): NormalizedInteractiveFloorPlanUrl | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const normalized = normalizeInteractiveFloorPlanPrimaryInput(trimmed);
  if (!normalized) return null;

  return {
    provider: normalized.provider,
    providerName: normalized.providerName,
    externalUrl:
      normalized.inputKind === "iframe" ? undefined : normalized.externalUrl,
    embedUrl: normalized.embedUrl,
    canEmbed: Boolean(normalized.embedUrl),
    inputKind: normalized.inputKind,
  };
}

export function getInteractiveFloorPlanOpenAction(
  plan: NormalizedInteractiveFloorPlanUrl,
): InteractiveFloorPlanOpenAction | null {
  if (plan.externalUrl?.trim()) {
    return {
      url: plan.externalUrl,
      label: "Open original interactive plan",
      isOriginalUrl: true,
    };
  }

  if (plan.embedUrl?.trim()) {
    return {
      url: plan.embedUrl,
      label: "Open interactive plan in new tab",
      isOriginalUrl: false,
    };
  }

  return null;
}

function looksLikeExplicitEmbedUrl(url: URL): boolean {
  const pathname = url.pathname.toLowerCase();
  const params = url.searchParams;
  return (
    pathname.includes("/embed") ||
    pathname.includes("/iframe") ||
    params.get("iframe") === "true" ||
    params.get("mode") === "embed" ||
    params.has("embed")
  );
}

export function normalizeInteractiveFloorPlanPrimaryInput(
  value: string | undefined,
  preferredProvider?: PropertyTourProvider,
):
  | (NormalizedProviderUrl & {
      inputKind: "url" | "iframe";
    })
  | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const providers = preferredProvider
    ? [preferredProvider, ...TOUR_PROVIDER_ORDER.filter((item) => item !== preferredProvider)]
    : TOUR_PROVIDER_ORDER;

  if (inputKind(trimmed) === "iframe") {
    for (const provider of providers) {
      const result = normalizeProviderEmbedUrl(provider, trimmed);
      if (result) return result;
    }
    return null;
  }

  const url = safeHttpsUrl(trimmed);
  if (!url) return null;
  const explicitEmbed = looksLikeExplicitEmbedUrl(url);

  for (const provider of providers) {
    const result = explicitEmbed
      ? normalizeProviderEmbedUrl(provider, trimmed)
      : normalizeProviderExternalUrl(provider, trimmed);
    if (result) return result;
  }

  return null;
}

function normalizeAnyProviderExternalUrl(
  value: string | undefined,
): NormalizedProviderUrl | null {
  for (const provider of TOUR_PROVIDER_ORDER) {
    const result = normalizeProviderExternalUrl(provider, value);
    if (result) return result;
  }

  return null;
}

function normalizeAnyProviderEmbedUrl(
  value: string | undefined,
): NormalizedProviderUrl | null {
  for (const provider of TOUR_PROVIDER_ORDER) {
    const result = normalizeProviderEmbedUrl(provider, value);
    if (result) return result;
  }

  return null;
}

export function normalizeInteractiveFloorPlanInput(input: {
  provider?: PropertyTourProvider;
  externalUrl?: string;
  embedUrl?: string;
  interactiveUrl?: string;
}): NormalizedInteractiveFloorPlanUrl | null {
  const externalCandidate = input.externalUrl?.trim()
    ? input.provider
      ? normalizeProviderExternalUrl(input.provider, input.externalUrl)
      : normalizeAnyProviderExternalUrl(input.externalUrl)
    : null;
  const embedCandidate = input.embedUrl?.trim()
    ? input.provider
      ? normalizeProviderEmbedUrl(input.provider, input.embedUrl)
      : normalizeAnyProviderEmbedUrl(input.embedUrl)
    : null;
  const legacyCandidate = input.interactiveUrl?.trim()
    ? normalizeFloorPlanInteractiveUrl(input.interactiveUrl)
    : null;

  if (input.externalUrl?.trim() && !externalCandidate) return null;
  if (input.embedUrl?.trim() && !embedCandidate) return null;
  if (input.interactiveUrl?.trim() && !legacyCandidate) return null;

  const candidates = [externalCandidate, embedCandidate, legacyCandidate].filter(
    (candidate): candidate is
      | NormalizedProviderUrl
      | NormalizedInteractiveFloorPlanUrl => Boolean(candidate),
  );

  if (candidates.length === 0) return null;

  const providers = new Set(candidates.map((candidate) => candidate.provider));
  if (providers.size > 1) return null;

  const provider =
    input.provider ??
    externalCandidate?.provider ??
    embedCandidate?.provider ??
    legacyCandidate?.provider;
  if (!provider) return null;

  const config = providerConfig(provider);
  const embedUrl = embedCandidate?.embedUrl ?? legacyCandidate?.embedUrl;
  const externalUrl =
    externalCandidate?.externalUrl ?? legacyCandidate?.externalUrl;

  return {
    provider,
    providerName: config.label,
    externalUrl,
    embedUrl,
    canEmbed: Boolean(embedUrl),
    inputKind:
      embedCandidate?.inputKind ??
      externalCandidate?.inputKind ??
      legacyCandidate?.inputKind ??
      "url",
  };
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
  const hasInteractiveInput = Boolean(
    floorPlan.interactiveExternalUrl?.trim() ||
      floorPlan.interactiveEmbedUrl?.trim() ||
      floorPlan.interactiveUrl?.trim(),
  );
  if (!hasInteractiveInput) {
    return {
      id: floorPlan.id,
      title: floorPlan.title,
      imageUrl: floorPlan.imageUrl,
      downloadUrl: floorPlan.downloadUrl,
      sortOrder: floorPlan.sortOrder,
    };
  }

  const normalized = normalizeInteractiveFloorPlanInput({
    provider: floorPlan.interactiveProvider,
    externalUrl: floorPlan.interactiveExternalUrl,
    embedUrl: floorPlan.interactiveEmbedUrl,
    interactiveUrl: floorPlan.interactiveUrl,
  });

  if (!normalized) {
    errors.push(`Unsupported or unsafe interactive floor-plan URL.`);
    return floorPlan;
  }

  return {
    id: floorPlan.id,
    title: floorPlan.title,
    imageUrl: floorPlan.imageUrl,
    downloadUrl: floorPlan.downloadUrl,
    sortOrder: floorPlan.sortOrder,
    interactiveProvider: normalized.provider,
    interactiveExternalUrl: normalized.externalUrl,
    interactiveEmbedUrl: normalized.embedUrl,
  };
}

function normalizeStoredInteractiveFloorPlanTour(
  tour: PropertyInteractiveFloorPlanTour | undefined,
  errors: string[],
): PropertyInteractiveFloorPlanTour | undefined {
  if (!tour) return undefined;
  const hasInteractiveInput = Boolean(
    tour.externalUrl?.trim() || tour.embedUrl?.trim(),
  );
  if (!tour.enabled || !hasInteractiveInput) return tour;

  const normalized = normalizeInteractiveFloorPlanInput({
    provider: tour.provider,
    externalUrl: tour.externalUrl,
    embedUrl: tour.embedUrl,
  });

  if (!normalized) {
    errors.push("Unsupported or unsafe property-level interactive floor-plan URL.");
    return tour;
  }

  return {
    ...tour,
    provider: normalized.provider,
    externalUrl: normalized.externalUrl,
    embedUrl: normalized.embedUrl,
  };
}

export function normalizePropertyProviderUrls(
  property: PropertyShowcase,
): ProviderUrlValidationResult {
  const errors: string[] = [];
  const next: PropertyShowcase = {
    ...property,
    virtualTour: normalizeStoredTour(property.virtualTour, errors),
    interactiveFloorPlanTour: normalizeStoredInteractiveFloorPlanTour(
      property.interactiveFloorPlanTour,
      errors,
    ),
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
