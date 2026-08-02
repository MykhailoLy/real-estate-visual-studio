import type { PropertyShowcaseAdminRecord } from "./admin-types";

export interface PropertySelectionResult {
  selected: PropertyShowcaseAdminRecord | null;
  requestedId: string;
  missingRequestedProperty: boolean;
}

type PropertyCardLinkAction = {
  kind: "open" | "preview" | "media";
  label: string;
  href: string;
};

type PropertyCardButtonAction = {
  kind: "edit" | "delete";
  label: string;
};

export type PropertyCardActions = readonly [
  PropertyCardLinkAction,
  PropertyCardButtonAction,
  PropertyCardLinkAction,
  PropertyCardButtonAction,
];

export function propertyMediaHref(id: string): string {
  return `/admin/properties/media?property=${encodeURIComponent(id)}`;
}

export function propertyPreviewHref(id: string): string {
  return `/admin/properties/${encodeURIComponent(id)}/preview`;
}

export function propertyCardActions(
  record: PropertyShowcaseAdminRecord,
): PropertyCardActions {
  return [
    record.published
      ? {
          kind: "open",
          label: "Open",
          href: `/property/${record.slug}`,
        }
      : {
          kind: "preview",
          label: "Preview",
          href: propertyPreviewHref(record.id),
        },
    {
      kind: "edit",
      label: "Edit details",
    },
    {
      kind: "media",
      label: "Photos & floor plans",
      href: propertyMediaHref(record.id),
    },
    {
      kind: "delete",
      label: "Delete",
    },
  ];
}

export function resolvePropertySelection(
  records: readonly PropertyShowcaseAdminRecord[],
  selectedId: string,
  requestedId: string,
): PropertySelectionResult {
  const requested = requestedId.trim();
  const selected = selectedId.trim();

  if (requested) {
    const record = records.find((item) => item.id === requested) ?? null;
    return {
      selected: record,
      requestedId: requested,
      missingRequestedProperty: record === null,
    };
  }

  const record =
    records.find((item) => item.id === selected) ?? records[0] ?? null;

  return {
    selected: record,
    requestedId: "",
    missingRequestedProperty: false,
  };
}
