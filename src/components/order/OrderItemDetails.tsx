import type React from "react";
import { ExternalLink } from "lucide-react";

interface Props {
  details: Record<string, unknown>;
  variant?: "default" | "specification";
}

const KEY_LABELS: Record<string, string> = {
  room_name: "Room",
  room: "Room",
  furniture_style: "Furniture style",
  presentation_style: "Presentation style",
  reference_link: "Reference link",
  additional_info: "Additional notes",
  addon_labels: "Add-ons",
  option_labels: "Selected options",
  internal_labels: "Internal changes",
  external_labels: "External changes",
  plan_type_label: "Plan type",
  number_of_floors: "Number of floors",
  style_3d: "3D style",
  plan_view_3d: "3D view",
  page_orientation: "Page orientation",
  plan_orientation: "Plan orientation",
  show_address: "Show address",
  street_address: "Address",
  show_title: "Show title",
  project_title: "Project title",
  disclaimer_option: "Disclaimer",
  custom_disclaimer: "Custom disclaimer",
  flooring_by_room: "Flooring by room",
  // Image Enhancement — Single Exposure preferences
  grass_repair: "Grass repair",
  sky_replacement: "Sky replacement",
  tv_screen_replacement: "TV screen replacement",
  add_fire_to_fireplace: "Add fire to fireplace",
  day_sky_style_label: "Day sky style",
  aerial_editing_label: "Aerial editing",
  aerial_editing_instructions: "Aerial editing instructions",
  // Day to Dusk preferences
  dusk_style_label: "Dusk style",
  turn_on_interior_lights: "Interior lights",
  turn_on_exterior_lights: "Exterior lights",
  add_pool_lights: "Pool lights",
  // Item Removal & Virtual Cleaning
  removal_task_labels: "Work requested",
};

const SKIP_KEYS = new Set([
  "selected_addons",
  "selected_options",
  "selected_internal",
  "selected_external",
  "plan_type",
  // Raw machine values / labels already shown as the order's service title
  "sub_service",
  "sub_service_label",
  "day_sky_style",
  "aerial_editing",
  "dusk_style",
  // Raw machine task ids (readable labels shown via removal_task_labels)
  "removal_tasks",
]);

// Specification is the customer-facing presentation used on a job detail.
// The default variant remains available to the admin interface, where a more
// complete data view is intentional.
const CLIENT_VISIBLE_KEYS = new Set(Object.keys(KEY_LABELS));

const BOOLEAN_KEYS = new Set([
  "grass_repair",
  "sky_replacement",
  "tv_screen_replacement",
  "add_fire_to_fireplace",
  "turn_on_interior_lights",
  "turn_on_exterior_lights",
  "add_pool_lights",
  "show_address",
  "show_title",
]);

function getVisibleEntries(
  details: Record<string, unknown>,
  variant: "default" | "specification",
) {
  return Object.entries(details).filter(
    ([key, value]) =>
      !SKIP_KEYS.has(key) &&
      (variant !== "specification" || CLIENT_VISIBLE_KEYS.has(key)) &&
      value !== null &&
      value !== undefined &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0),
  );
}

export function hasClientVisibleOrderItemDetails(
  details: Record<string, unknown>,
): boolean {
  return getVisibleEntries(details, "specification").length > 0;
}

export default function OrderItemDetails({ details, variant = "default" }: Props) {
  const entries = getVisibleEntries(details, variant);

  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-muted italic [[data-dashboard-scroll-container]_&]:text-dashboard-body">
        No additional details available for this item.
      </p>
    );
  }

  if (variant === "specification") {
    return (
      <dl className="divide-y divide-border">
        {entries.map(([key, value]) => (
          <div key={key} className="min-w-0 py-2.5 first:pt-0 last:pb-0">
            <dt className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted [[data-dashboard-scroll-container]_&]:text-dashboard-metadata [[data-dashboard-scroll-container]_&]:tracking-[0.08em]">
              {KEY_LABELS[key] ?? toTitleLabel(key)}
            </dt>
            <dd>{renderValue(value, key, true)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="min-w-0">
          <dt className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light [[data-dashboard-scroll-container]_&]:text-dashboard-metadata [[data-dashboard-scroll-container]_&]:tracking-[0.08em]">
            {KEY_LABELS[key] ?? toTitleLabel(key)}
          </dt>
          <dd>{renderValue(value, key)}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderValue(
  value: unknown,
  key: string,
  customerFacing = false,
): React.ReactNode {
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((item, index) => (
          <span
            key={index}
            className="inline-flex items-center px-2 py-0.5 bg-primary/8 border border-primary/15 rounded-full text-[11px] font-semibold text-primary [[data-dashboard-scroll-container]_&]:text-dashboard-metadata"
          >
            {customerFacing ? humanizeValue(String(item)) : String(item)}
          </span>
        ))}
      </div>
    );
  }

  if (typeof value === "object" && value !== null) {
    return (
      <ul className="space-y-0.5">
        {Object.entries(value as Record<string, unknown>).map(([label, nested]) => (
          <li
            key={label}
            className={
              customerFacing
                ? "text-[13px] leading-relaxed text-foreground/80"
                : "text-[12px] text-foreground/75 [[data-dashboard-scroll-container]_&]:text-dashboard-metadata"
            }
          >
            <span className="font-semibold">
              {customerFacing ? toTitleLabel(label) : label}:
            </span>{" "}
            {customerFacing ? humanizeValue(String(nested)) : String(nested)}
          </li>
        ))}
      </ul>
    );
  }

  if (
    typeof value === "string" &&
    (value.startsWith("http://") || value.startsWith("https://"))
  ) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:text-primary-light transition-colors text-[12px] font-semibold truncate max-w-[240px] [[data-dashboard-scroll-container]_&]:text-dashboard-action [[data-dashboard-scroll-container]_&]:overflow-visible [[data-dashboard-scroll-container]_&]:text-clip [[data-dashboard-scroll-container]_&]:whitespace-normal [[data-dashboard-scroll-container]_&]:max-w-none"
      >
        <ExternalLink className="w-3 h-3 flex-shrink-0" aria-hidden />
        View reference
      </a>
    );
  }

  if (typeof value === "boolean") {
    return (
      <span
        className={
          customerFacing
            ? "text-[14px] leading-relaxed text-foreground/85"
            : "text-[13px] text-foreground/80"
        }
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }

  if (customerFacing && BOOLEAN_KEYS.has(key) && (value === 0 || value === 1)) {
    return <span className="text-[14px] leading-relaxed text-foreground/85">{value === 1 ? "Yes" : "No"}</span>;
  }

  return (
    <span
      className={
        customerFacing
          ? "text-[14px] leading-relaxed text-foreground/85"
          : "text-[13px] text-foreground/80"
      }
    >
      {customerFacing ? humanizeValue(String(value)) : String(value)}
    </span>
  );
}

function toTitleLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizeValue(value: string): string {
  if (!/^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i.test(value)) return value;
  return toTitleLabel(value.replace(/-/g, " "));
}
