// ============================================================
// DEDICATED PHOTO-EDITING SERVICES — shared configuration
//
// Image Enhancement, Day to Dusk, and Item Removal & Virtual
// Cleaning are dedicated front-end order forms that all submit
// through the EXISTING broad backend service_type = "photo-editing".
// Each one is identified by a `sub_service` slug stored in
// order_items.details and is pinned to exactly ONE existing
// PHOTO_EDIT_OPTIONS option id — so pricing and server
// recalculation reuse the current photo-editing path unchanged.
//
// This module is pure (no React, no server-only imports) so it can
// be shared by the client forms AND the server (validation, /api/order
// details, display labels, email).
// ============================================================

/** The three dedicated photo-editing sub-services. */
export const DEDICATED_PHOTO_EDITING_SUB_SERVICES = [
  "image-enhancement",
  "day-to-dusk",
  "item-removal-virtual-cleaning",
] as const;

export type DedicatedPhotoEditingSubService =
  (typeof DEDICATED_PHOTO_EDITING_SUB_SERVICES)[number];

export function isDedicatedPhotoEditingSubService(
  value: unknown,
): value is DedicatedPhotoEditingSubService {
  return (
    typeof value === "string" &&
    (DEDICATED_PHOTO_EDITING_SUB_SERVICES as readonly string[]).includes(value)
  );
}

/**
 * Minimum length (trimmed) of the removal instructions required for the
 * Item Removal & Virtual Cleaning form. Enforced on BOTH the client and
 * the server so the rules cannot diverge.
 */
export const ITEM_REMOVAL_MIN_INSTRUCTIONS = 5;

/**
 * UI + behaviour configuration for one dedicated form. Prices are NOT
 * here — the subtotal is derived from PHOTO_EDIT_OPTIONS via `optionId`.
 */
export interface DedicatedPhotoEditingConfig {
  subService: DedicatedPhotoEditingSubService;
  /** Human label, e.g. "Image Enhancement". */
  subServiceLabel: string;
  /** The single fixed PHOTO_EDIT_OPTIONS id this form always submits. */
  optionId: string;
  title: string;
  subtitle: string;
  /** Protected dashboard route for this form. */
  route: string;
  uploadLabel: string;
  notesLabel: string;
  notesPlaceholder: string;
  /** When true, instructions are required (>= ITEM_REMOVAL_MIN_INSTRUCTIONS). */
  notesRequired: boolean;
  /** Optional informational notice shown above the items (Item Removal only). */
  notice: string | null;
  /** Service name shown in the order summary sidebar. */
  summaryServiceName: string;
}

export const DEDICATED_PHOTO_EDITING_CONFIGS: Record<
  DedicatedPhotoEditingSubService,
  DedicatedPhotoEditingConfig
> = {
  "image-enhancement": {
    subService: "image-enhancement",
    subServiceLabel: "Image Enhancement",
    optionId: "image-enhancement-re",
    title: "Image Enhancement",
    subtitle:
      "Improve your real-estate listing images through professional colour, exposure, white balance, contrast and detail correction.",
    route: "/dashboard/orders/new/image-enhancement",
    uploadLabel: "Upload Original Photo",
    notesLabel: "Additional Instructions",
    notesPlaceholder:
      "Optional: any specific enhancement notes for this photo (e.g. brighten interior, recover window view)...",
    notesRequired: false,
    notice: null,
    summaryServiceName: "Image Enhancement",
  },
  "day-to-dusk": {
    subService: "day-to-dusk",
    subServiceLabel: "Day to Dusk",
    optionId: "day-to-dusk-pe",
    title: "Day to Dusk",
    subtitle:
      "Convert a daytime exterior image into a warm twilight / dusk result with a glowing sky and lit windows.",
    route: "/dashboard/orders/new/day-to-dusk",
    uploadLabel: "Upload Daytime Exterior Photo",
    notesLabel: "Additional Instructions",
    notesPlaceholder:
      "Optional: any specific notes for this photo (e.g. warmer sky, switch on interior lights)...",
    notesRequired: false,
    notice: null,
    summaryServiceName: "Day to Dusk",
  },
  "item-removal-virtual-cleaning": {
    subService: "item-removal-virtual-cleaning",
    subServiceLabel: "Item Removal & Virtual Cleaning",
    optionId: "item-removal-cleaning-pe",
    title: "Item Removal & Virtual Cleaning",
    subtitle:
      "Remove clutter, objects, and distractions so the space looks clean and listing-ready.",
    route: "/dashboard/orders/new/item-removal-virtual-cleaning",
    uploadLabel: "Upload Original Photo",
    notesLabel: "What should be removed or cleaned?",
    notesPlaceholder:
      "Describe exactly what to remove or clean in this photo (e.g. remove the bins and car, clear the kitchen counter)...",
    notesRequired: true,
    notice:
      "Some item removal projects can be complex. Removing large objects may require recreating the hidden background area. If the image requires advanced reconstruction, we may confirm a custom quote before starting.",
    summaryServiceName: "Item Removal & Virtual Cleaning",
  },
};

/** sub-service → its single required PHOTO_EDIT_OPTIONS id. */
export const SUB_SERVICE_REQUIRED_OPTION: Record<
  DedicatedPhotoEditingSubService,
  string
> = {
  "image-enhancement": "image-enhancement-re",
  "day-to-dusk": "day-to-dusk-pe",
  "item-removal-virtual-cleaning": "item-removal-cleaning-pe",
};

/** sub-service → display label (server + email + dashboards). */
export const SUB_SERVICE_LABEL: Record<DedicatedPhotoEditingSubService, string> =
  {
    "image-enhancement": "Image Enhancement",
    "day-to-dusk": "Day to Dusk",
    "item-removal-virtual-cleaning": "Item Removal & Virtual Cleaning",
  };

/**
 * Resolve the dedicated label for a `sub_service` value (any string from
 * order_items.details). Returns null when the value is not a recognised
 * dedicated sub-service, so callers fall back to the broad service label.
 */
export function getDedicatedSubServiceLabel(
  subService: unknown,
): string | null {
  return isDedicatedPhotoEditingSubService(subService)
    ? SUB_SERVICE_LABEL[subService]
    : null;
}
