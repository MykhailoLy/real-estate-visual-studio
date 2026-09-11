import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PRICE_CATALOG,
  PRICING_VERSION,
  STAGING_ADDON_PRICE_KEYS,
} from "./catalog.ts";
import { formatMoney } from "./format.ts";
import { getOrderServiceCatalogEntry } from "../order-service-catalog.ts";
import { STANDARD_VOLUME_DISCOUNT_EXCLUDED_PRICE_KEYS } from "./discounts.ts";
import type { PriceKey, TransactionalCurrency } from "./types.ts";

type CurrencyPrices = Record<TransactionalCurrency, number>;

function assertPrices(
  expected: Partial<Record<PriceKey, CurrencyPrices>>,
): void {
  for (const [priceKey, prices] of Object.entries(expected)) {
    assert.deepEqual(PRICE_CATALOG[priceKey as PriceKey], prices, priceKey);
  }
}

test("transactional pricing version and general editing catalog are final", () => {
  assert.equal(PRICING_VERSION, "2026-09-09-v5");
  assertPrices({
    "image-enhancement": { USD: 120, EUR: 100, CAD: 165 },
    "day-to-dusk": { USD: 350, EUR: 300, CAD: 450 },
    "item-removal-virtual-cleaning": { USD: 500, EUR: 450, CAD: 650 },
    "shadow-removal": { USD: 500, EUR: 450, CAD: 650 },
    "background-removal": { USD: 150, EUR: 150, CAD: 200 },
    "background-change": { USD: 450, EUR: 400, CAD: 650 },
    "colour-change": { USD: 200, EUR: 150, CAD: 250 },
    "turn-on-lights": { USD: 50, EUR: 50, CAD: 100 },
    "water-effect": { USD: 450, EUR: 400, CAD: 650 },
  });
});

test("Aerial Editing keeps every approved fixed currency price", () => {
  assertPrices({
    "aerial-colour-fade": { USD: 250, EUR: 250, CAD: 350 },
    "aerial-drop-pin": { USD: 250, EUR: 250, CAD: 350 },
    "aerial-single-lot-highlight": { USD: 250, EUR: 250, CAD: 350 },
    "aerial-multiple-lot-highlight": { USD: 450, EUR: 400, CAD: 650 },
    "aerial-full-markup": { USD: 550, EUR: 500, CAD: 750 },
  });
});

test("Virtual Staging uses the approved base and shared operation add-ons", () => {
  assertPrices({
    "virtual-staging": { USD: 1900, EUR: 1600, CAD: 2600 },
  });
  assert.deepEqual(STAGING_ADDON_PRICE_KEYS, {
    "image-enhancement": "image-enhancement",
    "day-to-dusk": "day-to-dusk",
    "item-removal": "item-removal-virtual-cleaning",
    "shadow-removal": "shadow-removal",
    "turn-on-lights": "turn-on-lights",
    "colour-change": "colour-change",
  });
});

test("360 catalog prices are final and standard volume discounts stay excluded", () => {
  assertPrices({
    "360-image-enhancement": { USD: 350, EUR: 350, CAD: 500 },
    "360-virtual-staging": { USD: 3000, EUR: 2800, CAD: 4000 },
  });
  assert.deepEqual(STANDARD_VOLUME_DISCOUNT_EXCLUDED_PRICE_KEYS, [
    "360-image-enhancement",
    "360-virtual-staging",
  ]);
});

test("Floor Plan catalog prices remain unchanged", () => {
  assertPrices({
    "floor-plan-2d-bw": { USD: 1500, EUR: 1350, CAD: 2100 },
    "floor-plan-2d-colour": { USD: 2000, EUR: 1800, CAD: 2800 },
    "floor-plan-3d": { USD: 3500, EUR: 3150, CAD: 4900 },
    "floor-plan-2d-3d-bundle": { USD: 4500, EUR: 4050, CAD: 6300 },
  });
});

test("compact hero formatting trims only zero cents without changing catalog values", () => {
  assert.equal(formatMoney(1500, "USD"), "$15.00");
  assert.equal(
    formatMoney(1500, "USD", { trimWholeCents: true }),
    "$15",
  );
  assert.equal(
    formatMoney(1500, "EUR", { trimWholeCents: true }),
    "€15",
  );
  assert.equal(
    formatMoney(450, "USD", { trimWholeCents: true }),
    "$4.50",
  );
  assert.deepEqual(PRICE_CATALOG["virtual-staging"], {
    USD: 1900,
    EUR: 1600,
    CAD: 2600,
  });
});

test("Virtual Renovation operations retain their separately approved prices", () => {
  for (const priceKey of [
    "renovation-staging-residential",
    "renovation-staging-commercial-office",
    "renovation-staging-commercial-non-office",
    "renovation-exterior-staging",
  ] as const) {
    assert.deepEqual(PRICE_CATALOG[priceKey], { USD: 1500, EUR: 1400, CAD: 1900 });
  }
  assert.deepEqual(
    PRICE_CATALOG["renovation-item-removal-cleaning"],
    PRICE_CATALOG["item-removal-virtual-cleaning"],
  );
  for (const priceKey of [
    "renovation-colour-change-interior",
    "renovation-colour-change-exterior",
  ] as const) {
    assert.deepEqual(PRICE_CATALOG[priceKey], PRICE_CATALOG["colour-change"]);
  }
});

test("complex Virtual Renovation operations remain unchanged", () => {
  assertPrices({
    "renovation-replace-flooring": { USD: 1700, EUR: 1550, CAD: 2400 },
    "renovation-replace-walls": { USD: 1200, EUR: 1100, CAD: 1700 },
    "renovation-replace-ceiling": { USD: 1200, EUR: 1100, CAD: 1700 },
    "renovation-add-remove-walls": { USD: 3000, EUR: 2700, CAD: 4200 },
    "renovation-kitchen-fit-out": { USD: 4500, EUR: 4050, CAD: 6300 },
    "renovation-bathroom-fit-out": { USD: 4500, EUR: 4050, CAD: 6300 },
    "renovation-add-fixtures": { USD: 1700, EUR: 1550, CAD: 2400 },
    "renovation-add-pool": { USD: 3000, EUR: 2700, CAD: 4200 },
    "renovation-pool-surrounds": { USD: 2400, EUR: 2150, CAD: 3400 },
    "renovation-remove-pool-cover": { USD: 3000, EUR: 2700, CAD: 4200 },
    "renovation-add-leaves": { USD: 1700, EUR: 1550, CAD: 2400 },
    "renovation-basic-landscaping": { USD: 1700, EUR: 1550, CAD: 2400 },
    "renovation-full-landscaping": { USD: 4500, EUR: 4050, CAD: 6300 },
    "renovation-season-change-landscaping": {
      USD: 4500,
      EUR: 4050,
      CAD: 6300,
    },
    "renovation-replace-driveway": { USD: 1700, EUR: 1550, CAD: 2400 },
    "renovation-replace-roof": { USD: 1700, EUR: 1550, CAD: 2400 },
    "renovation-replace-exterior-walls": {
      USD: 3500,
      EUR: 3150,
      CAD: 4900,
    },
    "renovation-add-patio-balcony": { USD: 3500, EUR: 3150, CAD: 4900 },
  });
});

test("public pricing sources keep renovation option-based and structured prices canonical", () => {
  const pricingHubSource = readFileSync(
    new URL("../../app/(public)/pricing/page.tsx", import.meta.url),
    "utf8",
  );
  const remotePresentationSource = readFileSync(
    new URL("./remote-service-presentation.ts", import.meta.url),
    "utf8",
  );
  const serviceGridSource = readFileSync(
    new URL("../../components/home/ServiceGrid.tsx", import.meta.url),
    "utf8",
  );
  const renovationSource = readFileSync(
    new URL(
      "../../app/(public)/pricing/virtual-renovation/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const aerialSource = readFileSync(
    new URL(
      "../../app/(public)/pricing/aerial-editing/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(pricingHubSource, /REMOTE_SERVICE_GROUPS/);
  assert.match(remotePresentationSource, /priceKey: "aerial-colour-fade"/);
  assert.match(remotePresentationSource, /label: \{ en: "Option-based pricing"/);
  assert.match(serviceGridSource, /customPriceLabel: "Option-based pricing"/);
  assert.doesNotMatch(
    serviceGridSource,
    /id: "virtual-renovation"[\s\S]*?priceKey: "renovation-replace-walls"/,
  );
  assert.match(renovationSource, /priceLine="Option-based pricing"/);
  assert.doesNotMatch(renovationSource, /getCatalogPriceDecimal/);
  assert.match(
    aerialSource,
    /price: getCatalogPriceDecimal\("aerial-colour-fade"\)/,
  );
  assert.match(
    aerialSource,
    /orderHref="\/dashboard\/orders\/new\/photo-editing"/,
  );
  assert.deepEqual(getOrderServiceCatalogEntry("aerial-editing"), {
    slug: "aerial-editing",
    title: "Aerial Editing",
    route: "/dashboard/orders/new/photo-editing",
    publicServiceSlug: "aerial-editing",
    availability: "active",
    sortOrder: 9,
  });
});
