import { z } from "zod";
import type { PropertyShowcase } from "./types";

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional();

const LocalizedTextSchema = z
  .object({
    en: z.string().trim().min(1).max(4000),
    es: optionalTrimmed(4000),
  })
  .strict();

const OptionalLocalizedTextSchema = z
  .object({
    en: z.string().trim().max(4000),
    es: optionalTrimmed(4000),
  })
  .strict();

const PropertyFactSchema = z
  .object({
    key: z.enum([
      "bedrooms",
      "bathrooms",
      "built-area",
      "plot-area",
      "parking",
      "year-built",
    ]),
    value: z.string().trim().min(1).max(100),
    label: LocalizedTextSchema,
  })
  .strict();

const PropertyHighlightSchema = z
  .object({
    title: LocalizedTextSchema,
    description: LocalizedTextSchema,
  })
  .strict();

const PropertyGalleryImageSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    src: z.string().trim().min(1).max(2048),
    alt: LocalizedTextSchema,
    label: LocalizedTextSchema,
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
    provider: z.enum([
      "kuula",
      "matterport",
      "cubiCasa",
      "floorfy",
      "nodalview",
      "custom",
    ]),
    embedUrl: optionalTrimmed(2048),
    externalUrl: optionalTrimmed(2048),
    posterImage: optionalTrimmed(2048),
  })
  .strict();

const PropertyFloorPlanSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    title: LocalizedTextSchema,
    imageUrl: z.string().trim().min(1).max(2048),
    downloadUrl: optionalTrimmed(2048),
    interactiveProvider: z
      .enum([
        "kuula",
        "matterport",
        "cubiCasa",
        "floorfy",
        "nodalview",
        "custom",
      ])
      .optional(),
    interactiveExternalUrl: optionalTrimmed(2048),
    interactiveEmbedUrl: optionalTrimmed(4096),
    interactiveUrl: optionalTrimmed(2048),
    sortOrder: z.number().int().min(-9999).max(9999),
  })
  .strict();

const PropertyLocationSchema = z
  .object({
    displayAddress: LocalizedTextSchema,
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    privacyMode: z.enum(["exact", "approximate", "hidden"]),
    airportTravelTime: OptionalLocalizedTextSchema.optional(),
  })
  .strict();

const PropertyAgentSchema = z
  .object({
    agencyName: z.string().trim().min(1).max(200),
    agentName: optionalTrimmed(200),
    role: OptionalLocalizedTextSchema.optional(),
    logoUrl: optionalTrimmed(2048),
    portraitUrl: optionalTrimmed(2048),
    phone: optionalTrimmed(80),
    whatsapp: optionalTrimmed(80),
    email: z.string().trim().email().max(320).optional().or(z.literal("")),
    website: optionalTrimmed(2048),
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
    title: LocalizedTextSchema,
    summary: LocalizedTextSchema,
    description: z.array(LocalizedTextSchema).max(20),
    priceLabel: LocalizedTextSchema,
    price: z.string().trim().min(1).max(100),
    coverImage: z.string().trim().min(1).max(2048),
    brochureUrl: optionalTrimmed(2048),
    languages: z.array(z.enum(["en", "es"])).min(1).max(2),
    facts: z.array(PropertyFactSchema).max(12),
    highlights: z.array(PropertyHighlightSchema).max(12),
    gallery: z.array(PropertyGalleryImageSchema).max(200),
    virtualTour: PropertyVirtualTourSchema.optional(),
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
    removeFloorPlan: z.boolean().optional(),
    replaceFloorPlans: z.boolean().optional(),
  })
  .strict();

export type PropertyShowcaseMutation = z.infer<
  typeof PropertyShowcaseMutationSchema
>;
