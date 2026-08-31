import assert from "node:assert/strict";
import test from "node:test";
import { getVisibleDashboardWelcomeOfferBenefits } from "./dashboard-welcome-offer.ts";
import {
  WELCOME_OFFER_BENEFIT_KEYS,
  WELCOME_OFFER_BENEFIT_RULES,
} from "./welcome-offer.ts";

const ALL_AVAILABLE = {
  imageEnhancementAvailable: true,
  dayToDuskAvailable: true,
  virtualStagingAvailable: true,
};

test("dashboard Welcome Offer presentation preserves the authoritative benefit keys and routes", () => {
  assert.deepEqual(WELCOME_OFFER_BENEFIT_KEYS, [
    "image-enhancement-free",
    "day-to-dusk-free",
    "virtual-staging-first-image-50",
  ]);
  assert.equal(WELCOME_OFFER_BENEFIT_RULES["image-enhancement-free"].discountPercent, 100);
  assert.equal(WELCOME_OFFER_BENEFIT_RULES["day-to-dusk-free"].discountPercent, 100);
  assert.equal(WELCOME_OFFER_BENEFIT_RULES["virtual-staging-first-image-50"].discountPercent, 50);

  assert.deepEqual(
    getVisibleDashboardWelcomeOfferBenefits(ALL_AVAILABLE).map(
      ({ key, href }) => [key, href],
    ),
    [
      [
        "image-enhancement-free",
        "/dashboard/orders/new/image-enhancement/single-exposure",
      ],
      ["day-to-dusk-free", "/dashboard/orders/new/day-to-dusk"],
      [
        "virtual-staging-first-image-50",
        "/dashboard/orders/new/virtual-staging",
      ],
    ],
  );
});

test("dashboard Welcome Offer presentation hides redeemed benefits independently and fails closed", () => {
  assert.deepEqual(
    getVisibleDashboardWelcomeOfferBenefits({
      imageEnhancementAvailable: false,
      dayToDuskAvailable: true,
      virtualStagingAvailable: false,
    }).map(({ key }) => key),
    ["day-to-dusk-free"],
  );
  assert.deepEqual(
    getVisibleDashboardWelcomeOfferBenefits({
      imageEnhancementAvailable: false,
      dayToDuskAvailable: false,
      virtualStagingAvailable: false,
    }),
    [],
  );
  assert.deepEqual(getVisibleDashboardWelcomeOfferBenefits(null), []);
});
