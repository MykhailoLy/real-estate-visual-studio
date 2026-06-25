// ============================================================
// ORDER OPTIONS & PRICING DATA
// Labels and stable option IDs for transactional order forms.
// Fixed currency prices live only in src/lib/pricing/catalog.ts.
// ============================================================

// --- Virtual Staging ---

export const STAGING_ROOM_OPTIONS = [
  "Bedroom 1",
  "Bedroom 2",
  "Bedroom 3",
  "Bedroom 4",
  "Bedroom 5",
  "Bathroom",
  "Dining Room",
  "Dining / Kitchen",
  "Family Room",
  "Game Room",
  "Kitchen",
  "Living Room - No TV",
  "Living Room - With TV",
  "Master Bedroom",
  "Outdoor",
  "Study",
  "Other",
] as const;

export const STAGING_STYLE_OPTIONS = [
  "Modern",
  "Urban / Industrial",
  "Scandinavian",
  "Mid-Century Modern",
  "Farmhouse",
  "Hamptons",
  "Contemporary",
  "Traditional",
  "Commercial Office",
  "Commercial Non-Office",
] as const;

/**
 * Visual cards rendered alongside the Furniture Style dropdown on the
 * Virtual Staging order page. The label here MUST exactly match the
 * corresponding STAGING_STYLE_OPTIONS entry so dropdown <-> card selection
 * stays in sync.
 *
 * `imageSrc` points at /public/images/styles/*.jpg. Real images are added
 * later; if a file is missing, StyleSelector falls back to a clean named
 * placeholder block.
 */
export interface StagingStyleCard {
  label: (typeof STAGING_STYLE_OPTIONS)[number];
  imageSrc: string;
}

export const STAGING_STYLE_CARDS: StagingStyleCard[] = [
  { label: "Modern", imageSrc: "/images/styles/modern.jpg" },
  { label: "Urban / Industrial", imageSrc: "/images/styles/urban-industrial.jpg" },
  { label: "Scandinavian", imageSrc: "/images/styles/scandinavian.jpg" },
  { label: "Mid-Century Modern", imageSrc: "/images/styles/mid-century-modern.jpg" },
  { label: "Farmhouse", imageSrc: "/images/styles/farmhouse.jpg" },
  { label: "Hamptons", imageSrc: "/images/styles/hamptons.jpg" },
  { label: "Contemporary", imageSrc: "/images/styles/contemporary.jpg" },
  { label: "Traditional", imageSrc: "/images/styles/traditional.jpg" },
  { label: "Commercial Office", imageSrc: "/images/styles/commercial-office.jpg" },
  { label: "Commercial Non-Office", imageSrc: "/images/styles/commercial-non-office.jpg" },
];

export interface AddOnOption {
  id: string;
  label: string;
  priceKey: import("@/lib/pricing/types").PriceKey;
}

export const STAGING_ADDONS: AddOnOption[] = [
  { id: "image-enhancement", label: "Image Enhancement", priceKey: "image-enhancement" },
  { id: "day-to-dusk", label: "Day to Dusk", priceKey: "day-to-dusk" },
  { id: "item-removal", label: "Item Removal & Virtual Cleaning", priceKey: "item-removal-virtual-cleaning" },
  { id: "turn-on-lights", label: "Turn On Lights", priceKey: "turn-on-lights" },
  { id: "colour-change", label: "Colour Change", priceKey: "colour-change" },
];

// --- Virtual Renovation ---

export interface RenovationOption {
  id: string;
  label: string;
  priceKey: import("@/lib/pricing/types").PriceKey;
}

export const RENOVATION_INTERNAL_OPTIONS: RenovationOption[] = [
  { id: "replace-flooring", label: "Replace Flooring", priceKey: "renovation-replace-flooring" },
  { id: "replace-walls", label: "Replace Walls", priceKey: "renovation-replace-walls" },
  { id: "replace-ceiling", label: "Replace Ceiling", priceKey: "renovation-replace-ceiling" },
  { id: "item-removal-cleaning", label: "Item Removal & Virtual Cleaning", priceKey: "renovation-item-removal-cleaning" },
  { id: "add-remove-walls", label: "Add / Remove Walls", priceKey: "renovation-add-remove-walls" },
  { id: "kitchen-fit-out", label: "Add or Complete Kitchen Fit Out", priceKey: "renovation-kitchen-fit-out" },
  { id: "bathroom-fit-out", label: "Add or Complete Bathroom Fit Out", priceKey: "renovation-bathroom-fit-out" },
  { id: "add-fixtures", label: "Add Fixtures", priceKey: "renovation-add-fixtures" },
  { id: "staging-residential", label: "Virtual Staging Residential", priceKey: "renovation-staging-residential" },
  { id: "staging-commercial-office", label: "Virtual Staging Commercial - Office", priceKey: "renovation-staging-commercial-office" },
  { id: "staging-commercial-non-office", label: "Virtual Staging Commercial - Non-office", priceKey: "renovation-staging-commercial-non-office" },
  { id: "color-change-interior", label: "Color Change of Walls, Ceiling and/or Doors", priceKey: "renovation-colour-change-interior" },
];

export const RENOVATION_EXTERNAL_OPTIONS: RenovationOption[] = [
  { id: "add-pool", label: "Add Pool Only", priceKey: "renovation-add-pool" },
  { id: "add-pool-surrounds", label: "Add Pool Surrounds", priceKey: "renovation-pool-surrounds" },
  { id: "remove-pool-cover", label: "Remove Pool Cover", priceKey: "renovation-remove-pool-cover" },
  { id: "add-leaves", label: "Add Leaves", priceKey: "renovation-add-leaves" },
  { id: "basic-landscaping", label: "Add Basic Landscaping", priceKey: "renovation-basic-landscaping" },
  { id: "full-landscaping", label: "Add Full Landscaping", priceKey: "renovation-full-landscaping" },
  { id: "season-change-landscaping", label: "Season Change with Full Landscaping", priceKey: "renovation-season-change-landscaping" },
  { id: "ext-staging", label: "Virtual Staging Residential or Commercial", priceKey: "renovation-exterior-staging" },
  { id: "ext-item-removal", label: "Item Removal & Virtual Cleaning", priceKey: "renovation-item-removal-cleaning" },
  { id: "ext-add-fixtures", label: "Add Fixtures", priceKey: "renovation-add-fixtures" },
  { id: "replace-driveway", label: "Replace Driveway", priceKey: "renovation-replace-driveway" },
  { id: "replace-roof", label: "Replace Roof", priceKey: "renovation-replace-roof" },
  { id: "replace-exterior-walls", label: "Replace Exterior Walls", priceKey: "renovation-replace-exterior-walls" },
  { id: "add-patio-balcony", label: "Add or Complete Patio, Balcony, Pergola, Veranda and/or Decking", priceKey: "renovation-add-patio-balcony" },
  { id: "color-change-exterior", label: "Color Change Exterior Features", priceKey: "renovation-colour-change-exterior" },
];

export const RENOVATION_ROOM_OPTIONS = [
  "Kitchen",
  "Bathroom",
  "Living Room",
  "Bedroom",
  "Dining Room",
  "Exterior",
  "Pool Area",
  "Garden",
  "Outdoor / Patio",
  "Other",
] as const;

export const RENOVATION_STYLE_OPTIONS = [
  "Modern",
  "Urban / Industrial",
  "Scandinavian",
  "Mid-Century Modern",
  "Farmhouse",
  "Hamptons",
  "Contemporary",
  "Traditional",
  "Commercial",
  "Match Reference",
  "Let Us Decide",
] as const;

// --- Floor Plans ---

export interface FloorPlanType {
  id: string;
  label: string;
  priceKey: import("@/lib/pricing/types").PriceKey;
  has3d: boolean;
}

export const FLOOR_PLAN_TYPES: FloorPlanType[] = [
  { id: "2d-bw", label: "2D Floor Plan - Black & White", priceKey: "floor-plan-2d-bw", has3d: false },
  { id: "2d-colour", label: "2D Floor Plan - Full Colour", priceKey: "floor-plan-2d-colour", has3d: false },
  { id: "3d", label: "3D Floor Plan", priceKey: "floor-plan-3d", has3d: true },
  { id: "2d-3d-bundle", label: "2D + 3D Bundle", priceKey: "floor-plan-2d-3d-bundle", has3d: true },
];

export const FLOOR_PLAN_3D_STYLES = [
  "Modern",
  "Urban / Industrial",
  "Scandinavian",
  "Mid-Century Modern",
  "Hamptons",
  "Contemporary",
  "Traditional",
  "Let Us Decide",
] as const;

export const FLOOR_PLAN_3D_VIEWS = [
  "Angle View",
  "Bird's Eye View",
  "Let Us Decide",
] as const;

export const FLOOR_PLAN_ORIENTATIONS = [
  "Landscape",
  "Portrait",
  "Let Us Decide",
] as const;

export const FLOOR_PLAN_FLOORING_OPTIONS = [
  "Wood / Timber",
  "Light Wood",
  "Dark Wood",
  "Grey Tiles",
  "Beige Tiles",
  "White Tiles",
  "Concrete",
  "Carpet",
  "Marble",
  "Match Reference",
  "Other - describe in notes",
  "Let Us Decide",
] as const;

export const FLOOR_PLAN_ROOMS = [
  "Living Room",
  "Kitchen",
  "Dining",
  "Bedrooms",
  "Bathrooms",
  "Hallways",
  "Outdoor / Patio",
  "Garage",
  "Other Rooms",
] as const;

export const FLOOR_PLAN_DISCLAIMER_OPTIONS = [
  "Do not show disclaimer",
  "Show standard disclaimer",
  "Custom disclaimer text",
] as const;

// --- Photo Editing ---

export interface PhotoEditOption {
  id: string;
  label: string;
  priceKey: import("@/lib/pricing/types").PriceKey;
}

export const PHOTO_EDIT_OPTIONS: PhotoEditOption[] = [
  { id: "image-enhancement-re", label: "Image Enhancement - Real Estate", priceKey: "image-enhancement" },
  { id: "item-removal-cleaning-pe", label: "Item Removal & Virtual Cleaning", priceKey: "item-removal-virtual-cleaning" },
  { id: "shadow-removal", label: "Shadow Removal", priceKey: "shadow-removal" },
  { id: "background-removal", label: "Background Removal", priceKey: "background-removal" },
  { id: "background-change", label: "Background Change", priceKey: "background-change" },
  { id: "colour-change-pe", label: "Colour Change", priceKey: "colour-change" },
  { id: "turn-on-lights-pe", label: "Turn On Lights", priceKey: "turn-on-lights" },
  { id: "day-to-dusk-pe", label: "Day to Dusk", priceKey: "day-to-dusk" },
  { id: "water-effect", label: "Water Effect for Empty Pools & Jacuzzi", priceKey: "water-effect" },
];

// --- Shared file accept types ---

export const STAGING_FILE_ACCEPT: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

export const FLOOR_PLAN_FILE_ACCEPT: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "application/pdf": [".pdf"],
  "application/dxf": [".dxf"],
  "application/dwg": [".dwg"],
  "application/octet-stream": [".fbx", ".dxf", ".dwg"],
};

export const PHOTO_EDIT_FILE_ACCEPT: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "application/pdf": [".pdf"],
};

// --- Order-level delivery preferences (apply to the whole order, not per-item) ---

/**
 * File size limit options for delivered images. This is a delivery
 * preference for MLS / online listing systems that cap upload sizes — it
 * is NOT a paid add-on. Storing the literal string keeps the choice
 * human-readable in the order details JSON.
 */
export const FILE_SIZE_LIMIT_OPTIONS = [
  "10 MB & Under",
  "5 MB & Under",
  "Same size as original (may vary slightly)",
] as const;

export type FileSizeLimit = (typeof FILE_SIZE_LIMIT_OPTIONS)[number];
