// ============================================================
// ITEM REMOVAL & VIRTUAL CLEANING — typed configuration
//
// Single source of truth for the per-photo work-type tasks, the
// complexity notice, server-side validation, persisted detail labels
// and readable client/admin/email display.
//
// This module is PURE (no React, no server-only imports) so it can be
// shared by the client form AND the server (validation, /api/order
// details, display labels, email).
//
// SCOPE / PRICING: this module does NOT define prices. The Item Removal
// subtotal is derived from the EXISTING PHOTO_EDIT_OPTIONS option
// `item-removal-cleaning-pe` (fixed by currency in the canonical catalog). Work-type
// selection NEVER changes the subtotal, and the optional markup /
// reference image is not billed as a separate item.
// ============================================================

import { ITEM_REMOVAL_MIN_INSTRUCTIONS } from "@/lib/dedicated-photo-editing";

/** The dedicated sub-service slug for Item Removal orders. */
export const ITEM_REMOVAL_SUB_SERVICE = "item-removal-virtual-cleaning";

/** The fixed PHOTO_EDIT_OPTIONS id every Item Removal item submits. */
export const ITEM_REMOVAL_OPTION_ID = "item-removal-cleaning-pe";

/** Re-exported so client + server share one minimum-instructions rule. */
export { ITEM_REMOVAL_MIN_INSTRUCTIONS };

// -----------------------------------------------------------
// Per-photo work types (multi-select; selection never changes price).
// -----------------------------------------------------------
export type RemovalTaskId = "item-removal" | "decluttering" | "virtual-cleaning";

/** Const tuple of task ids (for zod enums and exhaustive checks). */
export const REMOVAL_TASK_ID_VALUES = [
  "item-removal",
  "decluttering",
  "virtual-cleaning",
] as const;

export interface RemovalTaskConfig {
  id: RemovalTaskId;
  label: string;
  description: string;
}

export const REMOVAL_TASKS: RemovalTaskConfig[] = [
  {
    id: "item-removal",
    label: "Item Removal",
    description:
      "Remove specific furniture, objects, vehicles, bins, signs, cables or other visible items.",
  },
  {
    id: "decluttering",
    label: "Decluttering",
    description:
      "Clear clutter from counters, floors, shelves and other visible areas while keeping the main room elements.",
  },
  {
    id: "virtual-cleaning",
    label: "Virtual Cleaning",
    description:
      "Clean minor marks, stains, small distractions and visual imperfections to make the space listing-ready.",
  },
];

export function isRemovalTaskId(value: unknown): value is RemovalTaskId {
  return (
    typeof value === "string" &&
    (REMOVAL_TASK_ID_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Server-side safe label derivation for a list of task ids. Filters to
 * KNOWN ids only (never trusts browser-supplied labels), de-duplicates,
 * and preserves the canonical REMOVAL_TASKS order.
 */
export function getRemovalTaskLabels(value: unknown): string[] {
  const ids = Array.isArray(value) ? value : [];
  const selected = new Set(ids.filter(isRemovalTaskId));
  return REMOVAL_TASKS.filter((t) => selected.has(t.id)).map((t) => t.label);
}

// -----------------------------------------------------------
// Complexity notice — shown in full on Configure and briefly on Review.
// It is informational only: it never changes the estimated $8 subtotal
// and introduces no quote / payment logic in this flow.
// -----------------------------------------------------------
export const ITEM_REMOVAL_COMPLEXITY_NOTICE =
  "Removing large objects may require reconstructing hidden areas. If advanced reconstruction or extensive room clearing is required, we may contact you to confirm a custom quote before work begins.";
