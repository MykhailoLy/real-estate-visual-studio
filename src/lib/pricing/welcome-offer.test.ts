import assert from "node:assert/strict";
import test from "node:test";
import { getCatalogPrice } from "./catalog.ts";
import { percentageOfCents } from "./discounts.ts";
import { calculateOrderQuote } from "./calculate.ts";
import type {
  OrderPricingInput,
  TransactionalCurrency,
} from "./types.ts";
import { WELCOME_OFFER_VERSION } from "../welcome-offer.ts";
import {
  applyAuthoritativeWelcomeOfferSnapshot,
  comparePricingExpectation,
  createPricingExpectation,
} from "./expectation.ts";
import { createPricingSnapshot } from "./snapshot.ts";

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
    assert.equal(one.volumeEligibleUnits, 1);
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
    assert.equal(six.volumeEligibleUnits, 6);
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

for (const currency of ["USD", "EUR", "CAD"] as const) {
  test(`Virtual Staging Welcome preserves original volume thresholds in ${currency}`, () => {
    const unit = getCatalogPrice("virtual-staging", currency);
    for (const [count, percent] of [
      [1, 0], [4, 0], [5, 5], [9, 5], [10, 10],
      [19, 10], [20, 15], [49, 15], [50, 0],
    ] as const) {
      const input = { serviceType: "virtual-staging", currency, items: stagingItems(count) } as const;
      const ordinary = calculateOrderQuote(input);
      const quote = calculateOrderQuote(input, { welcomeOfferAvailability: AVAILABLE });
      assert.equal(ordinary.volumeDiscountPercent, percent);
      assert.equal(quote.volumeDiscountPercent, percent);
      assert.equal(quote.volumeEligibleUnits, count);
      assert.equal(quote.customQuote, count === 50);
      if (count === 50) {
        assert.equal(ordinary.totalCents, null);
        assert.equal(quote.totalCents, null);
        assert.equal(quote.welcomeDiscountCents, 0);
        assert.deepEqual(quote.welcomeOffer.benefits, []);
        continue;
      }
      const welcome = percentageOfCents(unit, 50);
      const volume = percentageOfCents(unit * (count - 1), percent);
      assert.equal(quote.welcomeDiscountCents, welcome);
      assert.equal(quote.volumeDiscountCents, volume);
      assert.equal(quote.totalCents, unit * count - welcome - volume);
      assert.equal(ordinary.totalCents, unit * count - percentageOfCents(unit * count, percent));
      assert.ok(quote.totalCents! <= ordinary.totalCents!);
      assert.equal(quote.welcomeOffer.benefits[0]?.itemIndex, 0);
      assert.equal(quote.welcomeOffer.benefits[0]?.discountPercent, 50);
    }
  });

  test(`Virtual Staging Welcome never increases any fixed-price quantity in ${currency}`, () => {
    for (let count = 1; count < 50; count++) {
      const input = { serviceType: "virtual-staging", currency, items: stagingItems(count, ["image-enhancement", "day-to-dusk"]) } as const;
      const ordinary = calculateOrderQuote(input);
      const welcome = calculateOrderQuote(input, { welcomeOfferAvailability: AVAILABLE });
      const withoutAddOns = calculateOrderQuote(
        { ...input, items: stagingItems(count) }, { welcomeOfferAvailability: AVAILABLE },
      );
      assert.ok(welcome.totalCents! <= ordinary.totalCents!);
      assert.equal(welcome.volumeDiscountCents, withoutAddOns.volumeDiscountCents);
      assert.equal(welcome.welcomeDiscountCents, withoutAddOns.welcomeDiscountCents);
      assert.equal(welcome.totalCents! - withoutAddOns.totalCents!, welcome.addOnSubtotalCents);
    }
  });
}

test("the two free Welcome bases count toward the original volume thresholds", () => {
  for (const subService of ["image-enhancement-single-exposure", "day-to-dusk"] as const) {
    for (const [count, percent] of [[4, 0], [5, 5], [9, 5], [10, 10], [19, 10], [20, 15], [49, 15], [50, 0]] as const) {
      const quote = calculateOrderQuote(
        { serviceType: "photo-editing", currency: "USD", items: dedicatedItems(count, subService) },
        { welcomeOfferAvailability: AVAILABLE },
      );
      assert.equal(quote.volumeDiscountPercent, percent);
      assert.equal(quote.volumeEligibleUnits, count);
      assert.equal(quote.customQuote, count === 50);
      assert.equal(quote.welcomeOffer.benefits.length, count === 50 ? 0 : 1);
    }
  }
});

test("percentage discounts round half up once on aggregate integer cents", () => {
  assert.equal(percentageOfCents(49, 50), 25);
  assert.equal(percentageOfCents(1, 15), 0);
  assert.equal(percentageOfCents(10, 15), 2);
  const quote = calculateOrderQuote({
    serviceType: "photo-editing", currency: "USD", items: dedicatedItems(5, "day-to-dusk"),
  });
  assert.equal(quote.baseSubtotalCents, 1750);
  assert.equal(quote.volumeDiscountCents, 88);
  assert.equal(quote.totalCents, 1662);
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
  for (const [currency, stagingWelcome, enhancementWelcome] of [
    ["USD", 950, 120], ["EUR", 800, 100], ["CAD", 1300, 165],
  ] as const) {
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
    assert.equal(quote.welcomeDiscountCents, stagingWelcome);
    assert.equal(quote.totalCents, stagingWelcome);
    const enhancement = calculateOrderQuote({
      serviceType: "photo-editing", currency,
      items: dedicatedItems(1, "image-enhancement-single-exposure"),
    }, { welcomeOfferAvailability: AVAILABLE });
    assert.equal(enhancement.welcomeDiscountCents, getCatalogPrice("image-enhancement", currency));
    assert.equal(enhancement.welcomeDiscountCents, enhancementWelcome);
    assert.equal(enhancement.totalCents, 0);
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

test("pricing expectation records only the reviewed versions, benefit key, and total", () => {
  const quote = calculateOrderQuote(
    {
      serviceType: "virtual-staging",
      currency: "USD",
      items: stagingItems(1),
    },
    { welcomeOfferAvailability: AVAILABLE },
  );
  const expectation = createPricingExpectation(quote);
  assert.deepEqual(expectation, {
    pricingVersion: quote.pricingVersion,
    welcomeOfferVersion: quote.welcomeOffer.version,
    welcomeBenefitKey: "virtual-staging-first-image-50",
    totalCents: quote.totalCents,
  });
  assert.deepEqual(comparePricingExpectation(expectation, quote), { ok: true });
});

test("pricing expectation distinguishes stale code from a changed authoritative quote", () => {
  const eligible = calculateOrderQuote(
    {
      serviceType: "virtual-staging",
      currency: "USD",
      items: stagingItems(1),
    },
    { welcomeOfferAvailability: AVAILABLE },
  );
  const ordinary = calculateOrderQuote({
    serviceType: "virtual-staging",
    currency: "USD",
    items: stagingItems(1),
  });
  const expectation = createPricingExpectation(eligible)!;
  assert.deepEqual(comparePricingExpectation(undefined, ordinary), {
    ok: false,
    reason: "client_upgrade_required",
  });
  assert.deepEqual(
    comparePricingExpectation(
      { ...expectation, pricingVersion: "stale" },
      ordinary,
    ),
    { ok: false, reason: "client_upgrade_required" },
  );
  assert.deepEqual(comparePricingExpectation(expectation, ordinary), {
    ok: false,
    reason: "pricing_changed",
  });
});

test("authoritative pricing snapshot can restore or remove the current service benefit presentation", () => {
  const eligible = createPricingSnapshot(
    calculateOrderQuote(
      {
        serviceType: "virtual-staging",
        currency: "USD",
        items: stagingItems(1),
      },
      { welcomeOfferAvailability: AVAILABLE },
    ),
  );
  const ordinary = createPricingSnapshot(
    calculateOrderQuote({
      serviceType: "virtual-staging",
      currency: "USD",
      items: stagingItems(1),
    }),
  );
  assert.equal(
    applyAuthoritativeWelcomeOfferSnapshot(
      { ...AVAILABLE, virtualStagingAvailable: false },
      "virtual-staging-first-image-50",
      eligible,
    ).virtualStagingAvailable,
    true,
  );
  assert.equal(
    applyAuthoritativeWelcomeOfferSnapshot(
      AVAILABLE,
      "virtual-staging-first-image-50",
      ordinary,
    ).virtualStagingAvailable,
    false,
  );
});
