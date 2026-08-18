import {
  SINGLE_EXPOSURE_STANDARD_ADDONS,
  getAerialEditingOption,
  getDaySkyStyleLabel,
  getThreeStateLabel,
  isDaySkyStyleActive,
} from "../../../lib/image-enhancement.ts";
import { getCatalogPrice } from "../../../lib/pricing/catalog.ts";
import { formatMoney } from "../../../lib/pricing/format.ts";
import type { TransactionalCurrency } from "../../../lib/pricing/types.ts";

export interface SingleExposureReviewItemSource {
  fileSizeLimit: string;
  disclaimerText: string;
  additionalInfo: string;
  grassRepair: unknown;
  skyReplacement: unknown;
  tvScreenReplacement: unknown;
  addFireToFireplace: unknown;
  daySkyStyle: unknown;
  selectedAddons: string[];
  aerialEditing: unknown;
  aerialEditingInstructions: string;
}

export interface SingleExposureReviewRow {
  label: string;
  value: string;
}

function textOrNone(value: string): string {
  return value.trim() || "None";
}

export function buildSingleExposureReviewRows(
  item: SingleExposureReviewItemSource,
  currency: TransactionalCurrency,
  hasAerialReference: boolean,
): SingleExposureReviewRow[] {
  const aerial = getAerialEditingOption(item.aerialEditing);
  const selectedAddOns = item.selectedAddons.flatMap((id) => {
    const addOn = SINGLE_EXPOSURE_STANDARD_ADDONS.find(
      (candidate) => candidate.id === id,
    );
    return addOn
      ? [
          `${addOn.label} (${formatMoney(
            getCatalogPrice(addOn.priceKey, currency),
            currency,
          )})`,
        ]
      : [];
  });
  const rows: SingleExposureReviewRow[] = [
    { label: "Grass Repair or Replacement", value: getThreeStateLabel(item.grassRepair) },
    { label: "Sky Replacement", value: getThreeStateLabel(item.skyReplacement) },
  ];

  if (isDaySkyStyleActive(item.skyReplacement)) {
    rows.push({
      label: "Day Sky Style",
      value: getDaySkyStyleLabel(item.daySkyStyle),
    });
  }

  rows.push(
    { label: "TV Screen Replacement", value: getThreeStateLabel(item.tvScreenReplacement) },
    { label: "Add Fire to Fireplace", value: getThreeStateLabel(item.addFireToFireplace) },
    {
      label: "Selected Add-ons",
      value: selectedAddOns.length ? selectedAddOns.join(", ") : "None",
    },
    {
      label: "Aerial Editing",
      value: aerial.priceKey
        ? `${aerial.label} (${formatMoney(
            getCatalogPrice(aerial.priceKey, currency),
            currency,
          )})`
        : aerial.label,
    },
  );

  if (aerial.id !== "none") {
    rows.push({
      label: "Aerial Editing Instructions",
      value: textOrNone(item.aerialEditingInstructions),
    });
    if (aerial.requiresDetails) {
      rows.push({
        label: "Aerial Reference Image",
        value: hasAerialReference ? "Included" : "None",
      });
    }
  }

  rows.push(
    {
      label: "File Size Limit",
      value: item.fileSizeLimit.trim() || "Not specified",
    },
    { label: "Disclaimer Text", value: textOrNone(item.disclaimerText) },
    {
      label: "Additional Instructions",
      value: textOrNone(item.additionalInfo),
    },
  );

  return rows;
}
