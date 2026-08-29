import assert from "node:assert/strict";
import test from "node:test";
import { getCatalogPrice } from "./catalog.ts";
import { calculateOrderQuote } from "./calculate.ts";
import type {
  OrderPricingInput,
  TransactionalCurrency,
} from "./types.ts";
import { WELCOME_OFFER_VERSION } from "../welcome-offer.ts";

const AVAILABLE = {
  imageEnhancementAvailable: true,
  dayToDuskAvailable: true,
  virtualStagingAvailable: true,
};

function dedicatedItems(
  count: number,
  subService: "image-enhancement-single-exposure" | "day-to-dusk",
  addOnId?: string,
) {
  const baseOptionId =
    subService === "image-enhancement-single-exposure"
      ? "image-enhancement-re"
      : "day-to-dusk-pe";
  return Array.from({ length: count }, () => ({
    selectedOptions: addOnId ? [baseOptionId, addOnId] : [baseOptionId],
    baseOptionId,
    dedicatedSubService: subService,
  }));
}

function stagingItems(count: number, selectedAddons: string[] = []) {
  return Array.from({ length: count }, () => ({ selectedAddons }));
}

for (const service of [
  {
    name: "Image Enhancement",
    subService: "image-enhancement-single-exposure" as const,
    priceKey: "image-enhancement" as const,
    benefitKey: "image-enhancement-free" as const,
  },
  {
    name: "Day to Dusk",
    subService: "day-to-dusk" as const,
    priceKey: "day-to-dusk" as const,
    benefitKey: "day-to-dusk-free" as const,
  },
]) {
  test(`${service.name} applies one free base and discounts only five paid bases at quantity six`, () => {
    const unit = getCatalogPrice(service.priceKey, "USD");
    const one = calculateOrderQuote(
      {
        serviceType: "photo-editing",
        currency: "USD",
        items: dedicatedItems(1, service.subService),
      },
      { welcomeOfferAvailability: AVAILABLE },
    );
    assert.equal(one.welcomeDiscountCents, unit);
    assert.equal(one.totalCents, 0);
    assert.equal(one.volumeEligibleUnits, 0);
    assert.deepEqual(one.welcomeOffer.benefits, [
      {
        key: service.benefitKey,
        itemIndex: 0,
        priceKey: service.priceKey,
        discountPercent: 100,
        discountCents: unit,
      },
    ]);

    const six = calculateOrderQuote(
      {
        serviceType: "photo-editing",
        currency: "USD",
        items: dedicatedItems(6, service.subService),
      },
      { welcomeOfferAvailability: AVAILABLE },
    );
    assert.equal(six.eligibleUnits, 6);
    assert.equal(six.volumeEligibleUnits, 5);
    assert.equal(six.volumeDiscountPercent, 5);
    assert.equal(six.volumeDiscountCents, Math.round((unit * 5 * 5) / 100));
    assert.equal(
      six.totalCents,
      unit * 6 - unit - Math.round((unit * 5 * 5) / 100),
    );

    const used = calculateOrderQuote({
      serviceType: "photo-editing",
      currency: "USD",
      items: dedicatedItems(6, service.subService),
    });
    assert.equal(used.welcomeDiscountCents, 0);
    assert.equal(used.volumeEligibleUnits, 6);
    assert.equal(used.volumeDiscountCents, Math.round((unit * 6 * 5) / 100));
  });
}

test("dedicated free benefits discount the base only and leave add-ons payable", () => {
  const quote = calculateOrderQuote(
    {
      serviceType: "photo-editing",
      currency: "CAD",
      items: dedicatedItems(
        1,
        "image-enhancement-single-exposure",
        "turn-on-lights-pe",
      ),
    },
    { welcomeOfferAvailability: AVAILABLE },
  );
  assert.equal(
    quote.welcomeDiscountCents,
    getCatalogPrice("image-enhancement", "CAD"),
  );
  assert.equal(
    quote.totalCents,
    getCatalogPrice("turn-on-lights", "CAD"),
  );
});

test("generic and mixed Photo Editing cannot receive a standalone benefit", () => {
  const inputs: OrderPricingInput[] = [
    {
      serviceType: "photo-editing",
      currency: "USD",
      items: [{ selectedOptions: ["image-enhancement-re"] }],
    },
    {
      serviceType: "photo-editing",
      currency: "USD",
      items: [
        ...dedicatedItems(1, "image-enhancement-single-exposure"),
        ...dedicatedItems(1, "day-to-dusk"),
      ],
    },
  ];
  for (const input of inputs) {
    assert.equal(
      calculateOrderQuote(input, { welcomeOfferAvailability: AVAILABLE })
        .welcomeDiscountCents,
      0,
    );
  }
});

test("Virtual Staging discounts exactly one base and tiers only paid images", () => {
  for (const [count, paidCount, percent] of [
    [1, 0, 0],
    [2, 1, 0],
    [5, 4, 0],
    [6, 5, 5],
    [10, 9, 5],
    [20, 19, 10],
  ] as const) {
    const unit = getCatalogPrice("virtual-staging", "EUR");
    const quote = calculateOrderQuote(
      {
        serviceType: "virtual-staging",
        currency: "EUR",
        items: stagingItems(count),
      },
      { welcomeOfferAvailability: AVAILABLE },
    );
    const welcome = Math.round(unit / 2);
    const volume = Math.round((unit * paidCount * percent) / 100);
    assert.equal(quote.volumeEligibleUnits, paidCount);
    assert.equal(quote.welcomeDiscountCents, welcome);
    assert.equal(quote.volumeDiscountPercent, percent);
    assert.equal(quote.volumeDiscountCents, volume);
    assert.equal(quote.totalCents, unit * count - welcome - volume);
    assert.equal(quote.welcomeOffer.benefits[0]?.itemIndex, 0);
    assert.equal(quote.welcomeOffer.benefits[0]?.discountPercent, 50);
  }
});

test("Virtual Staging add-ons stay full price and an used benefit restores standard volume pricing", () => {
  const unit = getCatalogPrice("virtual-staging", "CAD");
  const addOn = getCatalogPrice("image-enhancement", "CAD");
  const eligible = calculateOrderQuote(
    {
      serviceType: "virtual-staging",
      currency: "CAD",
      items: stagingItems(1, ["image-enhancement"]),
    },
    { welcomeOfferAvailability: AVAILABLE },
  );
  assert.equal(eligible.welcomeDiscountCents, Math.round(unit / 2));
  assert.equal(eligible.totalCents, unit - Math.round(unit / 2) + addOn);

  const used = calculateOrderQuote({
    serviceType: "virtual-staging",
    currency: "CAD",
    items: stagingItems(10),
  });
  assert.equal(used.welcomeDiscountCents, 0);
  assert.equal(used.volumeEligibleUnits, 10);
  assert.equal(used.volumeDiscountPercent, 10);
});

test("50 original eligible units remain custom quote and do not consume the offer", () => {
  const quote = calculateOrderQuote(
    {
      serviceType: "virtual-staging",
      currency: "USD",
      items: stagingItems(50),
    },
    { welcomeOfferAvailability: AVAILABLE },
  );
  assert.equal(quote.customQuote, true);
  assert.equal(quote.eligibleUnits, 50);
  assert.equal(quote.volumeEligibleUnits, 50);
  assert.equal(quote.welcomeDiscountCents, 0);
  assert.equal(quote.totalCents, null);
});

test("catalog-derived Welcome Offer works in USD, EUR, and CAD", () => {
  for (const currency of ["USD", "EUR", "CAD"] as const) {
    const quote = calculateOrderQuote(
      {
        serviceType: "virtual-staging",
        currency,
        items: stagingItems(1),
      },
      { welcomeOfferAvailability: AVAILABLE },
    );
    assert.equal(
      quote.welcomeDiscountCents,
      Math.round(getCatalogPrice("virtual-staging", currency) / 2),
    );
  }
});

test("unknown browser fields cannot choose a key, percentage, amount, or item", () => {
  const forgedInput = {
    serviceType: "virtual-staging",
    currency: "USD" as TransactionalCurrency,
    items: stagingItems(2),
    benefitKey: "image-enhancement-free",
    discountPercent: 100,
    discountCents: 999_999,
    itemIndex: 1,
  } as OrderPricingInput;
  const quote = calculateOrderQuote(forgedInput, {
    welcomeOfferAvailability: AVAILABLE,
  });
  assert.equal(quote.welcomeOffer.version, WELCOME_OFFER_VERSION);
  assert.equal(quote.welcomeOffer.benefits[0]?.key, "virtual-staging-first-image-50");
  assert.equal(quote.welcomeOffer.benefits[0]?.itemIndex, 0);
  assert.equal(
    quote.welcomeDiscountCents,
    Math.round(getCatalogPrice("virtual-staging", "USD") / 2),
  );
});
