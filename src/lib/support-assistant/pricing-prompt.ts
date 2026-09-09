import {
  FLOOR_PLAN_PRICE_KEYS,
  PHOTO_EDIT_PRICE_KEYS,
  RENOVATION_EXTERNAL_PRICE_KEYS,
  RENOVATION_INTERNAL_PRICE_KEYS,
  STAGING_ADDON_PRICE_KEYS,
  getCatalogPrice,
} from "../pricing/catalog.ts";
import { STANDARD_VOLUME_DISCOUNT_EXCLUDED_PRICE_KEYS } from "../pricing/discounts.ts";
import { calculateOrderQuote } from "../pricing/calculate.ts";
import type {
  PriceKey,
  TransactionalCurrency,
} from "../pricing/types.ts";

const SUPPORT_CURRENCIES: readonly TransactionalCurrency[] = [
  "USD",
  "EUR",
  "CAD",
];

const SUPPORT_CURRENCY_PREFIX: Record<TransactionalCurrency, string> = {
  USD: "US$",
  EUR: "€",
  CAD: "CA$",
};

interface SupportPriceRow {
  label: string;
  priceKey: PriceKey;
  unit: "per image" | "per floor";
}

function formatSupportAmount(
  cents: number,
  currency: TransactionalCurrency,
): string {
  return `${SUPPORT_CURRENCY_PREFIX[currency]}${(cents / 100).toFixed(2)}`;
}

function formatSupportCatalogAmount(
  priceKey: PriceKey,
  currency: TransactionalCurrency,
): string {
  return formatSupportAmount(getCatalogPrice(priceKey, currency), currency);
}

function formatSupportPriceTriplet(
  priceKey: PriceKey,
  unit: SupportPriceRow["unit"],
  addOn = false,
): string {
  const prefix = addOn ? "+" : "";
  return `${SUPPORT_CURRENCIES.map(
    (currency) => `${prefix}${formatSupportCatalogAmount(priceKey, currency)}`,
  ).join(" / ")} ${unit}`;
}

function formatSupportPriceRows(
  rows: readonly SupportPriceRow[],
  addOn = false,
): string {
  return rows
    .map(
      (row) =>
        `${row.label}:\n${formatSupportPriceTriplet(
          row.priceKey,
          row.unit,
          addOn,
        )}`,
    )
    .join("\n\n");
}

const GENERAL_IMAGE_EDITING_ROWS: readonly SupportPriceRow[] = [
  {
    label: "Image Enhancement",
    priceKey: "image-enhancement",
    unit: "per image",
  },
  { label: "Day to Dusk", priceKey: "day-to-dusk", unit: "per image" },
  {
    label: "Item Removal & Virtual Cleaning",
    priceKey: "item-removal-virtual-cleaning",
    unit: "per image",
  },
  { label: "Shadow Removal", priceKey: "shadow-removal", unit: "per image" },
  {
    label: "Background Removal",
    priceKey: "background-removal",
    unit: "per image",
  },
  {
    label: "Background Change",
    priceKey: "background-change",
    unit: "per image",
  },
  { label: "Colour Change", priceKey: "colour-change", unit: "per image" },
  {
    label: "Turn On Lights",
    priceKey: "turn-on-lights",
    unit: "per image",
  },
  {
    label: "Water Effect for Empty Pools and Jacuzzi",
    priceKey: "water-effect",
    unit: "per image",
  },
];

const AERIAL_EDITING_ROWS: readonly SupportPriceRow[] = [
  {
    label: "Colour Fade",
    priceKey: PHOTO_EDIT_PRICE_KEYS["aerial-colour-fade-pe"],
    unit: "per image",
  },
  {
    label: "Drop Pin",
    priceKey: PHOTO_EDIT_PRICE_KEYS["aerial-drop-pin-pe"],
    unit: "per image",
  },
  {
    label: "Single Lot Highlight",
    priceKey: PHOTO_EDIT_PRICE_KEYS["aerial-single-lot-highlight-pe"],
    unit: "per image",
  },
  {
    label: "Multiple Lot Highlight",
    priceKey: PHOTO_EDIT_PRICE_KEYS["aerial-multiple-lot-highlight-pe"],
    unit: "per image",
  },
  {
    label: "Full Markup",
    priceKey: PHOTO_EDIT_PRICE_KEYS["aerial-full-markup-pe"],
    unit: "per image",
  },
];

const STAGING_ADDON_ROWS: readonly SupportPriceRow[] = [
  {
    label: "Image Enhancement",
    priceKey: STAGING_ADDON_PRICE_KEYS["image-enhancement"],
    unit: "per image",
  },
  {
    label: "Day to Dusk",
    priceKey: STAGING_ADDON_PRICE_KEYS["day-to-dusk"],
    unit: "per image",
  },
  {
    label: "Item Removal & Virtual Cleaning",
    priceKey: STAGING_ADDON_PRICE_KEYS["item-removal"],
    unit: "per image",
  },
  {
    label: "Shadow Removal",
    priceKey: STAGING_ADDON_PRICE_KEYS["shadow-removal"],
    unit: "per image",
  },
  {
    label: "Turn On Lights",
    priceKey: STAGING_ADDON_PRICE_KEYS["turn-on-lights"],
    unit: "per image",
  },
  {
    label: "Colour Change",
    priceKey: STAGING_ADDON_PRICE_KEYS["colour-change"],
    unit: "per image",
  },
];

const SUPPORT_360_LABELS: Record<
  (typeof STANDARD_VOLUME_DISCOUNT_EXCLUDED_PRICE_KEYS)[number],
  string
> = {
  "360-image-enhancement": "360° Image Enhancement",
  "360-virtual-staging": "360° Virtual Staging",
};

const SUPPORT_360_ROWS: readonly SupportPriceRow[] =
  STANDARD_VOLUME_DISCOUNT_EXCLUDED_PRICE_KEYS.map((priceKey) => ({
    label: SUPPORT_360_LABELS[priceKey],
    priceKey,
    unit: "per image",
  }));

const FLOOR_PLAN_ROWS: readonly SupportPriceRow[] = [
  {
    label: "2D Floor Plan — Black & White",
    priceKey: FLOOR_PLAN_PRICE_KEYS["2d-bw"],
    unit: "per floor",
  },
  {
    label: "2D Floor Plan — Full Colour",
    priceKey: FLOOR_PLAN_PRICE_KEYS["2d-colour"],
    unit: "per floor",
  },
  {
    label: "3D Floor Plan",
    priceKey: FLOOR_PLAN_PRICE_KEYS["3d"],
    unit: "per floor",
  },
  {
    label: "2D + 3D Bundle",
    priceKey: FLOOR_PLAN_PRICE_KEYS["2d-3d-bundle"],
    unit: "per floor",
  },
];

const RENOVATION_INTERNAL_ROWS: readonly SupportPriceRow[] = [
  {
    label: "Replace Flooring",
    priceKey: RENOVATION_INTERNAL_PRICE_KEYS["replace-flooring"],
    unit: "per image",
  },
  {
    label: "Replace Walls",
    priceKey: RENOVATION_INTERNAL_PRICE_KEYS["replace-walls"],
    unit: "per image",
  },
  {
    label: "Replace Ceiling",
    priceKey: RENOVATION_INTERNAL_PRICE_KEYS["replace-ceiling"],
    unit: "per image",
  },
  {
    label: "Item Removal & Virtual Cleaning",
    priceKey: RENOVATION_INTERNAL_PRICE_KEYS["item-removal-cleaning"],
    unit: "per image",
  },
  {
    label: "Add or Remove Walls",
    priceKey: RENOVATION_INTERNAL_PRICE_KEYS["add-remove-walls"],
    unit: "per image",
  },
  {
    label: "Add or Complete Kitchen Fit Out",
    priceKey: RENOVATION_INTERNAL_PRICE_KEYS["kitchen-fit-out"],
    unit: "per image",
  },
  {
    label: "Add or Complete Bathroom Fit Out",
    priceKey: RENOVATION_INTERNAL_PRICE_KEYS["bathroom-fit-out"],
    unit: "per image",
  },
  {
    label: "Add Fixtures",
    priceKey: RENOVATION_INTERNAL_PRICE_KEYS["add-fixtures"],
    unit: "per image",
  },
  {
    label: "Virtual Staging — Residential",
    priceKey: RENOVATION_INTERNAL_PRICE_KEYS["staging-residential"],
    unit: "per image",
  },
  {
    label: "Virtual Staging — Commercial Office",
    priceKey: RENOVATION_INTERNAL_PRICE_KEYS["staging-commercial-office"],
    unit: "per image",
  },
  {
    label: "Virtual Staging — Commercial Non-office",
    priceKey:
      RENOVATION_INTERNAL_PRICE_KEYS["staging-commercial-non-office"],
    unit: "per image",
  },
  {
    label: "Colour Change of Walls, Ceiling or Doors",
    priceKey: RENOVATION_INTERNAL_PRICE_KEYS["color-change-interior"],
    unit: "per image",
  },
];

const RENOVATION_EXTERNAL_ROWS: readonly SupportPriceRow[] = [
  {
    label: "Add Pool Only",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["add-pool"],
    unit: "per image",
  },
  {
    label: "Add Pool Surrounds",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["add-pool-surrounds"],
    unit: "per image",
  },
  {
    label: "Remove Pool Cover",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["remove-pool-cover"],
    unit: "per image",
  },
  {
    label: "Add Leaves",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["add-leaves"],
    unit: "per image",
  },
  {
    label: "Add Basic Landscaping",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["basic-landscaping"],
    unit: "per image",
  },
  {
    label: "Add Full Landscaping",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["full-landscaping"],
    unit: "per image",
  },
  {
    label: "Season Change with Full Landscaping",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["season-change-landscaping"],
    unit: "per image",
  },
  {
    label: "Virtual Staging — Residential or Commercial",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["ext-staging"],
    unit: "per image",
  },
  {
    label: "Item Removal & Virtual Cleaning",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["ext-item-removal"],
    unit: "per image",
  },
  {
    label: "Add Fixtures",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["ext-add-fixtures"],
    unit: "per image",
  },
  {
    label: "Replace Driveway",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["replace-driveway"],
    unit: "per image",
  },
  {
    label: "Replace Roof",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["replace-roof"],
    unit: "per image",
  },
  {
    label: "Replace Exterior Walls",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["replace-exterior-walls"],
    unit: "per image",
  },
  {
    label: "Add or Complete Patio, Balcony, Pergola, Veranda or Decking",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["add-patio-balcony"],
    unit: "per image",
  },
  {
    label: "Colour Change Exterior Features",
    priceKey: RENOVATION_EXTERNAL_PRICE_KEYS["color-change-exterior"],
    unit: "per image",
  },
];

export const REMOTE_SUPPORT_PRICING_SECTION = `## General Image Editing

${formatSupportPriceRows(GENERAL_IMAGE_EDITING_ROWS)}

## Aerial Editing

${formatSupportPriceRows(AERIAL_EDITING_ROWS)}

## Virtual Staging

Base Virtual Staging:
${formatSupportPriceTriplet("virtual-staging", "per image")}

Optional add-ons:

${formatSupportPriceRows(STAGING_ADDON_ROWS, true)}

## 360-Degree Services

${formatSupportPriceRows(SUPPORT_360_ROWS)}

The dedicated online order flow for 360-degree services may not yet be
available.

When no online route is available:

* provide the confirmed catalog price
* direct the customer to the contact page or human support
* do not claim that the request has been submitted

## Floor Plans — Price per Floor

${formatSupportPriceRows(FLOOR_PLAN_ROWS)}

A 2D + 3D Bundle for one floor counts as one floor for discount purposes, not
two separate units.

## Virtual Renovation — Internal

${formatSupportPriceRows(RENOVATION_INTERNAL_ROWS)}

## Virtual Renovation — External

${formatSupportPriceRows(RENOVATION_EXTERNAL_ROWS)}`;

export const SUPPORT_MONEY_FORMATTING_EXAMPLES = SUPPORT_CURRENCIES.map(
  (currency) =>
    `* ${currency}: ${formatSupportCatalogAmount("virtual-staging", currency)}`,
).join("\n");

const stagingEur = getCatalogPrice("virtual-staging", "EUR");
const enhancementEur = getCatalogPrice("image-enhancement", "EUR");

const stagingSummary = calculateOrderQuote({
  serviceType: "virtual-staging", currency: "EUR",
  items: Array.from({ length: 8 }, () => ({ selectedAddons: [] })),
});

export const SUPPORT_STAGING_SUMMARY_EXAMPLE = `Quantity: 8 images
Unit price: ${formatSupportAmount(stagingEur, "EUR")} per image
Base subtotal: ${formatSupportAmount(stagingSummary.baseSubtotalCents, "EUR")}
Volume discount (${stagingSummary.volumeDiscountPercent}%): −${formatSupportAmount(stagingSummary.volumeDiscountCents, "EUR")}
Estimated total: ${formatSupportAmount(stagingSummary.totalCents!, "EUR")}`;

export const SUPPORT_STAGING_ENHANCEMENT_EUR_EXAMPLE = `* Base Virtual Staging: ${formatSupportAmount(stagingEur, "EUR")} per image
* Image Enhancement add-on: ${formatSupportAmount(enhancementEur, "EUR")} per image
* Combined catalog price before any applicable volume discount: ${formatSupportAmount(
  stagingEur + enhancementEur,
  "EUR",
)} per image`;

const panoramaQuantity = 6;
const panoramaEur = getCatalogPrice("360-virtual-staging", "EUR");

export const SUPPORT_360_NO_DISCOUNT_EXAMPLE = `For ${panoramaQuantity} panoramic images using 360° Virtual Staging in EUR:

* Quantity: ${panoramaQuantity} images
* Unit price: ${formatSupportAmount(panoramaEur, "EUR")} per image
* Volume discount: not applicable
* Estimated total: ${formatSupportAmount(
  panoramaQuantity * panoramaEur,
  "EUR",
)}`;

const flooringQuantity = 20;
const flooringUsd = getCatalogPrice("renovation-replace-flooring", "USD");

export const SUPPORT_RENOVATION_FLOORING_USD_EXAMPLE = `For Replace Flooring on ${flooringQuantity} images in USD:

* Quantity: ${flooringQuantity} images
* Unit price: ${formatSupportAmount(flooringUsd, "USD")} per image
* Preliminary base estimate: ${formatSupportAmount(
  flooringQuantity * flooringUsd,
  "USD",
)}`;

const itemRemovalQuantity = 6;
const itemRemovalUsd = getCatalogPrice(
  "item-removal-virtual-cleaning",
  "USD",
);

export const SUPPORT_ITEM_REMOVAL_PRESENTATION_EXAMPLE = `* Quantity: ${itemRemovalQuantity} images
* Unit price: ${formatSupportAmount(itemRemovalUsd, "USD")} per image
* Subtotal: ${formatSupportAmount(
  itemRemovalQuantity * itemRemovalUsd,
  "USD",
)}`;

export const SUPPORT_CURRENT_PRICE_CONFLICT_EXAMPLE = `“The current PicchuSpot price for this service is ${formatSupportCatalogAmount(
  "virtual-staging",
  "USD",
)} per image. You may have seen an older price on another page.”`;
