import { z } from "zod";

// ============================================================
// SERVER-SIDE VALIDATION SCHEMAS
// These validate the JSON metadata sent alongside FormData.
// File validation is handled separately in the API route.
// ============================================================

const serviceTypes = [
  "virtual-staging",
  "virtual-renovation",
  "3d-floor-plans",
  "photo-editing",
] as const;

export const ServiceTypeSchema = z.enum(serviceTypes);

// --- Contact Details (shared) ---
export const ContactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(6, "Phone must be at least 6 characters"),
  company: z.string().optional().default(""),
});

// --- Virtual Staging Item ---
export const StagingItemSchema = z.object({
  roomName: z.string().min(1, "Room name is required"),
  furnitureStyle: z.string().min(1, "Furniture style is required"),
  referenceLink: z.string().url().optional().or(z.literal("")),
  additionalInfo: z.string().optional().default(""),
  selectedAddons: z.array(z.string()).default([]),
});

// --- Virtual Renovation Item ---
export const RenovationItemSchema = z.object({
  selectedInternal: z.array(z.string()).default([]),
  selectedExternal: z.array(z.string()).default([]),
  room: z.string().min(1, "Room / Area is required"),
  presentationStyle: z.string().optional().default(""),
  referenceLink: z.string().url().optional().or(z.literal("")),
  additionalInfo: z.string().optional().default(""),
}).refine(
  (data) => data.selectedInternal.length > 0 || data.selectedExternal.length > 0,
  { message: "At least one renovation option must be selected" }
);

// --- 3D Floor Plans Item ---
export const FloorPlanItemSchema = z.object({
  planType: z.string().min(1, "Plan type is required"),
  numberOfFloors: z.number().int().min(1).max(20),
  style3d: z.string().optional().default(""),
  planView3d: z.string().optional().default(""),
  pageOrientation: z.string().min(1, "Page orientation is required"),
  planOrientation: z.string().min(1, "Plan orientation is required"),
  flooringByRoom: z.record(z.string(), z.string()).optional().default({}),
  showAddress: z.boolean().default(false),
  streetAddress: z.string().optional().default(""),
  showTitle: z.boolean().default(false),
  projectTitle: z.string().optional().default(""),
  disclaimerOption: z.string().optional().default("Do not show disclaimer"),
  customDisclaimer: z.string().optional().default(""),
  referenceLink: z.string().url().optional().or(z.literal("")),
  additionalInfo: z.string().optional().default(""),
});

// --- Photo Editing Item ---
export const PhotoEditItemSchema = z.object({
  selectedOptions: z.array(z.string()).min(1, "At least one editing option is required"),
  additionalInfo: z.string().optional().default(""),
});

// --- Order-level Delivery Preferences (optional) ---
export const DeliveryPreferencesSchema = z.object({
  fileSizeLimit: z.string().optional().default(""),
  disclaimerText: z.string().max(2000, "Disclaimer too long").optional().default(""),
});

// --- Full Order Metadata Schema ---
export const OrderMetadataSchema = z.object({
  serviceType: ServiceTypeSchema,
  contact: ContactSchema,
  deliveryPreferences: DeliveryPreferencesSchema.optional(),
  items: z.array(z.unknown()).min(1, "At least one item is required").max(50, "Maximum 50 items per order"),
});

// --- Type exports ---
export type ServiceType = z.infer<typeof ServiceTypeSchema>;
export type ContactData = z.infer<typeof ContactSchema>;
export type DeliveryPreferences = z.infer<typeof DeliveryPreferencesSchema>;
export type StagingItem = z.infer<typeof StagingItemSchema>;
export type RenovationItem = z.infer<typeof RenovationItemSchema>;
export type FloorPlanItem = z.infer<typeof FloorPlanItemSchema>;
export type PhotoEditItem = z.infer<typeof PhotoEditItemSchema>;
