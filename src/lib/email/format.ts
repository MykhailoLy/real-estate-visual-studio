import type { ServiceType } from "@/lib/server-validation";
import type { TransactionalCurrency } from "@/lib/pricing/types";
import { formatMoney } from "@/lib/pricing/format";
import { escapeHtml } from "./escape-html";

export { escapeHtml } from "./escape-html";

// ============================================================
// EMAIL FORMATTING HELPERS
// Pure utilities used by both the client and admin email templates.
// No Resend / Supabase imports here so this file is trivially safe
// to test in isolation.
// ============================================================

const SERVICE_LABELS: Record<ServiceType, string> = {
  "virtual-staging": "Virtual Staging",
  "virtual-renovation": "Virtual Renovation",
  "3d-floor-plans": "3D Floor Plans",
  "photo-editing": "Photo Editing",
};

/** Public-facing service label, e.g. "Virtual Staging". */
export function serviceLabel(serviceType: ServiceType): string {
  return SERVICE_LABELS[serviceType];
}

/** Format a minor-unit integer in its saved transactional currency. */
export function formatCents(
  cents: number | null | undefined,
  currency: TransactionalCurrency = "USD"
): string {
  const safe = typeof cents === "number" && Number.isFinite(cents) ? cents : 0;
  return formatMoney(safe, currency);
}

/**
 * Convert a number of bytes into a short human-readable string.
 * Used in admin emails where file sizes are useful context.
 */
export function formatBytes(bytes: number | null | undefined): string {
  const safe = typeof bytes === "number" && Number.isFinite(bytes) ? bytes : 0;
  if (safe < 1024) return `${safe} B`;
  if (safe < 1024 * 1024) return `${(safe / 1024).toFixed(1)} KB`;
  return `${(safe / (1024 * 1024)).toFixed(2)} MB`;
}

/** Returns a string safe to use in `From: <PicchuSpot>` style display. */
export function joinNonEmpty(parts: Array<string | null | undefined>, sep = " · "): string {
  return parts.filter((p) => typeof p === "string" && p.trim().length > 0).join(sep);
}

/**
 * Per-item detail rendering. We accept the snake_case `details`
 * object that /api/order already builds — that object includes the
 * pre-resolved human labels (addon_labels, option_labels, etc.) so
 * we don't have to reach back into the pricing tables here.
 *
 * Returns parallel plain-text lines and HTML rows so a template can
 * use whichever it needs.
 */
export interface ItemSummaryBlock {
  /** Heading shown above the block, e.g. "Item 1 — Living Room". */
  heading: string;
  /** Plain text key:value lines, one per non-empty field. */
  textLines: string[];
  /** HTML <tr> rows ready to drop into a <table>. */
  htmlRows: string[];
}

type ItemDetails = Record<string, unknown>;

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return String(value);
}

/** Render a stored boolean preference as a "Yes" / "No" label. */
function yesNo(value: unknown): string {
  return value === true ? "Yes" : "No";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v : String(v ?? "")))
    .filter((s) => s.trim().length > 0);
}

function row(label: string, value: string): { text: string; html: string } | null {
  if (!value) return null;
  return {
    text: `${label}: ${value}`,
    html: `<tr><td style="padding:4px 12px 4px 0;color:#718096;vertical-align:top;">${escapeHtml(
      label
    )}</td><td style="padding:4px 0;color:#1a202c;">${escapeHtml(value)}</td></tr>`,
  };
}

function multilineRow(label: string, value: string): { text: string; html: string } | null {
  if (!value) return null;
  // Preserve newlines in HTML by replacing them with <br/>.
  const htmlValue = escapeHtml(value).replace(/\r?\n/g, "<br/>");
  return {
    text: `${label}: ${value}`,
    html: `<tr><td style="padding:4px 12px 4px 0;color:#718096;vertical-align:top;">${escapeHtml(
      label
    )}</td><td style="padding:4px 0;color:#1a202c;">${htmlValue}</td></tr>`,
  };
}

function pushIf(
  rows: { text: string; html: string }[],
  built: { text: string; html: string } | null
) {
  if (built) rows.push(built);
}

/**
 * Build the per-item summary block for one of the four service
 * types. The returned `textLines` are short labels for the client
 * email (we keep that email compact); the `htmlRows` are detailed
 * for the admin email (every relevant field, links, options, notes).
 */
export function buildItemSummary(
  serviceType: ServiceType,
  itemIndex: number,
  details: ItemDetails,
  subtotalCents: number,
  currency: TransactionalCurrency,
  files: {
    originalPath: string | null;
    referenceImagePath: string | null;
    originalFilename: string | null;
    referenceFilename: string | null;
    originalDownloadUrl?: string | null;
    referenceDownloadUrl?: string | null;
  }
): ItemSummaryBlock {
  const headingTitle = headingForItem(serviceType, itemIndex, details);
  const rows: { text: string; html: string }[] = [];

  pushIf(rows, row("Subtotal", formatCents(subtotalCents, currency)));

  switch (serviceType) {
    case "virtual-staging": {
      pushIf(rows, row("Room", asString(details.room_name)));
      pushIf(rows, row("Furniture style", asString(details.furniture_style)));
      pushIf(
        rows,
        row("Add-ons", asStringArray(details.addon_labels).join(", "))
      );
      pushIf(rows, row("Reference link", asString(details.reference_link)));
      pushIf(
        rows,
        multilineRow("Notes", asString(details.additional_info))
      );
      break;
    }
    case "virtual-renovation": {
      pushIf(rows, row("Room / area", asString(details.room)));
      pushIf(rows, row("Presentation style", asString(details.presentation_style)));
      pushIf(
        rows,
        row("Internal options", asStringArray(details.internal_labels).join(", "))
      );
      pushIf(
        rows,
        row("External options", asStringArray(details.external_labels).join(", "))
      );
      pushIf(rows, row("Reference link", asString(details.reference_link)));
      pushIf(
        rows,
        multilineRow("Notes", asString(details.additional_info))
      );
      break;
    }
    case "3d-floor-plans": {
      pushIf(rows, row("Plan type", asString(details.plan_type_label)));
      pushIf(rows, row("Number of floors", asString(details.number_of_floors)));
      pushIf(rows, row("Page orientation", asString(details.page_orientation)));
      pushIf(rows, row("Plan orientation", asString(details.plan_orientation)));
      const style3d = asString(details.style_3d);
      if (style3d) pushIf(rows, row("3D style", style3d));
      const view3d = asString(details.plan_view_3d);
      if (view3d) pushIf(rows, row("3D view", view3d));
      const flooring = details.flooring_by_room as Record<string, string> | undefined;
      if (flooring && Object.keys(flooring).length > 0) {
        const formatted = Object.entries(flooring)
          .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
          .map(([room, value]) => `${room}: ${value}`)
          .join(", ");
        if (formatted) pushIf(rows, row("Flooring by room", formatted));
      }
      if (details.show_address) {
        pushIf(rows, row("Address", asString(details.street_address) || "(yes)"));
      }
      if (details.show_title) {
        pushIf(rows, row("Project title", asString(details.project_title) || "(yes)"));
      }
      pushIf(rows, row("Disclaimer option", asString(details.disclaimer_option)));
      pushIf(
        rows,
        multilineRow("Custom disclaimer", asString(details.custom_disclaimer))
      );
      pushIf(rows, row("Reference link", asString(details.reference_link)));
      pushIf(
        rows,
        multilineRow("Notes", asString(details.additional_info))
      );
      break;
    }
    case "photo-editing": {
      pushIf(
        rows,
        row("Editing options", asStringArray(details.option_labels).join(", "))
      );
      // Image Enhancement — Single Exposure preferences (labels were
      // derived server-side at persistence time; rendered when present).
      pushIf(rows, row("Grass repair", asString(details.grass_repair)));
      pushIf(rows, row("Sky replacement", asString(details.sky_replacement)));
      pushIf(
        rows,
        row("TV screen replacement", asString(details.tv_screen_replacement))
      );
      pushIf(
        rows,
        row("Add fire to fireplace", asString(details.add_fire_to_fireplace))
      );
      pushIf(rows, row("Day sky style", asString(details.day_sky_style_label)));
      // Day to Dusk preferences (labels derived server-side; lighting
      // preferences are stored as real booleans). Rendered only for
      // Day to Dusk items so other photo-editing orders are unaffected.
      if (asString(details.sub_service) === "day-to-dusk") {
        pushIf(rows, row("Dusk style", asString(details.dusk_style_label)));
        pushIf(rows, row("Interior lights", yesNo(details.turn_on_interior_lights)));
        pushIf(rows, row("Exterior lights", yesNo(details.turn_on_exterior_lights)));
        pushIf(rows, row("Pool lights", yesNo(details.add_pool_lights)));
      }
      // Item Removal & Virtual Cleaning. Work types + instructions +
      // whether a markup/reference image was included. The instructions
      // are the item's additional_info, so the generic "Notes" row is
      // skipped below to avoid showing the same text twice.
      const isItemRemoval =
        asString(details.sub_service) === "item-removal-virtual-cleaning";
      if (isItemRemoval) {
        pushIf(
          rows,
          row("Work requested", asStringArray(details.removal_task_labels).join(", "))
        );
        pushIf(rows, multilineRow("Instructions", asString(details.additional_info)));
        pushIf(
          rows,
          row("Markup/reference", files.referenceImagePath ? "Included" : "None")
        );
      } else {
        pushIf(
          rows,
          multilineRow("Notes", asString(details.additional_info))
        );
      }
      break;
    }
  }

  // Per-item delivery preferences (item-level, falling back to
  // order-level, both already stored on details).
  const deliveryPrefs = details.delivery_preferences as
    | { file_size_limit?: string; disclaimer_text?: string }
    | undefined;
  if (deliveryPrefs?.file_size_limit) {
    pushIf(rows, row("Max delivery size", deliveryPrefs.file_size_limit));
  }
  if (deliveryPrefs?.disclaimer_text) {
    pushIf(rows, multilineRow("Item disclaimer", deliveryPrefs.disclaimer_text));
  }

  // File paths (admin email only — see template).
  if (files.originalPath) {
    const filenameSuffix = files.originalFilename
      ? ` (${files.originalFilename})`
      : "";
    pushIf(
      rows,
      files.originalDownloadUrl
        ? {
            text: `Original file: ${files.originalPath}${filenameSuffix} — ${files.originalDownloadUrl}`,
            html: `<tr><td style="padding:4px 12px 4px 0;color:#718096;vertical-align:top;">Original file</td><td style="padding:4px 0;color:#1a202c;"><a href="${escapeHtml(
              files.originalDownloadUrl
            )}" style="color:#2c5282;">${escapeHtml(files.originalPath)}</a>${escapeHtml(
              filenameSuffix
            )}</td></tr>`,
          }
        : row("Original file", `${files.originalPath}${filenameSuffix}`)
    );
  }
  if (files.referenceImagePath) {
    const filenameSuffix = files.referenceFilename
      ? ` (${files.referenceFilename})`
      : "";
    pushIf(
      rows,
      files.referenceDownloadUrl
        ? {
            text: `Reference image: ${files.referenceImagePath}${filenameSuffix} — ${files.referenceDownloadUrl}`,
            html: `<tr><td style="padding:4px 12px 4px 0;color:#718096;vertical-align:top;">Reference image</td><td style="padding:4px 0;color:#1a202c;"><a href="${escapeHtml(
              files.referenceDownloadUrl
            )}" style="color:#2c5282;">${escapeHtml(
              files.referenceImagePath
            )}</a>${escapeHtml(filenameSuffix)}</td></tr>`,
          }
        : row("Reference image", `${files.referenceImagePath}${filenameSuffix}`)
    );
  }

  return {
    heading: headingTitle,
    textLines: rows.map((r) => r.text),
    htmlRows: rows.map((r) => r.html),
  };
}

/**
 * Short heading for the per-item block. Picks the most-distinctive
 * label available for the service so the admin can scan items at a
 * glance ("Item 2 — Kitchen renovation" beats "Item 2").
 */
function headingForItem(
  serviceType: ServiceType,
  itemIndex: number,
  details: ItemDetails
): string {
  const base = `Item ${itemIndex + 1}`;
  switch (serviceType) {
    case "virtual-staging": {
      const room = asString(details.room_name);
      return room ? `${base} — ${room}` : base;
    }
    case "virtual-renovation": {
      const room = asString(details.room);
      return room ? `${base} — ${room}` : base;
    }
    case "3d-floor-plans": {
      const planType = asString(details.plan_type_label);
      return planType ? `${base} — ${planType}` : base;
    }
    case "photo-editing": {
      const opts = asStringArray(details.option_labels);
      const first = opts[0];
      return first ? `${base} — ${first}${opts.length > 1 ? ` (+${opts.length - 1})` : ""}` : base;
    }
  }
}
