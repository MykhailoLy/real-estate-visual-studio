import { z } from "zod";

// --- Contact Details Schema (shared across order form) ---
export const contactDetailsSchema = z.object({
  client_name: z.string().min(2, "Name is required"),
  client_email: z.string().email("Valid email is required"),
  client_phone: z.string().min(6, "Phone number is required"),
  client_company: z.string().optional(),
  agree_terms: z.literal(true, {
    message: "You must agree to the Terms & Conditions",
  }),
});

// --- Virtual Staging Item Schema ---
export const stagingItemSchema = z.object({
  room_type: z.string().min(1, "Room type is required"),
  interior_style: z.string().min(1, "Interior style is required"),
  notes: z.string().optional(),
  reference_link: z.string().url().optional().or(z.literal("")),
});

// --- Virtual Renovation Item Schema ---
export const renovationItemSchema = z.object({
  instructions: z.string().min(10, "Renovation instructions are required"),
  elements_to_keep: z.string().optional(),
  elements_to_remove: z.string().optional(),
  elements_to_replace: z.string().optional(),
  preferred_materials: z.string().optional(),
  reference_link: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
});

// --- 3D Floor Plan Item Schema ---
export const floorPlanItemSchema = z.object({
  property_type: z.string().min(1, "Property type is required"),
  number_of_floors: z.number().min(1).max(10),
  output_type: z.enum(["2D", "3D", "Both"]),
  notes: z.string().optional(),
});

// --- Photo Editing Item Schema ---
export const photoEditItemSchema = z.object({
  editing_types: z.array(z.string()).min(1, "Select at least one editing type"),
  notes: z.string().optional(),
});

// --- Contact Form Schema ---
export const contactFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(6, "Phone number is required"),
  service_interest: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters"),
});
