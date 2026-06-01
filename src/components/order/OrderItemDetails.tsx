import type React from "react";
import { ExternalLink } from "lucide-react";

interface Props {
  details: Record<string, unknown>;
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
};

const SKIP_KEYS = new Set([
  "selected_addons",
  "selected_options",
  "selected_internal",
  "selected_external",
  "plan_type",
]);

export default function OrderItemDetails({ details }: Props) {
  const entries = Object.entries(details).filter(
    ([key, value]) =>
      !SKIP_KEYS.has(key) &&
      value !== null &&
      value !== undefined &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0)
  );

  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-muted italic">
        No additional details available for this item.
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
      {entries.map(([key, value]) => (
        <div key={key} className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light mb-1">
            {KEY_LABELS[key] ?? toTitleLabel(key)}
          </dt>
          <dd>{renderValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderValue(value: unknown): React.ReactNode {
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((item, index) => (
          <span
            key={index}
            className="inline-flex items-center px-2 py-0.5 bg-primary/8 border border-primary/15 rounded-full text-[11px] font-semibold text-primary"
          >
            {String(item)}
          </span>
        ))}
      </div>
    );
  }

  if (typeof value === "object" && value !== null) {
    return (
      <ul className="space-y-0.5">
        {Object.entries(value as Record<string, unknown>).map(([label, nested]) => (
          <li key={label} className="text-[12px] text-foreground/75">
            <span className="font-semibold">{label}:</span> {String(nested)}
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
        className="inline-flex items-center gap-1 text-primary hover:text-primary-light transition-colors text-[12px] font-semibold truncate max-w-[240px]"
      >
        <ExternalLink className="w-3 h-3 flex-shrink-0" aria-hidden />
        View reference
      </a>
    );
  }

  if (typeof value === "boolean") {
    return <span className="text-[13px] text-foreground/80">{value ? "Yes" : "No"}</span>;
  }

  return <span className="text-[13px] text-foreground/80">{String(value)}</span>;
}

function toTitleLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
