import { STAGING_ADDONS } from "../../../data/order-options.ts";
import { getCatalogPrice } from "../../../lib/pricing/catalog.ts";
import { formatMoney } from "../../../lib/pricing/format.ts";
import type { TransactionalCurrency } from "../../../lib/pricing/types.ts";

export interface VirtualStagingReviewRow {
  label: string;
  value: string;
}

export interface VirtualStagingReviewItemSource {
  roomName: string;
  furnitureStyle: string;
  fileSizeLimit: string;
  disclaimerText: string;
  referenceLink: string;
  additionalInfo: string;
  selectedAddons: string[];
}

function textOrNone(value: string): string {
  return value.trim() || "None";
}

function fileSizeLabel(value: string): string {
  return value.trim() || "Not specified";
}

/**
 * Maps customer-entered Virtual Staging preferences into the readable review
 * rows. Prices are resolved through the existing pricing catalog so this is
 * display-only and cannot alter calculations or submission data.
 */
export function buildVirtualStagingReviewRows(
  item: VirtualStagingReviewItemSource,
  currency: TransactionalCurrency,
): VirtualStagingReviewRow[] {
  const selectedAddOns = item.selectedAddons.flatMap((id) => {
    const addOn = STAGING_ADDONS.find((candidate) => candidate.id === id);
    if (!addOn) return [];
    return [
      `${addOn.label} (${formatMoney(
        getCatalogPrice(addOn.priceKey, currency),
        currency,
      )})`,
    ];
  });

  return [
    { label: "Room Name / Area", value: textOrNone(item.roomName) },
    { label: "Furniture Style", value: textOrNone(item.furnitureStyle) },
    { label: "File Size Limit", value: fileSizeLabel(item.fileSizeLimit) },
    { label: "Disclaimer Text", value: textOrNone(item.disclaimerText) },
    { label: "Reference Link", value: textOrNone(item.referenceLink) },
    {
      label: "Additional Information",
      value: textOrNone(item.additionalInfo),
    },
    {
      label: "Selected Add-ons",
      value: selectedAddOns.length ? selectedAddOns.join(", ") : "None",
    },
  ];
}
