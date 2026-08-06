import { z } from "zod";
import type { PropertyShowcase } from "./types";

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional();

const PropertyLanguageCodeSchema = z.enum([
  "en",
  "es",
  "de",
  "fr",
  "nl",
  "pl",
  "uk",
  "ru",
]);

const PropertyTourProviderSchema = z.enum([
  "kuula",
  "matterport",
  "cubiCasa",
  "floorfy",
  "nodalview",
  "custom",
]);

const PropertyVideoProviderSchema = z.enum([
  "youtube",
  "vimeo",
  "cloudflare-stream",
  "mux",
  "custom",
]);

const LocalizedTextSchema = z
  .object({
    en: z.string().trim().min(1).max(4000),
    es: optionalTrimmed(4000),
  })
  .catchall(optionalTrimmed(4000));

const OptionalLocalizedTextSchema = z
  .object({
    en: z.string().trim().max(4000),
    es: optionalTrimmed(4000),
  })
  .catchall(optionalTrimmed(4000));

const PropertyFactSchema = z
  .object({
    key: z.enum([
      "price",
      "listing-reference",
      "bedrooms",
      "bathrooms",
      "built-area",
      "plot-area",
      "parking",
      "year-built",
    ]),
    value: z.string().trim().min(1).max(100),
    label: LocalizedTextSchema,
    sortOrder: z.number().int().min(-9999).max(9999).optional(),
    visible: z.boolean().optional(),
  })
  .strict();

const PropertyHighlightSchema = z
  .object({
    id: optionalTrimmed(120),
    text: LocalizedTextSchema.optional(),
    title: LocalizedTextSchema.optional(),
    description: LocalizedTextSchema.optional(),
    sortOrder: z.number().int().min(-9999).max(9999).optional(),
    visible: z.boolean().optional(),
  })
  .strict()
  .refine((highlight) => Boolean(highlight.text ?? highlight.title), {
    message: "Highlight text is required.",
  });

const PropertyImageFocalPointSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  })
  .strict();

const PropertyGalleryImageSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    src: z.string().trim().min(1).max(2048),
    alt: LocalizedTextSchema,
    label: LocalizedTextSchema,
    featuredForSharing: z.boolean().optional(),
    primarySocialPreview: z.boolean().optional(),
    socialPreviewOrder: z.number().int().min(1).max(200).optional(),
    note: OptionalLocalizedTextSchema.optional(),
    roomId: optionalTrimmed(120),
    hotspot: z
      .object({
        xPercent: z.number().min(0).max(100),
        yPercent: z.number().min(0).max(100),
      })
      .strict()
      .optional(),
    focalPoint: PropertyImageFocalPointSchema.optional(),
    sortOrder: z.number().int().min(-9999).max(9999),
  })
  .strict();

const PropertyVirtualTourSchema = z
  .object({
    enabled: z.boolean().optional(),
    provider: PropertyTourProviderSchema,
    embedUrl: optionalTrimmed(2048),
    externalUrl: optionalTrimmed(2048),
    posterImage: optionalTrimmed(2048),
  })
  .strict();

const PropertyInteractiveFloorPlanTourSchema = z
  .object({
    enabled: z.boolean(),
    provider: PropertyTourProviderSchema,
    externalUrl: optionalTrimmed(2048),
    embedUrl: optionalTrimmed(4096),
    posterImage: optionalTrimmed(2048),
  })
  .strict();

const PropertyVideoItemSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    provider: PropertyVideoProviderSchema,
    title: OptionalLocalizedTextSchema.optional(),
    externalUrl: optionalTrimmed(2048),
    embedUrl: optionalTrimmed(4096),
    playbackId: optionalTrimmed(240),
    posterUrl: optionalTrimmed(2048),
    enabled: z.boolean().optional(),
    primary: z.boolean().optional(),
    sortOrder: z.number().int().min(-9999).max(9999),
  })
  .strict();

const PropertyVideosSchema = z
  .object({
    enabled: z.boolean().optional(),
    items: z.array(PropertyVideoItemSchema).max(20),
  })
  .strict();

const PropertySocialPreviewSchema = z
  .object({
    brandingMode: z
      .enum(["picchuspot", "agency", "unbranded"])
      .optional(),
  })
  .strict();

const PropertySocialCardFactKeySchema = z.enum([
  "listing-reference",
  "bedrooms",
  "bathrooms",
  "parking",
  "built-area",
  "year-built",
  "plot-area",
]);

const PropertySocialCardSchema = z
  .object({
    mode: z.enum(["automatic", "custom"]),
    layout: z.enum(["image-focused", "balanced", "minimal"]),
    visibleFacts: z
      .array(PropertySocialCardFactKeySchema)
      .max(4)
      .refine((facts) => new Set(facts).size === facts.length, {
        message: "Social card facts must be unique.",
      }),
    factOrder: z
      .array(PropertySocialCardFactKeySchema)
      .max(7)
      .refine((facts) => new Set(facts).size === facts.length, {
        message: "Social card fact order must be unique.",
      }),
    showLocation: z.boolean(),
    showPrice: z.boolean(),
    showBranding: z.boolean(),
    showPoweredByPicchuSpot: z.boolean(),
  })
  .strict();

const uniqueStrings = (max: number, message: string) =>
  z
    .array(z.string().trim().min(1).max(120))
    .max(max)
    .refine((values) => new Set(values).size === values.length, { message });

const PropertyMarketingMediaSelectionSchema = z
  .object({
    enabled: z.boolean().optional(),
    layout: z
      .enum(["single-hero", "hero-two-square", "hero-four-grid"])
      .optional(),
    primaryMediaId: optionalTrimmed(120),
    secondaryMediaIds: uniqueStrings(
      4,
      "Marketing material supporting images must be unique.",
    ).optional(),
  })
  .strict();

const PropertyMarketingPortraitSelectionSchema = z
  .object({
    enabled: z.boolean().optional(),
    layout: z.enum(["a4-classic", "a4-editorial"]).optional(),
    primaryMediaId: optionalTrimmed(120),
    secondaryMediaIds: uniqueStrings(
      5,
      "Marketing flyer supporting images must be unique.",
    ).optional(),
  })
  .strict();

const PropertyMarketingBrochureSchema = z
  .object({
    orientation: z.enum(["portrait", "landscape"]).optional(),
    template: z
      .enum([
        "single-hero",
        "hero-two-square",
        "hero-four-grid",
        "a4-classic",
        "a4-editorial",
      ])
      .optional(),
    primaryMediaId: optionalTrimmed(120),
    supportingMediaIds: uniqueStrings(
      5,
      "Brochure supporting images must be unique.",
    ).optional(),
  })
  .strict()
  .superRefine((brochure, context) => {
    if (
      brochure.primaryMediaId &&
      brochure.supportingMediaIds?.includes(brochure.primaryMediaId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["supportingMediaIds"],
        message: "The primary brochure image cannot also be supporting media.",
      });
    }
  });

export const PropertyMarketingMaterialsSchema = z
  .object({
    enabled: z.boolean().optional(),
    brandingMode: z.enum(["picchuspot", "agency", "unbranded"]).optional(),
    includeAgent: z.boolean().optional(),
    includeAgencyLogo: z.boolean().optional(),
    includeQrCode: z.boolean().optional(),
    includeDisclaimer: z.boolean().optional(),
    marketingCopyMode: z
      .enum(["none", "summary", "highlights", "custom"])
      .optional(),
    customMarketingCopy: OptionalLocalizedTextSchema.optional(),
    disclaimer: OptionalLocalizedTextSchema.optional(),
    selectedFactKeys: z
      .array(PropertySocialCardFactKeySchema)
      .max(4)
      .refine((values) => new Set(values).size === values.length, {
        message: "Marketing material facts must be unique.",
      })
      .optional(),
    selectedHighlightIds: uniqueStrings(
      3,
      "Marketing material highlights must be unique.",
    ).optional(),
    brochure: PropertyMarketingBrochureSchema.optional(),
    landscape: PropertyMarketingMediaSelectionSchema.optional(),
    portrait: PropertyMarketingPortraitSelectionSchema.optional(),
  })
  .strict();

export const PropertyMarketingPreviewDraftSchema = z
  .object({
    marketingMaterials: PropertyMarketingMaterialsSchema,
    focalPoints: z
      .array(
        z
          .object({
            mediaId: z.string().trim().min(1).max(120),
            focalPoint: PropertyImageFocalPointSchema,
          })
          .strict(),
      )
      .max(200)
      .refine(
        (items) => new Set(items.map((item) => item.mediaId)).size === items.length,
        { message: "Preview focal-point media IDs must be unique." },
      ),
  })
  .strict();

const PropertyFloorPlanSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    title: LocalizedTextSchema,
    imageUrl: z.string().trim().min(1).max(2048),
    downloadUrl: optionalTrimmed(2048),
    interactiveProvider: PropertyTourProviderSchema.optional(),
    interactiveExternalUrl: optionalTrimmed(2048),
    interactiveEmbedUrl: optionalTrimmed(4096),
    interactiveUrl: optionalTrimmed(2048),
    sortOrder: z.number().int().min(-9999).max(9999),
  })
  .strict();

const PropertyLocationSchema = z
  .object({
    displayAddress: LocalizedTextSchema,
    streetAddress: optionalTrimmed(200),
    city: optionalTrimmed(160),
    region: optionalTrimmed(160),
    postalCode: optionalTrimmed(40),
    country: optionalTrimmed(120),
    approximateLabel: OptionalLocalizedTextSchema.optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    approximateLatitude: z.number().min(-90).max(90).optional(),
    approximateLongitude: z.number().min(-180).max(180).optional(),
    approximateRadiusMeters: z.number().int().min(100).max(50000).optional(),
    allowApproximateAreaLink: z.boolean().optional(),
    privacyMode: z.enum(["exact", "approximate", "hidden"]),
    airportTravelTime: OptionalLocalizedTextSchema.optional(),
    showMap: z.boolean().optional(),
    mapExternalUrl: optionalTrimmed(2048),
    mapEmbedUrl: optionalTrimmed(4096),
    useCustomMapEmbed: z.boolean().optional(),
    mapZoom: z.number().int().min(1).max(23).optional(),
  })
  .strict();

const PropertyAgentSocialSchema = z
  .object({
    provider: z.enum([
      "facebook",
      "instagram",
      "linkedin",
      "youtube",
      "tiktok",
      "x",
      "pinterest",
      "custom",
    ]),
    url: z.string().trim().min(1).max(2048),
    label: OptionalLocalizedTextSchema.optional(),
    sortOrder: z.number().int().min(-9999).max(9999).optional(),
  })
  .strict();

const PropertyAgentSchema = z
  .object({
    agencyName: z.string().trim().min(1).max(200),
    displayProfile: z.boolean().optional(),
    agentName: optionalTrimmed(200),
    role: OptionalLocalizedTextSchema.optional(),
    logoUrl: optionalTrimmed(2048),
    portraitUrl: optionalTrimmed(2048),
    phone: optionalTrimmed(80),
    whatsapp: optionalTrimmed(80),
    email: z.string().trim().email().max(320).optional().or(z.literal("")),
    website: optionalTrimmed(2048),
    socialLinks: z.array(PropertyAgentSocialSchema).max(12).optional(),
  })
  .strict();

const PropertyTranslationContentSchema = z
  .object({
    title: optionalTrimmed(4000),
    summary: optionalTrimmed(4000),
    description: z.array(z.string().trim().min(1).max(4000)).max(20).optional(),
    highlights: z.array(z.string().trim().min(1).max(4000)).max(12).optional(),
  })
  .strict();

export const PropertyShowcaseSchema: z.ZodType<PropertyShowcase> = z
  .object({
    slug: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must use lowercase letters, numbers and single hyphens.",
      ),
    reference: z.string().trim().min(1).max(100),
    status: z.enum(["for-sale", "reserved", "sold", "off-market"]),
    primaryLanguage: PropertyLanguageCodeSchema.optional(),
    title: LocalizedTextSchema,
    summary: LocalizedTextSchema,
    description: z.array(LocalizedTextSchema).max(20),
    priceLabel: LocalizedTextSchema,
    price: z.string().trim().min(1).max(100),
    coverImage: z.string().trim().min(1).max(2048),
    brochureUrl: optionalTrimmed(2048),
    languages: z.array(PropertyLanguageCodeSchema).min(1).max(8),
    translations: z
      .record(PropertyLanguageCodeSchema, PropertyTranslationContentSchema)
      .optional(),
    facts: z.array(PropertyFactSchema).max(12),
    highlights: z.array(PropertyHighlightSchema).max(12),
    gallery: z.array(PropertyGalleryImageSchema).max(200),
    videos: PropertyVideosSchema.optional(),
    virtualTour: PropertyVirtualTourSchema.optional(),
    interactiveFloorPlanTour: PropertyInteractiveFloorPlanTourSchema.optional(),
    floorPlansEnabled: z.boolean().optional(),
    floorPlans: z.array(PropertyFloorPlanSchema).max(20),
    socialPreview: PropertySocialPreviewSchema.optional(),
    socialCard: PropertySocialCardSchema.optional(),
    marketingMaterials: PropertyMarketingMaterialsSchema.optional(),
    location: PropertyLocationSchema,
    agent: PropertyAgentSchema,
    publishedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const PropertyShowcaseMutationSchema = z
  .object({
    property: PropertyShowcaseSchema,
    published: z.boolean(),
    updateMode: z.enum(["details", "media", "replace"]).optional(),
    removeVirtualTour: z.boolean().optional(),
    removeInteractiveFloorPlan: z.boolean().optional(),
    removeInteractivePoster: z.boolean().optional(),
    removeFloorPlan: z.boolean().optional(),
    replaceFloorPlans: z.boolean().optional(),
    updateSocialCard: z.boolean().optional(),
    updateMarketingMaterials: z.boolean().optional(),
  })
  .strict();

export type PropertyShowcaseMutation = z.infer<
  typeof PropertyShowcaseMutationSchema
>;
