import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_PRICE_CATALOG,
  formatLocalPricingRow,
  getLocalPricingPresentation,
} from "./local-catalog.ts";

test("local catalog contains the approved Alicante and Costa Blanca prices", () => {
  assert.deepEqual(
    LOCAL_PRICE_CATALOG.photography.packages.map((item) => item.priceCents),
    [9_900, 12_900, 16_900, 21_900],
  );
  assert.equal(LOCAL_PRICE_CATALOG.photography.extraUnit.priceCents, 500);
  assert.deepEqual(
    LOCAL_PRICE_CATALOG["360-tours"].packages.map(
      (item) => item.priceCents,
    ),
    [12_900, 16_900],
  );
  assert.deepEqual(
    LOCAL_PRICE_CATALOG["video-tours"].packages.map(
      (item) => item.priceCents,
    ),
    [10_000, 29_900],
  );
  assert.equal(LOCAL_PRICE_CATALOG["drone-photography"].kind, "quote-only");
  assert.equal(
    LOCAL_PRICE_CATALOG["floor-plan-2d"].packages[0].priceCents,
    3_900,
  );
});

test("overview and detailed labels apply From only where approved", () => {
  const photography = getLocalPricingPresentation("photography", "en");
  assert.equal(photography.overviewPriceLabel, "From €99");
  assert.deepEqual(photography.rows.map(formatLocalPricingRow), [
    "Start — €99 / up to 15 edited photos",
    "Standard — €129 / up to 25 edited photos",
    "Villa — €169 / up to 40 edited photos",
    "Large / Villa — €219 / up to 60 edited photos",
    "€5 / extra edited photo",
  ]);

  assert.deepEqual(
    getLocalPricingPresentation("360-tours", "en").rows.map(
      formatLocalPricingRow,
    ),
    [
      "From €129 / small apartment",
      "From €169 / medium / large property",
    ],
  );
  assert.deepEqual(
    getLocalPricingPresentation("video-tours", "en").rows.map(
      formatLocalPricingRow,
    ),
    [
      "From €100 / 45–60 sec walkthrough",
      "From €299 / 60–90 sec video + vertical Reel",
    ],
  );
});

test("Spanish presentation reuses the same numeric catalog", () => {
  assert.deepEqual(
    getLocalPricingPresentation("photography", "es").rows.map(
      formatLocalPricingRow,
    ),
    [
      "Inicial — 99 € / hasta 15 fotos editadas",
      "Estándar — 129 € / hasta 25 fotos editadas",
      "Villa — 169 € / hasta 40 fotos editadas",
      "Grande / Villa — 219 € / hasta 60 fotos editadas",
      "5 € / foto editada adicional",
    ],
  );
  assert.equal(
    getLocalPricingPresentation("drone-photography", "es")
      .overviewPriceLabel,
    "Presupuesto bajo petición",
  );
});
