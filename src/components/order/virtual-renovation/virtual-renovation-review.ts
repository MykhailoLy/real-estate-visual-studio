import {
  RENOVATION_EXTERNAL_OPTIONS,
  RENOVATION_INTERNAL_OPTIONS,
} from "../../../data/order-options.ts";
import { getCatalogPrice } from "../../../lib/pricing/catalog.ts";
import { formatMoney } from "../../../lib/pricing/format.ts";
import type { TransactionalCurrency } from "../../../lib/pricing/types.ts";

export interface VirtualRenovationReviewRow {
  label: string;
  value: string;
}

export interface VirtualRenovationReviewItemSource {
  selectedInternal: string[];
  selectedExternal: string[];
  room: string;
  presentationStyle: string;
  fileSizeLimit: string;
  disclaimerText: string;
  referenceLink: string;
  additionalInfo: string;
}

function textOrNone(value: string): string {
  return value.trim() || "None";
}

function fileSizeLabel(value: string): string {
  return value.trim() || "Not specified";
}

function selectedOptionLabels(
  selectedIds: string[],
  options: typeof RENOVATION_INTERNAL_OPTIONS,
  currency: TransactionalCurrency,
): string {
  const labels = selectedIds.flatMap((id) => {
    const option = options.find((candidate) => candidate.id === id);
    if (!option) return [];
    return [
      `${option.label} (${formatMoney(
        getCatalogPrice(option.priceKey, currency),
        currency,
      )})`,
    ];
  });
  return labels.length ? labels.join(", ") : "None";
}

/** Display-only mapping of existing Renovation item state into review rows. */
export function buildVirtualRenovationReviewRows(
  item: VirtualRenovationReviewItemSource,
  currency: TransactionalCurrency,
): VirtualRenovationReviewRow[] {
  return [
    {
      label: "Internal Renovations",
      value: selectedOptionLabels(
        item.selectedInternal,
        RENOVATION_INTERNAL_OPTIONS,
        currency,
      ),
    },
    {
      label: "External Renovations",
      value: selectedOptionLabels(
        item.selectedExternal,
        RENOVATION_EXTERNAL_OPTIONS,
        currency,
      ),
    },
    { label: "Room / Area", value: textOrNone(item.room) },
    {
      label: "Presentation Style",
      value: textOrNone(item.presentationStyle),
    },
    { label: "File Size Limit", value: fileSizeLabel(item.fileSizeLimit) },
    { label: "Disclaimer Text", value: textOrNone(item.disclaimerText) },
    {
      label: "Additional Information",
      value: textOrNone(item.additionalInfo),
    },
  ];
}
