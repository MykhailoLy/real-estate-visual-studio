"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import PropertySocialCardPreview from "./media/PropertySocialCardPreview";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Images,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { propertyCardActions } from "@/features/property-showcase/admin-routing";
import type { PropertyShowcaseAdminRecord } from "@/features/property-showcase/admin-types";
import {
  descriptionParagraphsFromLanguageTexts,
  descriptionTextForAdmin,
  formatPriceLabel,
  generatePropertyPageSlug,
} from "@/features/property-showcase/formatting";
import { moveHighlightItem } from "@/features/property-showcase/highlight-ordering";
import {
  getPrimaryLanguage,
  getPropertyLanguageOptions,
  localizedText,
  PROPERTY_LANGUAGE_LABELS,
  SUPPORTED_PROPERTY_LANGUAGES,
  translationCompletion,
} from "@/features/property-showcase/localization";
import {
  labelForListingReferenceMode,
  LISTING_REFERENCE_LABEL_PRESETS,
  getPropertyLocationMapView,
  normalizeGoogleMapsInput,
} from "@/features/property-showcase/listing-details";
import { formatStructuredPropertyAddress } from "@/features/property-showcase/property-address";
import {
  normalizeInteractiveFloorPlanInput,
  normalizeTourPrimaryInput,
} from "@/features/property-showcase/provider-urls";
import { serializePublicPropertyLocation } from "@/features/property-showcase/public-serialization";
import { getLegacyInteractiveTourCandidates } from "@/features/property-showcase/rendering";
import type {
  ListingReferenceLabelMode,
  LocalizedText,
  PropertyAgentSocialProvider,
  PropertyFact,
  PropertyHighlight,
  PropertyLanguageCode,
  PropertyShowcase,
  PropertySocialBrandingMode,
  PropertyStatus,
  PropertyTourProvider,
  PropertyVideoProvider,
} from "@/features/property-showcase/types";
import { normalizePropertyVideoInput } from "@/features/property-showcase/video-urls";
import PropertyMapCanvas from "@/app/(showcase)/property/PropertyMapCanvas";

interface Props {
  records: PropertyShowcaseAdminRecord[];
  supabaseConfigured: boolean;
  schemaReady: boolean;
}

type EditorMode =
  | "closed"
  | "create"
  | { kind: "edit"; record: PropertyShowcaseAdminRecord };

interface TranslationFormState {
  id: string;
  language: PropertyLanguageCode;
  title: string;
  summary: string;
  description: string;
  highlights: string[];
}

interface HighlightFormState {
  id: string;
  text: string;
}

interface CustomFactFormState {
  id: string;
  key: PropertyFact["key"];
  label: string;
  value: string;
  visible: boolean;
}

interface VideoFormState {
  id: string;
  provider: PropertyVideoProvider;
  input: string;
  explicitEmbed: boolean;
  title: string;
  posterUrl: string;
  enabled: boolean;
  primary: boolean;
}

type SocialFormState = Record<PropertyAgentSocialProvider, string>;
type AgentSocialLink = NonNullable<PropertyShowcase["agent"]["socialLinks"]>[number];

interface FormState {
  slug: string;
  reference: string;
  referenceLabelMode: ListingReferenceLabelMode;
  referenceCustomLabel: string;
  status: PropertyStatus;
  primaryLanguage: PropertyLanguageCode;
  title: string;
  summary: string;
  description: string;
  price: string;
  coverImage: string;
  bedrooms: string;
  bathrooms: string;
  parking: string;
  builtArea: string;
  yearBuilt: string;
  plotArea: string;
  customFacts: CustomFactFormState[];
  address: string;
  streetAddress: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  privacyMode: "exact" | "approximate" | "hidden";
  showMap: boolean;
  latitude: string;
  longitude: string;
  approximateLatitude: string;
  approximateLongitude: string;
  approximateRadiusMeters: string;
  approximateLabel: string;
  allowApproximateAreaLink: boolean;
  mapExternalUrl: string;
  mapEmbedUrl: string;
  useCustomMapEmbed: boolean;
  mapZoom: string;
  tourEnabled: boolean;
  tourProvider: PropertyTourProvider;
  tourInput: string;
  tourExternalUrl: string;
  interactiveEnabled: boolean;
  interactiveProvider: PropertyTourProvider;
  interactiveExternalUrl: string;
  interactiveEmbedUrl: string;
  floorPlansEnabled: boolean;
  videosEnabled: boolean;
  videos: VideoFormState[];
  socialBrandingMode: PropertySocialBrandingMode;
  highlights: HighlightFormState[];
  translations: TranslationFormState[];
  agentDisplayProfile: boolean;
  agencyName: string;
  agentName: string;
  agentRole: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  socials: SocialFormState;
  published: boolean;
}

const inputClass =
  "mt-1.5 w-full min-w-0 rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const SOCIAL_PROVIDER_INPUT_LABELS: Record<
  PropertyAgentSocialProvider,
  string
> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X / Twitter",
  pinterest: "Pinterest",
  custom: "Custom website",
};
const protectedInputClass =
  "mt-1.5 w-full min-w-0 cursor-not-allowed truncate rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-muted outline-none";

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function directText(value: LocalizedText | undefined, language: string): string {
  return value?.[language]?.trim() ?? "";
}

function factValue(property: PropertyShowcase | null, key: PropertyFact["key"]) {
  return property?.facts.find((fact) => fact.key === key)?.value ?? "";
}

function factLabel(property: PropertyShowcase | null, key: PropertyFact["key"]) {
  return property?.facts.find((fact) => fact.key === key)?.label;
}

function referenceLabelState(property: PropertyShowcase | null): Pick<
  FormState,
  "referenceLabelMode" | "referenceCustomLabel"
> {
  const label = factLabel(property, "listing-reference")?.en?.trim() ?? "";
  const matchingPreset = (
    Object.entries(LISTING_REFERENCE_LABEL_PRESETS) as Array<
      [Exclude<ListingReferenceLabelMode, "custom">, LocalizedText]
    >
  ).find(([, preset]) => preset.en === label);

  if (matchingPreset) {
    return {
      referenceLabelMode: matchingPreset[0],
      referenceCustomLabel: "",
    };
  }

  return {
    referenceLabelMode: label ? "custom" : "property-reference",
    referenceCustomLabel: label,
  };
}

function paragraphs(value: string): string[] | undefined {
  const items = value
    .split(/\r?\n\s*\r?\n/g)
    .map((item) => item.replace(/\s*\r?\n\s*/g, " ").trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function socialState(property: PropertyShowcase | null): SocialFormState {
  const socials = property?.agent.socialLinks ?? [];
  return {
    facebook: socials.find((link) => link.provider === "facebook")?.url ?? "",
    instagram: socials.find((link) => link.provider === "instagram")?.url ?? "",
    linkedin: socials.find((link) => link.provider === "linkedin")?.url ?? "",
    youtube: socials.find((link) => link.provider === "youtube")?.url ?? "",
    tiktok: socials.find((link) => link.provider === "tiktok")?.url ?? "",
    x: socials.find((link) => link.provider === "x")?.url ?? "",
    pinterest: socials.find((link) => link.provider === "pinterest")?.url ?? "",
    custom: socials.find((link) => link.provider === "custom")?.url ?? "",
  };
}

function initialState(record: PropertyShowcaseAdminRecord | null): FormState {
  const property = record?.property ?? null;
  const primaryLanguage = property ? getPrimaryLanguage(property) : "en";
  const referenceLabel = referenceLabelState(property);
  const languageOptions: PropertyLanguageCode[] = property
    ? getPropertyLanguageOptions(property)
    : ["en"];
  const highlightTexts =
    property?.highlights.map((highlight, index) => ({
      id: `highlight-${index}-${localizedText(highlight.text ?? highlight.title, primaryLanguage, primaryLanguage)}`,
      text: localizedText(
        highlight.text ?? highlight.title ?? highlight.description,
        primaryLanguage,
        primaryLanguage,
      ),
    })) ?? [];
  const translations: TranslationFormState[] =
    property
      ? languageOptions
          .filter((language) => language !== primaryLanguage)
          .map((language) => ({
            id: `translation-${language}`,
            language,
            title: directText(property.title, language),
            summary: directText(property.summary, language),
            description: descriptionTextForAdmin(property.description, language),
            highlights: property.highlights.map((highlight) =>
              directText(
                highlight.text ?? highlight.title ?? highlight.description,
                language,
              ),
            ),
          }))
      : [];
  const interactiveTour = property?.interactiveFloorPlanTour;

  return {
    slug: property?.slug ?? "",
    reference: property?.reference ?? "PS-",
    referenceLabelMode: referenceLabel.referenceLabelMode,
    referenceCustomLabel: referenceLabel.referenceCustomLabel,
    status: property?.status ?? "for-sale",
    primaryLanguage,
    title: property ? localizedText(property.title, primaryLanguage, primaryLanguage) : "",
    summary: property ? localizedText(property.summary, primaryLanguage, primaryLanguage) : "",
    description: descriptionTextForAdmin(property?.description, primaryLanguage),
    price: property?.price ?? "",
    coverImage: property?.coverImage ?? "/property-demo/exterior.svg",
    bedrooms: factValue(property, "bedrooms"),
    bathrooms: factValue(property, "bathrooms"),
    parking: factValue(property, "parking"),
    builtArea: factValue(property, "built-area"),
    yearBuilt: factValue(property, "year-built"),
    plotArea: factValue(property, "plot-area"),
    customFacts:
      property?.facts
        .filter((fact) => fact.key.startsWith("custom-"))
        .slice()
        .sort((first, second) => (first.sortOrder ?? 0) - (second.sortOrder ?? 0))
        .map((fact) => ({
          id: fact.key,
          key: fact.key,
          label: localizedText(fact.label, primaryLanguage, primaryLanguage),
          value: fact.value,
          visible: fact.visible !== false,
        })) ?? [],
    address: property
      ? localizedText(property.location.displayAddress, primaryLanguage, primaryLanguage)
      : "",
    streetAddress: property?.location.streetAddress ?? "",
    city: property?.location.city ?? "",
    region: property?.location.region ?? "",
    postalCode: property?.location.postalCode ?? "",
    country: property?.location.country ?? "",
    privacyMode: property?.location.privacyMode ?? "approximate",
    showMap: property?.location.showMap ?? false,
    latitude:
      typeof property?.location.latitude === "number"
        ? String(property.location.latitude)
        : "",
    longitude:
      typeof property?.location.longitude === "number"
        ? String(property.location.longitude)
        : "",
    approximateLatitude:
      typeof property?.location.approximateLatitude === "number"
        ? String(property.location.approximateLatitude)
        : "",
    approximateLongitude:
      typeof property?.location.approximateLongitude === "number"
        ? String(property.location.approximateLongitude)
        : "",
    approximateRadiusMeters:
      typeof property?.location.approximateRadiusMeters === "number"
        ? String(property.location.approximateRadiusMeters)
        : "1500",
    approximateLabel: property
      ? localizedText(
          property.location.approximateLabel,
          primaryLanguage,
          primaryLanguage,
        )
      : "",
    allowApproximateAreaLink:
      property?.location.allowApproximateAreaLink ?? false,
    mapExternalUrl: property?.location.mapExternalUrl ?? "",
    mapEmbedUrl: property?.location.mapEmbedUrl ?? "",
    useCustomMapEmbed: property?.location.useCustomMapEmbed ?? false,
    mapZoom:
      typeof property?.location.mapZoom === "number"
        ? String(property.location.mapZoom)
        : "14",
    tourEnabled: property
      ? property.virtualTour?.enabled ??
        Boolean(
          property.virtualTour?.embedUrl?.trim() ||
            property.virtualTour?.externalUrl?.trim(),
        )
      : true,
    tourProvider: property?.virtualTour?.provider ?? "kuula",
    tourInput:
      property?.virtualTour?.embedUrl ?? property?.virtualTour?.externalUrl ?? "",
    tourExternalUrl: property?.virtualTour?.externalUrl ?? "",
    interactiveEnabled: interactiveTour?.enabled ?? false,
    interactiveProvider: interactiveTour?.provider ?? "cubiCasa",
    interactiveExternalUrl: interactiveTour?.externalUrl ?? "",
    interactiveEmbedUrl: interactiveTour?.embedUrl ?? "",
    floorPlansEnabled: property?.floorPlansEnabled !== false,
    videosEnabled: property?.videos
      ? property.videos.enabled !== false
      : false,
    videos:
      property?.videos?.items
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((video) => ({
          id: video.id,
          provider: video.provider,
          input: video.embedUrl ?? video.externalUrl ?? video.playbackId ?? "",
          explicitEmbed: Boolean(video.embedUrl),
          title: localizedText(
            video.title,
            primaryLanguage,
            primaryLanguage,
          ),
          posterUrl: video.posterUrl ?? "",
          enabled: video.enabled !== false,
          primary: video.primary === true,
        })) ?? [],
    socialBrandingMode:
      property?.socialPreview?.brandingMode ?? "picchuspot",
    highlights: highlightTexts,
    translations,
    agentDisplayProfile: property?.agent.displayProfile ?? true,
    agencyName: property?.agent.agencyName ?? "",
    agentName: property?.agent.agentName ?? "",
    agentRole: property ? localizedText(property.agent.role, primaryLanguage, primaryLanguage) : "",
    phone: property?.agent.phone ?? "",
    whatsapp: property?.agent.whatsapp ?? "",
    email: property?.agent.email ?? "",
    website: property?.agent.website ?? "",
    socials: socialState(property),
    published: record?.published ?? false,
  };
}

function localizedValue(
  primaryLanguage: PropertyLanguageCode,
  primaryValue: string,
  translations: readonly TranslationFormState[],
  key: "title" | "summary",
): LocalizedText {
  const primary = primaryValue.trim();
  const english =
    primaryLanguage === "en"
      ? primary
      : translations.find((translation) => translation.language === "en")?.[key]
          .trim() || primary;
  const value: LocalizedText = { en: english };

  value[primaryLanguage] = primary;
  for (const translation of translations) {
    const translated = translation[key].trim();
    if (translated) value[translation.language] = translated;
  }

  return value;
}

function localizedRole(
  primaryLanguage: PropertyLanguageCode,
  role: string,
): LocalizedText | undefined {
  const trimmed = role.trim();
  if (!trimmed) return undefined;
  return simpleLocalizedText(primaryLanguage, trimmed);
}

function simpleLocalizedText(
  primaryLanguage: PropertyLanguageCode,
  text: string,
): LocalizedText {
  const trimmed = text.trim();
  return primaryLanguage === "en"
    ? { en: trimmed }
    : { en: trimmed, [primaryLanguage]: trimmed };
}

function buildFacts(state: FormState): PropertyFact[] {
  const facts: PropertyFact[] = [];
  const push = (
    key: PropertyFact["key"],
    value: string,
    label: LocalizedText,
    sortOrder: number,
  ) => {
    if (value.trim()) {
      facts.push({ key, value: value.trim(), label, sortOrder });
    }
  };

  push(
    "listing-reference",
    state.reference,
    labelForListingReferenceMode(
      state.referenceLabelMode,
      state.referenceCustomLabel,
    ),
    -10,
  );
  push("bedrooms", state.bedrooms, { en: "Bedrooms", es: "Dormitorios" }, 10);
  push("bathrooms", state.bathrooms, { en: "Bathrooms", es: "Baños" }, 20);
  push("parking", state.parking, { en: "Parking", es: "Aparcamiento" }, 30);
  push(
    "built-area",
    state.builtArea,
    { en: "Built area", es: "Superficie construida" },
    40,
  );
  push(
    "year-built",
    state.yearBuilt,
    { en: "Year built", es: "Año de construcción" },
    50,
  );
  push("plot-area", state.plotArea, { en: "Lot size", es: "Parcela" }, 60);
  state.customFacts.forEach((fact, index) => {
    const label = fact.label.trim();
    const value = fact.value.trim();
    if (!label || !value) return;
    facts.push({
      key: fact.key,
      value,
      label: simpleLocalizedText(state.primaryLanguage, label),
      sortOrder: 1000 + index,
      visible: fact.visible,
    });
  });
  return facts;
}

function buildHighlights(state: FormState): PropertyHighlight[] {
  const highlights: PropertyHighlight[] = [];

  state.highlights.slice(0, 12).forEach((highlight, index) => {
    const primary = highlight.text.trim();
    if (!primary) return;
    const text: LocalizedText =
      state.primaryLanguage === "en"
        ? { en: primary }
        : { en: primary, [state.primaryLanguage]: primary };

    for (const translation of state.translations) {
      const translated = translation.highlights[index]?.trim();
      if (translated) text[translation.language] = translated;
    }

    highlights.push({ text, sortOrder: index + 1 });
  });

  return highlights;
}

function buildLanguages(state: FormState): PropertyLanguageCode[] {
  const translated = state.translations
    .filter(
      (translation) =>
        translation.title.trim() ||
        translation.summary.trim() ||
        translation.description.trim() ||
        translation.highlights.some((item) => item.trim()),
    )
    .map((translation) => translation.language);
  return [...new Set([state.primaryLanguage, ...translated])];
}

function buildTranslations(
  state: FormState,
): PropertyShowcase["translations"] | undefined {
  const translations: NonNullable<PropertyShowcase["translations"]> = {};
  for (const translation of state.translations) {
    const highlights = translation.highlights
      .map(optional)
      .filter((item): item is string => Boolean(item));
    const description = paragraphs(translation.description);
    const title = optional(translation.title);
    const summary = optional(translation.summary);
    const content: NonNullable<PropertyShowcase["translations"]>[PropertyLanguageCode] = {};
    if (title) content.title = title;
    if (summary) content.summary = summary;
    if (description) content.description = description;
    if (highlights.length > 0) content.highlights = highlights;
    if (
      title ||
      summary ||
      (description?.length ?? 0) > 0 ||
      highlights.length > 0
    ) {
      translations[translation.language] = content;
    }
  }

  return Object.keys(translations).length > 0 ? translations : undefined;
}

function numberValue(value: string, min: number, max: number): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : undefined;
}

function integerValue(value: string, min: number, max: number): number | undefined {
  const parsed = numberValue(value, min, max);
  return typeof parsed === "number" ? Math.round(parsed) : undefined;
}

function buildSocialLinks(state: FormState): PropertyShowcase["agent"]["socialLinks"] {
  const links: AgentSocialLink[] = [];
  (Object.entries(state.socials) as Array<[PropertyAgentSocialProvider, string]>)
    .forEach(([provider, url], index) => {
      const trimmed = url.trim();
      if (trimmed) {
        links.push({ provider, url: trimmed, sortOrder: index + 1 });
      }
    });
  return links;
}

function buildProperty(
  state: FormState,
  existing: PropertyShowcase | null,
): PropertyShowcase {
  const coverImage = existing?.coverImage ?? state.coverImage.trim();
  let gallery = existing?.gallery ?? [];

  if (gallery.length === 0) {
    gallery = [
      {
        id: "cover",
        src: coverImage,
        alt: localizedValue(state.primaryLanguage, state.title, state.translations, "title"),
        label: { en: "Cover image" },
        sortOrder: 1,
      },
    ];
  }

  const descriptionValues: Partial<Record<PropertyLanguageCode, string>> = {
    [state.primaryLanguage]: state.description,
  };
  for (const translation of state.translations) {
    if (translation.description.trim()) {
      descriptionValues[translation.language] = translation.description;
    }
  }

  const tourInput = state.tourInput.trim();
  const hasTour = Boolean(tourInput || state.tourExternalUrl.trim());
  const normalizedTour =
    normalizeTourPrimaryInput(tourInput, state.tourProvider) ??
    normalizeTourPrimaryInput(tourInput);
  const interactiveExternal = state.interactiveExternalUrl.trim();
  const interactiveEmbed = state.interactiveEmbedUrl.trim();
  const hasInteractive = Boolean(interactiveExternal || interactiveEmbed);
  const normalizedInteractive = normalizeInteractiveFloorPlanInput({
    provider: state.interactiveProvider,
    externalUrl: interactiveExternal,
    embedUrl: interactiveEmbed,
  });
  const videos = state.videos.map((video, index) => {
    const normalized = normalizePropertyVideoInput(video.provider, {
      ...(video.explicitEmbed
        ? { embedUrl: video.input }
        : { value: video.input }),
    });
    return {
      id: video.id,
      provider: normalized?.provider ?? video.provider,
      title: video.title.trim()
        ? simpleLocalizedText(state.primaryLanguage, video.title)
        : undefined,
      externalUrl: optional(
        normalized?.externalUrl ?? (!video.explicitEmbed ? video.input : ""),
      ),
      embedUrl: optional(
        normalized?.embedUrl ?? (video.explicitEmbed ? video.input : ""),
      ),
      playbackId: normalized?.playbackId,
      posterUrl: optional(video.posterUrl),
      enabled: video.enabled,
      primary: video.primary,
      sortOrder: index + 1,
    };
  });
  const displayAddress =
    state.address.trim() || formatStructuredPropertyAddress(state);

  return {
    slug:
      state.slug.trim() ||
      generatePropertyPageSlug(state.title, state.reference),
    reference: state.reference.trim(),
    status: state.status,
    primaryLanguage: state.primaryLanguage,
    title: localizedValue(state.primaryLanguage, state.title, state.translations, "title"),
    summary: localizedValue(
      state.primaryLanguage,
      state.summary,
      state.translations,
      "summary",
    ),
    description: descriptionParagraphsFromLanguageTexts(
      descriptionValues,
      state.primaryLanguage,
    ),
    priceLabel: { en: "Asking price", es: "Precio de venta" },
    price: state.price.trim(),
    coverImage,
    brochureUrl: existing?.brochureUrl,
    languages: buildLanguages(state),
    translations: buildTranslations(state),
    facts: buildFacts(state),
    highlights: buildHighlights(state),
    gallery,
    videos:
      videos.length > 0
        ? {
            enabled: state.videosEnabled,
            items: videos,
          }
        : undefined,
    virtualTour: hasTour
      ? {
          enabled: state.tourEnabled,
          provider: normalizedTour?.provider ?? state.tourProvider,
          embedUrl: optional(normalizedTour?.embedUrl ?? tourInput),
          externalUrl: optional(state.tourExternalUrl || normalizedTour?.externalUrl || ""),
          posterImage: existing?.virtualTour?.posterImage ?? coverImage,
        }
      : undefined,
    interactiveFloorPlanTour: state.interactiveEnabled || hasInteractive
      ? {
          enabled: state.interactiveEnabled,
          provider: normalizedInteractive?.provider ?? state.interactiveProvider,
          externalUrl:
            optional(normalizedInteractive?.externalUrl ?? interactiveExternal),
          embedUrl: optional(normalizedInteractive?.embedUrl ?? interactiveEmbed),
          posterImage:
            existing?.interactiveFloorPlanTour?.posterImage ??
            existing?.floorPlans[0]?.imageUrl,
        }
      : undefined,
    floorPlansEnabled: state.floorPlansEnabled,
    floorPlans: existing?.floorPlans ?? [],
    socialPreview: {
      brandingMode: state.socialBrandingMode,
    },
    socialCard: existing?.socialCard,
    location: {
      displayAddress: simpleLocalizedText(state.primaryLanguage, displayAddress),
      streetAddress: optional(state.streetAddress),
      city: optional(state.city),
      region: optional(state.region),
      postalCode: optional(state.postalCode),
      country: optional(state.country),
      approximateLabel: state.approximateLabel.trim()
        ? simpleLocalizedText(state.primaryLanguage, state.approximateLabel)
        : undefined,
      latitude: numberValue(state.latitude, -90, 90),
      longitude: numberValue(state.longitude, -180, 180),
      approximateLatitude: numberValue(state.approximateLatitude, -90, 90),
      approximateLongitude: numberValue(
        state.approximateLongitude,
        -180,
        180,
      ),
      approximateRadiusMeters: integerValue(
        state.approximateRadiusMeters,
        100,
        50000,
      ),
      allowApproximateAreaLink: state.allowApproximateAreaLink,
      privacyMode: state.privacyMode,
      showMap: state.showMap,
      mapExternalUrl: optional(state.mapExternalUrl),
      mapEmbedUrl: optional(state.mapEmbedUrl),
      useCustomMapEmbed: state.useCustomMapEmbed,
      mapZoom: integerValue(state.mapZoom, 1, 23),
      airportTravelTime: existing?.location.airportTravelTime,
    },
    agent: {
      agencyName: state.agencyName.trim(),
      displayProfile: state.agentDisplayProfile,
      agentName: optional(state.agentName),
      role: localizedRole(state.primaryLanguage, state.agentRole),
      logoUrl: existing?.agent.logoUrl,
      portraitUrl: existing?.agent.portraitUrl,
      phone: optional(state.phone),
      whatsapp: optional(state.whatsapp),
      email: optional(state.email),
      website: optional(state.website),
      socialLinks: buildSocialLinks(state),
    },
    publishedAt: existing?.publishedAt,
  };
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "Request failed.";
  } catch {
    return "Request failed.";
  }
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-foreground">
      {label}
      {children}
      {hint ? (
        <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-4 border-b border-border pb-2 text-xs font-bold uppercase tracking-[0.16em] text-secondary-dark">
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function PropertiesAdminClient({
  records,
  supabaseConfigured,
  schemaReady,
}: Props) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorMode>("closed");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function flash(message: string) {
    setNotice(message);
    setError(null);
    window.setTimeout(() => setNotice(null), 4000);
  }

  async function remove(record: PropertyShowcaseAdminRecord) {
    const title = localizedText(
      record.property.title,
      getPrimaryLanguage(record.property),
      getPrimaryLanguage(record.property),
    );
    if (busy || !window.confirm(`Delete "${title}"?`)) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/properties/${record.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      setEditor("closed");
      flash(`Deleted "${title}".`);
      router.refresh();
    } catch {
      setError("Network error while deleting the property.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!supabaseConfigured || !schemaReady ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            {!supabaseConfigured ? (
              "Supabase environment variables are not configured on this deployment."
            ) : (
              <>
                Review and manually run{" "}
                <code className="font-mono text-xs">
                  supabase/add-property-showcase-foundation.sql
                </code>{" "}
                in Supabase. No SQL has been executed automatically.
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-muted">
            {records.length} property showcase{records.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Listing details, publishing, translations, maps and realtor profile.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => setEditor(editor === "create" ? "closed" : "create")}
            disabled={!schemaReady || busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New property
          </button>
          <Link
            href="/admin/properties/media"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-bold text-primary transition hover:border-primary/40"
          >
            <Images className="h-4 w-4" aria-hidden />
            Manage media
          </Link>
        </div>
      </div>

      {notice ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {editor !== "closed" ? (
        <PropertyEditor
          key={editor === "create" ? "create" : editor.record.id}
          mode={editor === "create" ? "create" : "edit"}
          record={editor === "create" ? null : editor.record}
          onClose={() => setEditor("closed")}
          onSaved={(message) => {
            setEditor("closed");
            flash(message);
            router.refresh();
          }}
          onError={setError}
        />
      ) : null}

      <div>
        {records.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white p-10 text-center text-sm text-muted shadow-sm">
            No property showcases yet.
          </div>
        ) : (
          <ul className="grid gap-4 xl:grid-cols-2">
            {records.map((record) => {
              const [viewAction, editAction, mediaAction, deleteAction] =
                propertyCardActions(record);
              const title = localizedText(
                record.property.title,
                getPrimaryLanguage(record.property),
                getPrimaryLanguage(record.property),
              );

              return (
                <li
                  key={record.id}
                  className="min-w-0 rounded-2xl border border-border bg-white p-5 shadow-sm"
                >
                  <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className="min-w-0 break-words text-lg font-bold text-primary">
                        {title}
                      </h2>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${record.published ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                      >
                        {record.published ? "Published" : "Draft"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      /property/{record.slug} {"\u00b7"} {record.property.reference}{" "}
                      {"\u00b7"}{" "}
                      {formatPriceLabel(record.property.price)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Updated {new Date(record.updatedAt).toLocaleString()}
                    </p>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                          Languages
                        </dt>
                        <dd className="mt-1 text-foreground">
                          {getPropertyLanguageOptions(record.property)
                            .map((language) => language.toUpperCase())
                            .join(", ")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                          Realtor profile
                        </dt>
                        <dd className="mt-1 text-foreground">
                          {record.property.agent.displayProfile === false
                            ? "hidden"
                            : "visible"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                          Map
                        </dt>
                        <dd className="mt-1 text-foreground">
                          {record.property.location.showMap
                            ? record.property.location.privacyMode
                            : "hidden"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                          Interactive plan
                        </dt>
                        <dd className="mt-1 text-foreground">
                          {record.property.interactiveFloorPlanTour?.enabled
                            ? record.property.interactiveFloorPlanTour.provider
                            : record.property.floorPlans.some(
                                  (plan) =>
                                    plan.interactiveExternalUrl ||
                                    plan.interactiveEmbedUrl ||
                                    plan.interactiveUrl,
                                )
                              ? "legacy fallback"
                              : "not set"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <Link
                      href={viewAction.href}
                      target="_blank"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-bold text-primary transition hover:border-primary/40"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />{" "}
                      {viewAction.label}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEditor({ kind: "edit", record })}
                      disabled={busy}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-bold text-primary transition hover:border-primary/40 disabled:opacity-50"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />{" "}
                      {editAction.label}
                    </button>
                    <Link
                      href={mediaAction.href}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-bold text-primary transition hover:border-primary/40"
                    >
                      <Images className="h-4 w-4" aria-hidden />
                      {mediaAction.label}
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(record)}
                      disabled={busy}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3.5 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />{" "}
                      {deleteAction.label}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function PropertyEditor({
  mode,
  record,
  onClose,
  onSaved,
  onError,
}: {
  mode: "create" | "edit";
  record: PropertyShowcaseAdminRecord | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string | null) => void;
}) {
  const legacyTourCandidates =
    record && !record.property.interactiveFloorPlanTour
      ? getLegacyInteractiveTourCandidates(record.property)
      : [];
  const [form, setForm] = useState<FormState>(() => initialState(record));
  const [pageUrlTouched, setPageUrlTouched] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [legacyTourCandidateId, setLegacyTourCandidateId] = useState(
    legacyTourCandidates.length === 1 ? legacyTourCandidates[0].id : "",
  );
  const normalizedTourPreview =
    normalizeTourPrimaryInput(form.tourInput, form.tourProvider) ??
    normalizeTourPrimaryInput(form.tourInput);
  const normalizedInteractivePreview = normalizeInteractiveFloorPlanInput({
    provider: form.interactiveProvider,
    externalUrl: form.interactiveExternalUrl,
    embedUrl: form.interactiveEmbedUrl,
  });
  const normalizedMapExternal = normalizeGoogleMapsInput(form.mapExternalUrl);
  const normalizedMapEmbed = normalizeGoogleMapsInput(form.mapEmbedUrl);
  const exactAddress =
    form.address.trim() || formatStructuredPropertyAddress(form);
  const previewLocation = serializePublicPropertyLocation({
    displayAddress: simpleLocalizedText(
      form.primaryLanguage,
      exactAddress || "Location",
    ),
    streetAddress: optional(form.streetAddress),
    city: optional(form.city),
    region: optional(form.region),
    postalCode: optional(form.postalCode),
    country: optional(form.country),
    latitude: numberValue(form.latitude, -90, 90),
    longitude: numberValue(form.longitude, -180, 180),
    approximateLatitude: numberValue(form.approximateLatitude, -90, 90),
    approximateLongitude: numberValue(
      form.approximateLongitude,
      -180,
      180,
    ),
    approximateRadiusMeters: integerValue(
      form.approximateRadiusMeters,
      100,
      50000,
    ),
    approximateLabel: form.approximateLabel.trim()
      ? simpleLocalizedText(form.primaryLanguage, form.approximateLabel)
      : undefined,
    allowApproximateAreaLink: form.allowApproximateAreaLink,
    privacyMode: form.privacyMode,
    showMap: form.showMap,
    mapExternalUrl: optional(form.mapExternalUrl),
    mapEmbedUrl: optional(form.mapEmbedUrl),
    useCustomMapEmbed: form.useCustomMapEmbed,
    mapZoom: integerValue(form.mapZoom, 1, 23),
  });
  const mapPreview = getPropertyLocationMapView(
    previewLocation,
    form.privacyMode === "exact"
      ? exactAddress
      : form.approximateLabel.trim(),
  );
  const mapStatus =
    mapPreview.source === "generated-exact"
      ? "Generated exact marker map"
      : mapPreview.source === "generated-approximate"
        ? "Generated approximate map"
        : mapPreview.source === "custom-embed"
          ? "Custom Google Maps embed"
          : mapPreview.source === "hidden"
            ? "Map hidden"
            : "Invalid coordinates";
  const pageUrlPreview = `/property/${
    form.slug.trim() || generatePropertyPageSlug(form.title, form.reference)
  }`;
  const socialPreviewDraft = useMemo(
    () => (record ? buildProperty(form, record.property) : null),
    [form, record],
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setTitle(value: string) {
    setForm((current) => ({
      ...current,
      title: value,
      slug:
        mode === "create" && !pageUrlTouched
          ? generatePropertyPageSlug(value, current.reference)
          : current.slug,
    }));
  }

  function setReference(value: string) {
    setForm((current) => ({
      ...current,
      reference: value,
      slug:
        mode === "create" && !pageUrlTouched && !current.title.trim()
          ? generatePropertyPageSlug("", value)
          : current.slug,
    }));
  }

  function setPageUrl(value: string) {
    setPageUrlTouched(true);
    set("slug", generatePropertyPageSlug(value, value));
  }

  function moveLegacyTourToPropertyLevel() {
    const candidate = legacyTourCandidates.find(
      (item) => item.id === legacyTourCandidateId,
    );
    if (!candidate) return;

    setForm((current) => ({
      ...current,
      interactiveEnabled: true,
      interactiveProvider: candidate.tour.provider,
      interactiveExternalUrl: candidate.tour.externalUrl ?? "",
      interactiveEmbedUrl: candidate.tour.embedUrl ?? "",
    }));
  }

  function addHighlight() {
    setForm((current) => {
      if (current.highlights.length >= 12) return current;
      return {
        ...current,
        highlights: [
          ...current.highlights,
          { id: `highlight-${crypto.randomUUID()}`, text: "" },
        ],
        translations: current.translations.map((translation) => ({
          ...translation,
          highlights: [...translation.highlights, ""],
        })),
      };
    });
  }

  function updateHighlight(id: string, value: string) {
    setForm((current) => ({
      ...current,
      highlights: current.highlights.map((highlight) =>
        highlight.id === id ? { ...highlight, text: value } : highlight,
      ),
    }));
  }

  function removeHighlight(id: string) {
    setForm((current) => {
      const index = current.highlights.findIndex((highlight) => highlight.id === id);
      return {
        ...current,
        highlights: current.highlights.filter((highlight) => highlight.id !== id),
        translations: current.translations.map((translation) => ({
          ...translation,
          highlights: translation.highlights.filter((_, itemIndex) => itemIndex !== index),
        })),
      };
    });
  }

  function moveHighlight(id: string, direction: -1 | 1) {
    setForm((current) => {
      const index = current.highlights.findIndex((highlight) => highlight.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.highlights.length) {
        return current;
      }

      return {
        ...current,
        highlights: moveHighlightItem(current.highlights, index, nextIndex),
        translations: current.translations.map((translation) => ({
          ...translation,
          highlights: moveHighlightItem(
            translation.highlights,
            index,
            nextIndex,
          ),
        })),
      };
    });
  }

  function addCustomFact() {
    setForm((current) => ({
      ...current,
      customFacts: [
        ...current.customFacts,
        {
          id: crypto.randomUUID(),
          key: `custom-${crypto.randomUUID().toLowerCase()}`,
          label: "",
          value: "",
          visible: true,
        },
      ],
    }));
  }

  function updateCustomFact(
    id: string,
    patch: Partial<Pick<CustomFactFormState, "label" | "value" | "visible">>,
  ) {
    setForm((current) => ({
      ...current,
      customFacts: current.customFacts.map((fact) =>
        fact.id === id ? { ...fact, ...patch } : fact,
      ),
    }));
  }

  function removeCustomFact(id: string) {
    setForm((current) => ({
      ...current,
      customFacts: current.customFacts.filter((fact) => fact.id !== id),
    }));
  }

  function moveCustomFact(id: string, direction: -1 | 1) {
    setForm((current) => {
      const index = current.customFacts.findIndex((fact) => fact.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.customFacts.length) {
        return current;
      }
      return {
        ...current,
        customFacts: moveHighlightItem(current.customFacts, index, nextIndex),
      };
    });
  }

  function addTranslation(language: PropertyLanguageCode) {
    if (
      language === form.primaryLanguage ||
      form.translations.some((translation) => translation.language === language)
    ) {
      return;
    }
    setForm((current) => ({
      ...current,
      translations: [
        ...current.translations,
        {
          id: `translation-${language}`,
          language,
          title: "",
          summary: "",
          description: "",
          highlights: current.highlights.map(() => ""),
        },
      ],
    }));
  }

  function removeTranslation(id: string) {
    setForm((current) => ({
      ...current,
      translations: current.translations.filter((translation) => translation.id !== id),
    }));
  }

  function updateTranslation<K extends keyof TranslationFormState>(
    id: string,
    key: K,
    value: TranslationFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      translations: current.translations.map((translation) =>
        translation.id === id ? { ...translation, [key]: value } : translation,
      ),
    }));
  }

  function updateTranslationHighlight(
    id: string,
    index: number,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      translations: current.translations.map((translation) => {
        if (translation.id !== id) return translation;
        const highlights = [...translation.highlights];
        highlights[index] = value;
        return { ...translation, highlights };
      }),
    }));
  }

  function updateSocial(provider: PropertyAgentSocialProvider, value: string) {
    setForm((current) => ({
      ...current,
      socials: { ...current.socials, [provider]: value },
    }));
  }

  function addVideo() {
    setForm((current) => ({
      ...current,
      videosEnabled: true,
      videos: [
        ...current.videos,
        {
          id: `video-${crypto.randomUUID()}`,
          provider: "youtube",
          input: "",
          explicitEmbed: false,
          title: "",
          posterUrl: "",
          enabled: true,
          primary: current.videos.length === 0,
        },
      ],
    }));
  }

  function updateVideo<K extends keyof VideoFormState>(
    id: string,
    key: K,
    value: VideoFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      videos: current.videos.map((video) => {
        if (video.id !== id) {
          return key === "primary" && value === true
            ? { ...video, primary: false }
            : video;
        }
        return { ...video, [key]: value };
      }),
    }));
  }

  function removeVideo(id: string) {
    setForm((current) => {
      const videos = current.videos.filter((video) => video.id !== id);
      if (videos.length > 0 && !videos.some((video) => video.primary)) {
        videos[0] = { ...videos[0], primary: true };
      }
      return { ...current, videos };
    });
  }

  function moveVideo(id: string, direction: -1 | 1) {
    setForm((current) => {
      const index = current.videos.findIndex((video) => video.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.videos.length) {
        return current;
      }
      const videos = [...current.videos];
      [videos[index], videos[nextIndex]] = [videos[nextIndex], videos[index]];
      return { ...current, videos };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    onError(null);

    const property = buildProperty(form, record?.property ?? null);
    const existingProperty = record?.property ?? null;
    const removeVirtualTour =
      mode === "edit" &&
      Boolean(existingProperty?.virtualTour) &&
      !form.tourInput.trim() &&
      !form.tourExternalUrl.trim();
    const removeInteractiveFloorPlan =
      mode === "edit" &&
      Boolean(existingProperty?.interactiveFloorPlanTour) &&
      !form.interactiveEnabled &&
      !form.interactiveExternalUrl.trim() &&
      !form.interactiveEmbedUrl.trim();
    const endpoint =
      mode === "create"
        ? "/api/admin/properties"
        : `/api/admin/properties/${record?.id}`;

    try {
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property,
          published: form.published,
          updateMode: mode === "create" ? "replace" : "details",
          removeVirtualTour,
          removeInteractiveFloorPlan,
        }),
      });
      if (!response.ok) {
        onError(await responseError(response));
        return;
      }
      onSaved(
        `${mode === "create" ? "Created" : "Updated"} "${property.title.en}". Saved public map mode: ${mapStatus}.`,
      );
    } catch {
      onError("Network error while saving the property.");
    } finally {
      setSaving(false);
    }
  }

  const availableTranslationLanguages = SUPPORTED_PROPERTY_LANGUAGES.filter(
    (language) =>
      language !== form.primaryLanguage &&
      !form.translations.some((translation) => translation.language === language),
  );

  return (
    <form
      onSubmit={submit}
      className="mb-6 overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-bold text-primary">
            {mode === "create" ? "New property showcase" : "Edit property showcase"}
          </h2>
          <p className="mt-1 text-xs text-muted">
            Main listing details, translations, map and realtor profile.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-primary"
          aria-label="Close property editor"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="space-y-8 p-5 sm:p-6">
        <Section title="1. Page and publishing">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Page URL"
              hint={
                mode === "edit"
                  ? "Locked after creation because Storage media uses this folder."
                  : "Lowercase letters, numbers and hyphens only."
              }
            >
              <input
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                value={form.slug}
                readOnly={mode === "edit"}
                aria-readonly={mode === "edit"}
                onChange={(event) => {
                  if (mode === "create") setPageUrl(event.target.value);
                }}
                className={mode === "edit" ? protectedInputClass : inputClass}
                placeholder="villa-altea-hills"
              />
              <span className="mt-1 block break-all text-xs font-normal text-muted">
                picchuspot.com{pageUrlPreview}
              </span>
            </Field>
            <Field label="Reference / listing number">
              <input
                required
                value={form.reference}
                onChange={(event) => setReference(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Reference label">
              <select
                value={form.referenceLabelMode}
                onChange={(event) =>
                  set(
                    "referenceLabelMode",
                    event.target.value as ListingReferenceLabelMode,
                  )
                }
                className={inputClass}
              >
                <option value="property-reference">Property reference</option>
                <option value="mls-number">MLS number</option>
                <option value="listing-number">Listing number</option>
                <option value="custom">Custom label</option>
              </select>
            </Field>
            {form.referenceLabelMode === "custom" ? (
              <Field label="Custom reference label">
                <input
                  value={form.referenceCustomLabel}
                  onChange={(event) =>
                    set("referenceCustomLabel", event.target.value)
                  }
                  className={inputClass}
                  placeholder="Property reference"
                />
              </Field>
            ) : null}
            <Field label="Status">
              <select
                value={form.status}
                onChange={(event) =>
                  set("status", event.target.value as PropertyStatus)
                }
                className={inputClass}
              >
                <option value="for-sale">For sale</option>
                <option value="reserved">Reserved</option>
                <option value="sold">Sold</option>
                <option value="off-market">Off market</option>
              </select>
            </Field>
            <Field
              label="Cover image"
              hint="Protected. Change it in Manage media."
            >
              <input
                value={form.coverImage}
                readOnly
                aria-readonly="true"
                className={protectedInputClass}
              />
            </Field>
          </div>
          <div className="mt-6 border-t border-border pt-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-primary">Custom facts</h4>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Add property specifications in priority order. Disabled facts stay saved but are excluded from the property page, brochure, and social card.
                </p>
              </div>
              <button
                type="button"
                onClick={addCustomFact}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-bold text-primary hover:border-primary/40"
              >
                <Plus className="h-4 w-4" aria-hidden /> Add custom fact
              </button>
            </div>
            {form.customFacts.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-border bg-surface px-4 py-4 text-sm text-muted">
                No custom facts yet.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {form.customFacts.map((fact, index) => (
                  <div key={fact.id} className="grid gap-3 rounded-xl border border-border bg-white p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                    <Field label={`Custom fact ${index + 1} label`}>
                      <input
                        value={fact.label}
                        onChange={(event) => updateCustomFact(fact.id, { label: event.target.value })}
                        className={inputClass}
                        placeholder="Energy efficiency"
                      />
                    </Field>
                    <Field label="Value">
                      <input
                        value={fact.value}
                        onChange={(event) => updateCustomFact(fact.id, { value: event.target.value })}
                        className={inputClass}
                        placeholder="B"
                      />
                    </Field>
                    <div className="flex flex-wrap items-center gap-2 md:pb-0.5">
                      <label className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-bold text-primary">
                        <input
                          type="checkbox"
                          checked={fact.visible}
                          onChange={(event) => updateCustomFact(fact.id, { visible: event.target.checked })}
                          className="h-4 w-4 accent-primary"
                        />
                        Enabled
                      </label>
                      <button type="button" onClick={() => moveCustomFact(fact.id, -1)} disabled={index === 0} className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-primary disabled:opacity-40">Move earlier</button>
                      <button type="button" onClick={() => moveCustomFact(fact.id, 1)} disabled={index === form.customFacts.length - 1} className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-primary disabled:opacity-40">Move later</button>
                      <button type="button" onClick={() => removeCustomFact(fact.id)} className="grid h-10 w-10 place-items-center rounded-xl border border-red-200 text-red-700 hover:bg-red-50" aria-label={`Remove custom fact ${index + 1}`}><Trash2 className="h-4 w-4" aria-hidden /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="2. Primary language">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Primary content language">
              {mode === "edit" ? (
                <input
                  value={PROPERTY_LANGUAGE_LABELS[form.primaryLanguage]}
                  readOnly
                  aria-readonly="true"
                  className={protectedInputClass}
                />
              ) : (
                <select
                  value={form.primaryLanguage}
                  onChange={(event) =>
                    set(
                      "primaryLanguage",
                      event.target.value as PropertyLanguageCode,
                    )
                  }
                  className={inputClass}
                >
                  {SUPPORTED_PROPERTY_LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {PROPERTY_LANGUAGE_LABELS[language]}
                    </option>
                  ))}
                </select>
              )}
              <span className="mt-1 block text-xs font-normal text-muted">
                Primary language can be selected during creation and is locked
                after the property exists.
              </span>
            </Field>
          </div>
        </Section>

        <Section title="3. Property description">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title">
              <input
                required
                value={form.title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Summary (optional)">
              <textarea
                rows={3}
                value={form.summary}
                onChange={(event) => set("summary", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Description"
              hint="Separate paragraphs with a blank line."
            >
              <textarea
                rows={6}
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="4. Listing facts">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Price"
              hint={
                <>
                  Costa Blanca defaults use EUR. Enter the symbol when needed, for
                  example {"\u20ac"}695,000 or $385,560.
                </>
              }
            >
              <input
                required
                value={form.price}
                onChange={(event) => set("price", event.target.value)}
                className={inputClass}
                placeholder={"\u20ac695,000"}
              />
            </Field>
            <Field label="Bedrooms">
              <input
                value={form.bedrooms}
                onChange={(event) => set("bedrooms", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Bathrooms">
              <input
                value={form.bathrooms}
                onChange={(event) => set("bathrooms", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Parking / garage">
              <input
                value={form.parking}
                onChange={(event) => set("parking", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Built area"
              hint={
                <>
                  Costa Blanca default is m{"\u00b2"}. For non-European listings,
                  enter the unit, for example 1,900 sq ft or 9.19 acres.
                </>
              }
            >
              <input
                value={form.builtArea}
                onChange={(event) => set("builtArea", event.target.value)}
                className={inputClass}
                placeholder={`142 m${"\u00b2"}`}
              />
            </Field>
            <Field label="Year built">
              <input
                value={form.yearBuilt}
                onChange={(event) => set("yearBuilt", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Lot / plot size">
              <input
                value={form.plotArea}
                onChange={(event) => set("plotArea", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="5. Highlights">
          <div className="space-y-4">
            {form.highlights.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-sm text-muted">
                No highlights yet.
              </div>
            ) : (
              form.highlights.map((highlight, index) => (
                <div key={highlight.id} className="flex flex-col gap-3 rounded-xl border border-border bg-white p-3 sm:flex-row">
                  <Field label={`Highlight ${index + 1}`}>
                    <input
                      value={highlight.text}
                      onChange={(event) =>
                        updateHighlight(highlight.id, event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:items-end">
                    <button
                      type="button"
                      onClick={() => moveHighlight(highlight.id, -1)}
                      disabled={index === 0}
                      className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-primary hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Move earlier
                    </button>
                    <button
                      type="button"
                      onClick={() => moveHighlight(highlight.id, 1)}
                      disabled={index === form.highlights.length - 1}
                      className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-primary hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Move later
                    </button>
                    <button
                      type="button"
                      onClick={() => removeHighlight(highlight.id)}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-red-200 text-red-700 hover:bg-red-50"
                      aria-label="Remove highlight"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              ))
            )}
            <button
              type="button"
              onClick={addHighlight}
              disabled={form.highlights.length >= 12}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-bold text-primary transition hover:border-primary/40 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add highlight
            </button>
          </div>
        </Section>

        <Section title="6. 360 virtual tour">
          <div className="space-y-4">
            <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-primary">
              <input
                type="checkbox"
                checked={form.tourEnabled}
                onChange={(event) => set("tourEnabled", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Show 360 virtual tour
            </label>
            <Field
              label="Tour link or embed code"
              hint="Paste a provider share link, MLS/unbranded link, embed URL or full iframe code."
            >
              <textarea
                rows={3}
                value={form.tourInput}
                onChange={(event) => set("tourInput", event.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Provider">
                <select
                  value={normalizedTourPreview?.provider ?? form.tourProvider}
                  onChange={(event) =>
                    set("tourProvider", event.target.value as PropertyTourProvider)
                  }
                  className={inputClass}
                >
                  <option value="kuula">Kuula</option>
                  <option value="matterport">Matterport</option>
                  <option value="cubiCasa">CubiCasa</option>
                  <option value="floorfy">Floorfy</option>
                  <option value="nodalview">Nodalview</option>
                  <option value="custom">Custom</option>
                </select>
              </Field>
              <Field label="Original/fallback URL">
                <input
                  value={form.tourExternalUrl}
                  onChange={(event) => set("tourExternalUrl", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Normalized embed URL preview">
                <input
                  value={normalizedTourPreview?.embedUrl ?? ""}
                  readOnly
                  aria-readonly="true"
                  className={protectedInputClass}
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="7. Property video">
          <div className="space-y-4">
            <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-primary">
              <input
                type="checkbox"
                checked={form.videosEnabled}
                onChange={(event) => set("videosEnabled", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Show property videos
            </label>
            <p className="text-sm leading-6 text-muted">
              Videos stay with YouTube, Vimeo, Cloudflare Stream, Mux or a configured trusted provider. PicchuSpot stores only the provider metadata and URLs.
            </p>
            {form.videos.map((video, index) => {
              const normalizedVideo = normalizePropertyVideoInput(
                video.provider,
                video.explicitEmbed
                  ? { embedUrl: video.input }
                  : { value: video.input },
              );
              return (
                <article
                  key={video.id}
                  className="rounded-lg border border-border bg-surface p-4"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-primary">
                        Video {index + 1}
                      </h3>
                      <p className="mt-1 text-xs text-muted">
                        {normalizedVideo?.canEmbed
                          ? "Trusted embed ready"
                          : video.input.trim()
                            ? "External fallback only or invalid input"
                            : "Add a public URL or iframe code"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => moveVideo(video.id, -1)}
                        disabled={index === 0}
                        aria-label={`Move video ${index + 1} up`}
                        className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-white text-primary disabled:opacity-40"
                      >
                        <ChevronUp className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveVideo(video.id, 1)}
                        disabled={index === form.videos.length - 1}
                        aria-label={`Move video ${index + 1} down`}
                        className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-white text-primary disabled:opacity-40"
                      >
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVideo(video.id)}
                        aria-label={`Remove video ${index + 1}`}
                        className="grid h-10 w-10 place-items-center rounded-lg border border-red-200 bg-white text-red-700"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Provider">
                      <select
                        value={video.provider}
                        onChange={(event) =>
                          updateVideo(
                            video.id,
                            "provider",
                            event.target.value as PropertyVideoProvider,
                          )
                        }
                        className={inputClass}
                      >
                        <option value="youtube">YouTube</option>
                        <option value="vimeo">Vimeo</option>
                        <option value="cloudflare-stream">Cloudflare Stream</option>
                        <option value="mux">Mux</option>
                        <option value="custom">Trusted custom provider</option>
                      </select>
                    </Field>
                    <Field label="Optional title">
                      <input
                        value={video.title}
                        onChange={(event) =>
                          updateVideo(video.id, "title", event.target.value)
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field
                      label="Public video URL or embed code"
                      hint="Paste a normal provider URL or complete iframe HTML. Arbitrary iframe origins are rejected by the server."
                    >
                      <textarea
                        rows={3}
                        value={video.input}
                        onChange={(event) => {
                          const value = event.target.value;
                          updateVideo(video.id, "input", value);
                          updateVideo(
                            video.id,
                            "explicitEmbed",
                            value.trim().toLowerCase().startsWith("<iframe"),
                          );
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Optional poster URL">
                      <input
                        value={video.posterUrl}
                        onChange={(event) =>
                          updateVideo(video.id, "posterUrl", event.target.value)
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 text-sm font-bold text-primary">
                      <input
                        type="checkbox"
                        checked={video.enabled}
                        onChange={(event) =>
                          updateVideo(video.id, "enabled", event.target.checked)
                        }
                        className="h-4 w-4 accent-primary"
                      />
                      Enabled
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-bold text-primary">
                      <input
                        type="radio"
                        name="primary-video"
                        checked={video.primary}
                        onChange={() => updateVideo(video.id, "primary", true)}
                        className="h-4 w-4 accent-primary"
                      />
                      Primary video
                    </label>
                  </div>
                </article>
              );
            })}
            <button
              type="button"
              onClick={addVideo}
              disabled={form.videos.length >= 20}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-bold text-primary transition hover:border-primary/40 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add video
            </button>
          </div>
        </Section>

        <Section title="8. Floor plans and interactive tour">
          <div className="space-y-4">
            <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-primary">
              <input
                type="checkbox"
                checked={form.floorPlansEnabled}
                onChange={(event) =>
                  set("floorPlansEnabled", event.target.checked)
                }
                className="h-4 w-4 accent-primary"
              />
              Show ordinary floor plans
            </label>
            <p className="text-sm leading-6 text-muted">
              Turning this off hides the ordinary Floor Plans section without deleting uploaded plan images. The interactive plan remains independent.
            </p>
            {legacyTourCandidates.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      Legacy floor-plan tour found
                    </p>
                    <p className="mt-1 leading-6">
                      Move it explicitly into the property-level settings. It will not be migrated during an unrelated save.
                    </p>
                    {legacyTourCandidates.length > 1 ? (
                      <label className="mt-3 block font-bold">
                        Select the correct legacy tour
                        <select
                          value={legacyTourCandidateId}
                          onChange={(event) =>
                            setLegacyTourCandidateId(event.target.value)
                          }
                          className={inputClass}
                        >
                          <option value="">Choose a tour</option>
                          {legacyTourCandidates.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.label} ({candidate.tour.provider})
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <button
                      type="button"
                      onClick={moveLegacyTourToPropertyLevel}
                      disabled={!legacyTourCandidateId}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#0f2440] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Move legacy tour to property-level settings
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-primary">
              <input
                type="checkbox"
                checked={form.interactiveEnabled}
                onChange={(event) => set("interactiveEnabled", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Show property-level interactive floor-plan tour
            </label>
            <Field
              label="Interactive plan link or embed code"
              hint="A normal CubiCasa share link opens in a new tab. To display CubiCasa inside PicchuSpot, paste the full code from CubiCasa -> Share -> Embedded code."
            >
              <textarea
                rows={3}
                value={form.interactiveEmbedUrl || form.interactiveExternalUrl}
                onChange={(event) => {
                  const value = event.target.value;
                  const normalized = normalizeInteractiveFloorPlanInput({
                    provider: form.interactiveProvider,
                    externalUrl: value,
                    embedUrl: value,
                  });
                  if (normalized?.embedUrl && !normalized.externalUrl) {
                    set("interactiveEmbedUrl", value);
                    set("interactiveExternalUrl", "");
                  } else {
                    set("interactiveExternalUrl", value);
                    set("interactiveEmbedUrl", "");
                  }
                }}
                className={inputClass}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Provider">
                <select
                  value={normalizedInteractivePreview?.provider ?? form.interactiveProvider}
                  onChange={(event) =>
                    set(
                      "interactiveProvider",
                      event.target.value as PropertyTourProvider,
                    )
                  }
                  className={inputClass}
                >
                  <option value="cubiCasa">CubiCasa</option>
                  <option value="floorfy">Floorfy</option>
                  <option value="nodalview">Nodalview</option>
                  <option value="kuula">Kuula</option>
                  <option value="matterport">Matterport</option>
                  <option value="custom">Custom</option>
                </select>
              </Field>
              <Field label="External URL">
                <input
                  value={form.interactiveExternalUrl}
                  onChange={(event) => set("interactiveExternalUrl", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Embed URL preview">
                <input
                  value={normalizedInteractivePreview?.embedUrl ?? form.interactiveEmbedUrl}
                  onChange={(event) => set("interactiveEmbedUrl", event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="9. Location and map">
          <div className="space-y-5">
            <p className="text-sm leading-6 text-muted">
              Exact maps use the property coordinates. Approximate maps publish only a separate fixed center and radius. Manual Google Maps URLs remain optional advanced overrides.
            </p>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-primary">Property address</h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Add structured address details for exact listings. Approximate and hidden privacy modes keep these values out of the public page.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Field label="Street address" hint="Example: Calle San Pablo 46">
                  <input
                    value={form.streetAddress}
                    onChange={(event) => set("streetAddress", event.target.value)}
                    className={inputClass}
                    placeholder="Calle San Pablo 46"
                  />
                </Field>
                <Field label="City / locality" hint="Example: Altea">
                  <input
                    value={form.city}
                    onChange={(event) => set("city", event.target.value)}
                    className={inputClass}
                    placeholder="Altea"
                  />
                </Field>
                <Field label="Region / province / state (optional)" hint="Example: Alicante">
                  <input
                    value={form.region}
                    onChange={(event) => set("region", event.target.value)}
                    className={inputClass}
                    placeholder="Alicante"
                  />
                </Field>
                <Field label="Postal code (optional)" hint="Example: 03590">
                  <input
                    value={form.postalCode}
                    onChange={(event) => set("postalCode", event.target.value)}
                    className={inputClass}
                    placeholder="03590"
                  />
                </Field>
                <Field label="Country (optional)">
                  <input
                    value={form.country}
                    onChange={(event) => set("country", event.target.value)}
                    className={inputClass}
                    placeholder="Spain"
                  />
                </Field>
              </div>
              <details className="mt-4 border-t border-border pt-4">
                <summary className="cursor-pointer text-sm font-bold text-primary">
                  Full display-address fallback (advanced)
                </summary>
                <Field
                  label="Legacy full display address"
                  hint="Optional backward-compatible fallback for older records and full-text search."
                >
                  <input
                    value={form.address}
                    onChange={(event) => set("address", event.target.value)}
                    className={inputClass}
                  />
                </Field>
              </details>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Exact latitude">
                <input
                  value={form.latitude}
                  onChange={(event) => set("latitude", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Exact longitude">
                <input
                  value={form.longitude}
                  onChange={(event) => set("longitude", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Privacy">
                <select
                  value={form.privacyMode}
                  onChange={(event) =>
                    set("privacyMode", event.target.value as FormState["privacyMode"])
                  }
                  className={inputClass}
                >
                  <option value="exact">Exact</option>
                  <option value="approximate">Approximate</option>
                  <option value="hidden">Hidden</option>
                </select>
              </Field>
              <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-primary md:self-end">
                <input
                  type="checkbox"
                  checked={form.showMap}
                  onChange={(event) => set("showMap", event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Show map
              </label>
              <Field label="Map zoom">
                <input
                  type="number"
                  min="1"
                  max="23"
                  step="1"
                  value={form.mapZoom}
                  onChange={(event) => set("mapZoom", event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            {form.privacyMode === "approximate" ? (
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-primary">
                    Fixed approximate zone
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Save a public-safe center that is separate from the exact property coordinates. The radius is shown in meters and remains anchored to this center.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Field
                    label="Approximate public location label"
                    hint="Use only a city, district, or other location label that is safe to publish. Leave blank to omit location text."
                  >
                    <input
                      value={form.approximateLabel}
                      onChange={(event) =>
                        set("approximateLabel", event.target.value)
                      }
                      className={inputClass}
                      placeholder="Altea, Alicante"
                    />
                  </Field>
                  <Field label="Approximate center latitude">
                    <input
                      type="number"
                      min="-90"
                      max="90"
                      step="0.000001"
                      value={form.approximateLatitude}
                      onChange={(event) =>
                        set("approximateLatitude", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Approximate center longitude">
                    <input
                      type="number"
                      min="-180"
                      max="180"
                      step="0.000001"
                      value={form.approximateLongitude}
                      onChange={(event) =>
                        set("approximateLongitude", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Approximate radius (meters)">
                    <input
                      type="number"
                      min="100"
                      max="50000"
                      step="100"
                      value={form.approximateRadiusMeters}
                      onChange={(event) =>
                        set("approximateRadiusMeters", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
                <label className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-white px-4 py-3 text-sm font-bold text-primary">
                  <input
                    type="checkbox"
                    checked={form.allowApproximateAreaLink}
                    onChange={(event) =>
                      set("allowApproximateAreaLink", event.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span>
                    <span className="block">
                      Allow opening approximate area in Google Maps
                    </span>
                    <span className="mt-1 block text-xs font-normal leading-5 text-muted">
                      The link uses only the public area name. Exact and approximate numeric coordinates are never placed in the external URL.
                    </span>
                  </span>
                </label>
                {mapPreview.externalUrl ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                    <span className="font-bold">Public area-link preview</span>
                    <a
                      href={mapPreview.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"
                    >
                      View approximate area in Google Maps
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className={`rounded-lg border p-4 ${
              mapStatus === "Invalid coordinates"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}>
              <p className="flex items-center gap-2 text-sm font-bold">
                <MapPin className="h-4 w-4" aria-hidden />
                {mapStatus}
              </p>
              <p className="mt-1 text-xs leading-5 opacity-80">
                {mapStatus === "Generated exact marker map"
                  ? "The public map uses the saved coordinates, marker, and zoom."
                  : mapStatus === "Generated approximate map"
                    ? "The preview uses the saved public-safe center and fixed radius. Exact coordinates and saved map URLs are not serialized."
                    : mapStatus === "Custom Google Maps embed"
                      ? "The saved, validated Google Maps iframe is active for this exact map."
                      : mapStatus === "Invalid coordinates"
                        ? "Enter latitude from -90 to 90 and longitude from -180 to 180."
                        : "No public map section will be rendered."}
              </p>
            </div>

            {mapPreview.mode === "embed" ? (
              <PropertyMapCanvas
                mapView={mapPreview}
                title={`Public map preview: ${form.title || "Property"}`}
                openLabel="Open preview in Google Maps"
                troubleLabel={mapStatus}
                compact
              />
            ) : (
              <div className="grid min-h-52 place-items-center rounded-lg border border-dashed border-border bg-surface px-5 text-center text-sm text-muted">
                {mapStatus}
              </div>
            )}

            <details className="rounded-lg border border-border bg-surface p-4">
              <summary className="cursor-pointer text-sm font-bold text-primary">
                Advanced Google Maps settings
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field
                  label="Google Maps external link"
                  hint={
                    form.privacyMode === "approximate"
                      ? "Ignored publicly in Approximate mode. Use the public area-link setting above for a text-only Google Maps search."
                      : normalizedMapExternal || !form.mapExternalUrl
                      ? "Optional fallback when exact coordinates are unavailable. Normal share links, including maps.app.goo.gl, open only in a new tab."
                      : "Only exact Google Maps origins are accepted."
                  }
                >
                  <input
                    value={form.mapExternalUrl}
                    onChange={(event) => set("mapExternalUrl", event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Google Maps iframe/embed code"
                  hint={
                    normalizedMapEmbed?.embedUrl || !form.mapEmbedUrl
                      ? "Preserved for compatibility. It is active only when the custom embed setting is enabled."
                      : "Paste a Google Maps /maps/embed iframe or URL."
                  }
                >
                  <label className="mb-3 flex items-center gap-3 text-sm font-bold text-primary">
                    <input
                      type="checkbox"
                      checked={form.useCustomMapEmbed}
                      onChange={(event) =>
                        set("useCustomMapEmbed", event.target.checked)
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    Use custom Google Maps embed
                  </label>
                  <textarea
                    rows={3}
                    value={form.mapEmbedUrl}
                    onChange={(event) => set("mapEmbedUrl", event.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </details>
          </div>
        </Section>

        <Section title="10. Realtor and agency">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-primary md:self-end">
              <input
                type="checkbox"
                checked={form.agentDisplayProfile}
                onChange={(event) =>
                  set("agentDisplayProfile", event.target.checked)
                }
                className="h-4 w-4 accent-primary"
              />
              Show realtor profile
            </label>
            <Field label="Agency">
              <input
                required
                value={form.agencyName}
                onChange={(event) => set("agencyName", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Agent name">
              <input
                value={form.agentName}
                onChange={(event) => set("agentName", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Role / title">
              <input
                value={form.agentRole}
                onChange={(event) => set("agentRole", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(event) => set("phone", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="WhatsApp">
              <input
                value={form.whatsapp}
                onChange={(event) => set("whatsapp", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => set("email", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Agency website">
              <input
                value={form.website}
                onChange={(event) => set("website", event.target.value)}
                className={inputClass}
              />
            </Field>
            {(Object.keys(form.socials) as PropertyAgentSocialProvider[]).map(
              (provider) => (
                <Field key={provider} label={`${SOCIAL_PROVIDER_INPUT_LABELS[provider]} URL`}>
                  <input
                    value={form.socials[provider]}
                    onChange={(event) => updateSocial(provider, event.target.value)}
                    className={inputClass}
                  />
                </Field>
              ),
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            Upload the realtor photo and agency logo in Manage media. They stay
            inside this property&apos;s Storage folder and are cleaned up only after
            a successful save.
          </p>
        </Section>

        <Section title="11. Social sharing brand">
          <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
            <Field
              label="Social-card branding"
              hint="Controls the server-generated 1200 x 630 sharing card."
            >
              <select
                value={form.socialBrandingMode}
                onChange={(event) =>
                  set(
                    "socialBrandingMode",
                    event.target.value as PropertySocialBrandingMode,
                  )
                }
                className={inputClass}
              >
                <option value="picchuspot">PicchuSpot</option>
                <option value="agency">Agency</option>
                <option value="unbranded">Unbranded</option>
              </select>
            </Field>
            <div data-testid="social-branding-admin-preview">
              {record && socialPreviewDraft ? (
                <PropertySocialCardPreview
                  propertyId={record.id}
                  property={socialPreviewDraft}
                  changed={true}
                />
              ) : (
                <div className="rounded-lg border border-border bg-surface p-5 text-sm leading-6 text-muted">
                  Save this new property once to activate its generated social preview. Existing properties preview unsaved title, price, address, agent, and branding changes here.
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="12. Translations">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {availableTranslationLanguages.map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => addTranslation(language)}
                  className="rounded-xl border border-border bg-white px-3.5 py-2 text-xs font-bold text-primary hover:border-primary/40"
                >
                  Add {PROPERTY_LANGUAGE_LABELS[language]}
                </button>
              ))}
            </div>
            {form.translations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-sm text-muted">
                No additional translations yet.
              </div>
            ) : (
              form.translations.map((translation) => {
                const completion = record
                  ? translationCompletion(
                      buildProperty(form, record.property),
                      translation.language,
                    )
                  : 0;
                return (
                  <article
                    key={translation.id}
                    className="rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-primary">
                          {PROPERTY_LANGUAGE_LABELS[translation.language]}
                        </h4>
                        <p className="mt-1 text-xs text-muted">
                          Completion: {completion}%
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTranslation(translation.id)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Title">
                        <input
                          value={translation.title}
                          onChange={(event) =>
                            updateTranslation(
                              translation.id,
                              "title",
                              event.target.value,
                            )
                          }
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Summary">
                        <textarea
                          rows={3}
                          value={translation.summary}
                          onChange={(event) =>
                            updateTranslation(
                              translation.id,
                              "summary",
                              event.target.value,
                            )
                          }
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Description">
                        <textarea
                          rows={5}
                          value={translation.description}
                          onChange={(event) =>
                            updateTranslation(
                              translation.id,
                              "description",
                              event.target.value,
                            )
                          }
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    {form.highlights.length > 0 ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {form.highlights.map((highlight, index) => (
                          <Field key={highlight.id} label={`Highlight ${index + 1}`}>
                            <input
                              value={translation.highlights[index] ?? ""}
                              onChange={(event) =>
                                updateTranslationHighlight(
                                  translation.id,
                                  index,
                                  event.target.value,
                                )
                              }
                              className={inputClass}
                            />
                          </Field>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </Section>

        <Section title="13. Publishing controls">
          <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-primary">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(event) => set("published", event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Publish publicly
          </label>
        </Section>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border bg-surface px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-bold text-primary disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-light disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {saving
            ? "Saving..."
            : mode === "create"
              ? "Create property"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
