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

const PropertyGalleryImageSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    src: z.string().trim().min(1).max(2048),
    alt: LocalizedTextSchema,
    label: LocalizedTextSchema,
    featuredForSharing: z.boolean().optional(),
    primarySocialPreview: z.boolean().optional(),
    note: OptionalLocalizedTextSchema.optional(),
    roomId: optionalTrimmed(120),
    hotspot: z
      .object({
        xPercent: z.number().min(0).max(100),
        yPercent: z.number().min(0).max(100),
      })
      .strict()
      .optional(),
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
    virtualTour: PropertyVirtualTourSchema.optional(),
    interactiveFloorPlanTour: PropertyInteractiveFloorPlanTourSchema.optional(),
    floorPlans: z.array(PropertyFloorPlanSchema).max(20),
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
  })
  .strict();

export type PropertyShowcaseMutation = z.infer<
  typeof PropertyShowcaseMutationSchema
>;
