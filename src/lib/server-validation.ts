import { z } from "zod";
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  parseDirectPendingPath,
} from "./upload-config.ts";
import {
  MAX_REFERENCE_FILES,
  MAX_REFERENCE_FILE_SIZE_BYTES,
  MAX_REFERENCE_TOTAL_SIZE_BYTES,
  REFERENCE_FILE_ERRORS,
  REFERENCE_FILE_MIME_TYPES,
} from "./reference-files.ts";
import {
  DEDICATED_PHOTO_EDITING_SUB_SERVICES,
  SUB_SERVICE_REQUIRED_OPTION,
  ITEM_REMOVAL_MIN_INSTRUCTIONS,
} from "./dedicated-photo-editing.ts";
import {
  AERIAL_EDITING_ID_VALUES,
  AERIAL_EDITING_OPTION_IDS,
  SINGLE_EXPOSURE_STANDARD_ADDON_IDS,
  THREE_STATE_VALUES,
  DAY_SKY_STYLE_ID_VALUES,
  getAerialEditingOption,
} from "./image-enhancement.ts";
import { DUSK_STYLE_ID_VALUES } from "./day-to-dusk.ts";
import { REMOVAL_TASK_ID_VALUES } from "./item-removal.ts";
import {
  FLOOR_PLAN_TYPE_IDS,
  PHOTO_EDIT_OPTION_IDS,
  RENOVATION_EXTERNAL_IDS,
  RENOVATION_INTERNAL_IDS,
  STAGING_ADDON_IDS,
} from "./pricing/catalog.ts";
import { TRANSACTIONAL_CURRENCIES } from "./pricing/types.ts";

// ============================================================
// SERVER-SIDE VALIDATION SCHEMAS
// Validates the JSON payload posted to /api/order. Files
// themselves are uploaded separately to Supabase Storage via
// signed URLs from /api/upload-url; the order payload only
// references their storage paths through `itemFiles`.
// ============================================================

const serviceTypes = [
  "virtual-staging",
  "virtual-renovation",
  "3d-floor-plans",
  "photo-editing",
] as const;

export const ServiceTypeSchema = z.enum(serviceTypes);
export const TransactionalCurrencySchema = z.enum(TRANSACTIONAL_CURRENCIES);

function rejectDuplicates(
  values: string[],
  ctx: z.RefinementCtx,
  path: string
) {
  if (new Set(values).size !== values.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [path],
      message: `${path} must not contain duplicate IDs.`,
    });
  }
}

// --- Contact Details (shared) ---
export const ContactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(6, "Phone must be at least 6 characters"),
  company: z.string().optional().default(""),
});

// --- Per-item delivery preferences (optional, applies to one item) ---
// Mixed into every per-item schema below so each image / item carries its
// own values. Both fields are optional and free-form so we never fight the
// client about wording.
const itemDeliveryFields = {
  fileSizeLimit: z.string().optional().default(""),
  disclaimerText: z
    .string()
    .max(2000, "Disclaimer too long")
    .optional()
    .default(""),
};

const OptionalHttpUrlSchema = z
  .string()
  .max(5000)
  .refine((value) => {
    if (!value) return true;
    try {
      const parsed = new URL(value);
      return (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        !parsed.username &&
        !parsed.password
      );
    } catch {
      return false;
    }
  }, "Reference Link must be a valid HTTP or HTTPS URL.");

// --- Virtual Staging Item ---
export const StagingItemSchema = z
  .object({
    roomName: z.string().min(1, "Room name is required"),
    furnitureStyle: z.string().min(1, "Furniture style is required"),
    referenceLink: OptionalHttpUrlSchema.optional().default(""),
    additionalInfo: z.string().optional().default(""),
    selectedAddons: z
      .array(z.enum(STAGING_ADDON_IDS as [string, ...string[]]))
      .default([]),
    ...itemDeliveryFields,
  })
  .superRefine((data, ctx) =>
    rejectDuplicates(data.selectedAddons, ctx, "selectedAddons")
  );

// --- Virtual Renovation Item ---
export const RenovationItemSchema = z
  .object({
    selectedInternal: z
      .array(z.enum(RENOVATION_INTERNAL_IDS as [string, ...string[]]))
      .default([]),
    selectedExternal: z
      .array(z.enum(RENOVATION_EXTERNAL_IDS as [string, ...string[]]))
      .default([]),
    room: z.string().min(1, "Room / Area is required"),
    presentationStyle: z.string().optional().default(""),
    referenceLink: OptionalHttpUrlSchema.optional().default(""),
    additionalInfo: z.string().optional().default(""),
    ...itemDeliveryFields,
  })
  .superRefine((data, ctx) => {
    if (
      data.selectedInternal.length === 0 &&
      data.selectedExternal.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one renovation option must be selected",
      });
    }
    rejectDuplicates(data.selectedInternal, ctx, "selectedInternal");
    rejectDuplicates(data.selectedExternal, ctx, "selectedExternal");
  });

// --- 3D Floor Plans Item ---
export const FloorPlanItemSchema = z.object({
  planType: z.enum(FLOOR_PLAN_TYPE_IDS as [string, ...string[]]),
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
  referenceLink: OptionalHttpUrlSchema.optional().default(""),
  additionalInfo: z.string().optional().default(""),
  ...itemDeliveryFields,
});

// --- Photo Editing Item ---
// Supports BOTH the legacy generic form (multi-option, no subService) and
// the dedicated forms (Image Enhancement / Day to Dusk / Item Removal),
// which pin a single sub-service via `subService`. All still post under the
// broad service_type = "photo-editing".
export const PhotoEditItemSchema = z
  .object({
    selectedOptions: z
      .array(z.enum(PHOTO_EDIT_OPTION_IDS as [string, ...string[]]))
      .min(1, "At least one editing option is required"),
    subService: z.enum(DEDICATED_PHOTO_EDITING_SUB_SERVICES).optional(),
    additionalInfo: z.string().optional().default(""),
    referenceLink: OptionalHttpUrlSchema.optional().default(""),
    // --- Image Enhancement — Single Exposure preferences ---
    // All optional + typed enums so other photo-editing sub-services
    // and the legacy generic form are unaffected. Validated below only
    // for the single-exposure sub-service. Browser-supplied labels are
    // never trusted; labels are derived server-side from these enums.
    grassRepair: z.enum(THREE_STATE_VALUES).optional(),
    skyReplacement: z.enum(THREE_STATE_VALUES).optional(),
    tvScreenReplacement: z.enum(THREE_STATE_VALUES).optional(),
    addFireToFireplace: z.enum(THREE_STATE_VALUES).optional(),
    daySkyStyle: z.enum(DAY_SKY_STYLE_ID_VALUES).optional(),
    aerialEditing: z.enum(AERIAL_EDITING_ID_VALUES).optional(),
    aerialEditingInstructions: z
      .string()
      .max(5000, "Aerial editing instructions are too long")
      .optional()
      .default(""),
    // --- Day to Dusk preferences ---
    // All optional + typed so other photo-editing sub-services and the
    // legacy generic form are unaffected. Validated below only for the
    // day-to-dusk sub-service. Browser-supplied labels are never trusted;
    // labels are derived server-side from the dusk-style enum. Every one
    // of these is included in the base price (never changes the subtotal).
    duskStyle: z.enum(DUSK_STYLE_ID_VALUES).optional(),
    turnOnInteriorLights: z.boolean().optional(),
    turnOnExteriorLights: z.boolean().optional(),
    addPoolLights: z.boolean().optional(),
    // --- Item Removal & Virtual Cleaning work types ---
    // Optional + typed enum so other photo-editing sub-services and the
    // legacy generic form are unaffected. Validated below only for the
    // item-removal sub-service. Unknown task values are rejected at parse
    // time by the enum; presence/non-empty/no-duplicates are enforced in
    // superRefine. Labels are derived server-side, never trusted.
    removalTasks: z.array(z.enum(REMOVAL_TASK_ID_VALUES)).optional(),
    ...itemDeliveryFields,
  })
  .superRefine((data, ctx) => {
    rejectDuplicates(data.selectedOptions, ctx, "selectedOptions");
    // Legacy generic Photo Editing: no subService → any valid combination
    // of PHOTO_EDIT_OPTIONS is allowed (unchanged behaviour).
    if (!data.subService) return;

    // Dedicated sub-services normally pin exactly one option. Single Exposure
    // additionally allows its explicit per-photo add-ons while retaining the
    // required Image Enhancement base option.
    const required = SUB_SERVICE_REQUIRED_OPTION[data.subService];
    const singleExposureAllowed = new Set([
      required,
      ...SINGLE_EXPOSURE_STANDARD_ADDON_IDS,
      ...AERIAL_EDITING_OPTION_IDS,
    ]);
    const dedicatedOptionsValid =
      data.subService === "image-enhancement-single-exposure"
        ? data.selectedOptions.includes(required) &&
          data.selectedOptions.every((id) => singleExposureAllowed.has(id))
        : data.selectedOptions.length === 1 &&
          data.selectedOptions[0] === required;
    if (!dedicatedOptionsValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectedOptions"],
        message:
          data.subService === "image-enhancement-single-exposure"
            ? `For ${data.subService}, selectedOptions must contain "${required}" and only approved Single Exposure add-ons.`
            : `For ${data.subService}, selectedOptions must be exactly ["${required}"].`,
      });
    }

    if (data.subService === "image-enhancement-single-exposure") {
      const requiredPreferences = [
        ["grassRepair", data.grassRepair],
        ["skyReplacement", data.skyReplacement],
        ["tvScreenReplacement", data.tvScreenReplacement],
        ["addFireToFireplace", data.addFireToFireplace],
      ] as const;
      for (const [field, value] of requiredPreferences) {
        if (value === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} preference is required.`,
          });
        }
      }

      if (data.skyReplacement === "yes" && data.daySkyStyle === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["daySkyStyle"],
          message: "A day sky style is required when Sky Replacement is Yes.",
        });
      }

      const aerial = getAerialEditingOption(data.aerialEditing);
      const selectedAerialIds = data.selectedOptions.filter((id) =>
        AERIAL_EDITING_OPTION_IDS.includes(id),
      );
      const aerialSelectionValid = aerial.optionId
        ? selectedAerialIds.length === 1 &&
          selectedAerialIds[0] === aerial.optionId
        : selectedAerialIds.length === 0;
      if (!aerialSelectionValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["aerialEditing"],
          message: "Aerial Editing must match the selected priced option.",
        });
      }
    }

    // Item Removal & Virtual Cleaning requires meaningful removal instructions.
    if (
      data.subService === "item-removal-virtual-cleaning" &&
      (data.additionalInfo ?? "").trim().length < ITEM_REMOVAL_MIN_INSTRUCTIONS
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["additionalInfo"],
        message: "Please describe what should be removed or cleaned.",
      });
    }

    // Item Removal & Virtual Cleaning also requires at least one known
    // work-type task, with no duplicates. Unknown task keys are already
    // rejected at parse time by the z.enum above; here we enforce that
    // the list is present, non-empty and free of duplicates so a tampered
    // payload cannot omit it or repeat values.
    if (data.subService === "item-removal-virtual-cleaning") {
      const tasks = data.removalTasks ?? [];
      if (tasks.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["removalTasks"],
          message: "Select at least one work type (item removal, decluttering or virtual cleaning).",
        });
      } else if (new Set(tasks).size !== tasks.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["removalTasks"],
          message: "Work types must not contain duplicates.",
        });
      }
    }

    // Day to Dusk requires a known dusk style + real boolean lighting
    // preferences. The dusk-style enum already rejects unknown keys when
    // present; here we additionally require the fields to be supplied so a
    // tampered payload cannot omit them. Unknown dusk styles, missing
    // preference fields, and arbitrary labels are all rejected.
    if (data.subService === "day-to-dusk") {
      if (data.duskStyle === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["duskStyle"],
          message: "A dusk sky style is required for Day to Dusk.",
        });
      }
      if (typeof data.turnOnInteriorLights !== "boolean") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["turnOnInteriorLights"],
          message: "Interior lights preference must be true or false.",
        });
      }
      if (typeof data.turnOnExteriorLights !== "boolean") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["turnOnExteriorLights"],
          message: "Exterior lights preference must be true or false.",
        });
      }
      if (typeof data.addPoolLights !== "boolean") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["addPoolLights"],
          message: "Pool lights preference must be true or false.",
        });
      }
    }
  });

// --- Order-level Delivery Preferences ---
// Kept for backward compatibility with earlier clients. The current UI
// sends preferences on each item, not on the order, but we still accept
// this field so deployed clients keep working during a rollout.
export const DeliveryPreferencesSchema = z.object({
  fileSizeLimit: z.string().optional().default(""),
  disclaimerText: z.string().max(2000, "Disclaimer too long").optional().default(""),
});

// --- Order-level Terms Acceptance ---
// `accepted` MUST be true; the API rejects orders that do not include it.
// `version` lets us know which terms wording the client agreed to.
// `acceptedAt` is optional from the client; the API replaces it with the
// server's own ISO timestamp before persisting so the recorded time
// cannot be manipulated by the browser.
export const TermsAcceptanceSchema = z.object({
  accepted: z.literal(true, {
    message: "Terms must be accepted to submit an order",
  }),
  version: z.string().min(1).max(50).optional().default("unspecified"),
  acceptedAt: z.string().datetime().optional(),
});

// --- Order-level Portfolio Permission (optional) ---
export const PortfolioPermissionSchema = z.object({
  allowed: z.boolean(),
});

// --- Uploaded file metadata (lightweight reference to a file already
//     stored in Supabase Storage) ---
//
// Files are no longer streamed through /api/order. Instead the client
// uploads directly to Supabase Storage via a signed upload URL and then
// posts only this descriptor to /api/order. Path is constrained to the
// `pending/<user-id>/<token>/...` namespace so a malicious client cannot
// point us at arbitrary objects (e.g. another tenant's files). Direct
// pending descriptors are hard-cut over to the user-bound path format.
export const UploadedFileSchema = z.object({
  bucket: z.string().min(1).max(100),
  path: z
    .string()
    .min(1)
    .max(500)
    .refine(
      (path) => parseDirectPendingPath(path) !== null,
      "Path must live under pending/<user-id>/<token>/..."
    ),
  originalFilename: z.string().min(1).max(255),
  size: z
    .number()
    .int()
    .min(1, "File appears to be empty")
    .max(MAX_FILE_SIZE_BYTES, `File exceeds ${MAX_FILE_SIZE_MB} MB limit`),
  mimeType: z.string().min(1).max(255),
});

export const UploadedReferenceFileSchema = UploadedFileSchema.extend({
  referenceId: z.string().uuid(),
  position: z.number().int().min(0).max(9),
}).superRefine((file, ctx) => {
  const parsed = parseDirectPendingPath(file.path);
  if (
    !parsed ||
    parsed.kind !== "reference" ||
    parsed.referenceId !== file.referenceId ||
    parsed.referencePosition !== file.position
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["path"],
      message: "Reference identity and position must match its pending path.",
    });
  }
  if (!(REFERENCE_FILE_MIME_TYPES as readonly string[]).includes(file.mimeType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mimeType"],
      message: REFERENCE_FILE_ERRORS.type,
    });
  }
  if (file.size > MAX_REFERENCE_FILE_SIZE_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["size"],
      message: "Each reference file must be 20 MB or smaller.",
    });
  }
});

export const ItemFilesSchema = z
  .object({
    original: UploadedFileSchema,
    reference: UploadedFileSchema.nullable().optional(),
    references: z.array(UploadedReferenceFileSchema).max(MAX_REFERENCE_FILES).default([]),
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    const positions = new Set<number>();
    const paths = new Set<string>();
    let total = 0;
    for (const reference of data.references) {
      total += reference.size;
      if (
        ids.has(reference.referenceId) ||
        positions.has(reference.position) ||
        paths.has(reference.path)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["references"],
          message: "Reference identities, positions and paths must be unique.",
        });
        break;
      }
      ids.add(reference.referenceId);
      positions.add(reference.position);
      paths.add(reference.path);
    }
    const distinctLegacyReference =
      data.reference && !paths.has(data.reference.path) ? data.reference : null;
    if (data.references.length + (distinctLegacyReference ? 1 : 0) > MAX_REFERENCE_FILES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["references"],
        message: "You can upload up to 10 reference files.",
      });
    }
    if (distinctLegacyReference) {
      total += distinctLegacyReference.size;
      if (distinctLegacyReference.size > MAX_REFERENCE_FILE_SIZE_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reference", "size"],
          message: "Each reference file must be 20 MB or smaller.",
        });
      }
    }
    if (total > MAX_REFERENCE_TOTAL_SIZE_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["references"],
        message: "Reference files may total up to 100 MB.",
      });
    }
  });

// --- Full Order Metadata Schema ---
// `termsAcceptance` is REQUIRED. The previous order-level fields
// (`deliveryPreferences`, `portfolioPermission`) are optional.
//
// `itemFiles` is parallel to `items` (same length / same index order)
// and points to files already uploaded to Supabase Storage. The API
// route enforces this length match and refuses orders without it.
export const OrderMetadataSchema = z.object({
  serviceType: ServiceTypeSchema,
  currency: TransactionalCurrencySchema,
  // Required order-level Job Title. Trimmed, 3–120 chars. Persisted to
  // orders.job_title. NEVER trust the client value alone — this schema
  // is the authoritative gate. Kept separate from item metadata.
  jobTitle: z
    .string({ message: "Job Title is required" })
    .trim()
    .min(3, "Job Title must be at least 3 characters")
    .max(120, "Job Title must be at most 120 characters"),
  // NOTE: client contact identity is NO LONGER accepted from the body.
  // /api/order resolves client_name / client_email / client_phone /
  // client_company server-side from the verified session + client_profiles.
  // (ContactSchema is retained as a type export for legacy references.)
  deliveryPreferences: DeliveryPreferencesSchema.optional(),
  termsAcceptance: TermsAcceptanceSchema,
  portfolioPermission: PortfolioPermissionSchema.optional(),
  items: z.array(z.unknown()).min(1, "At least one item is required").max(50, "Maximum 50 items per order"),
  itemFiles: z
    .array(ItemFilesSchema)
    .min(1, "At least one uploaded file is required")
    .max(50, "Maximum 50 items per order"),
});

// --- Type exports ---
export type ServiceType = z.infer<typeof ServiceTypeSchema>;
export type TransactionalOrderCurrency = z.infer<
  typeof TransactionalCurrencySchema
>;
export type ContactData = z.infer<typeof ContactSchema>;
export type DeliveryPreferences = z.infer<typeof DeliveryPreferencesSchema>;
export type TermsAcceptance = z.infer<typeof TermsAcceptanceSchema>;
export type PortfolioPermission = z.infer<typeof PortfolioPermissionSchema>;
export type StagingItem = z.infer<typeof StagingItemSchema>;
export type RenovationItem = z.infer<typeof RenovationItemSchema>;
export type FloorPlanItem = z.infer<typeof FloorPlanItemSchema>;
export type PhotoEditItem = z.infer<typeof PhotoEditItemSchema>;
export type UploadedFile = z.infer<typeof UploadedFileSchema>;
export type UploadedReferenceFile = z.infer<typeof UploadedReferenceFileSchema>;
export type ItemFiles = z.infer<typeof ItemFilesSchema>;
