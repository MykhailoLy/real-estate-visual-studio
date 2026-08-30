import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ORDER_REVIEW_BACK_LABEL,
  TWO_STEP_ORDER_STEPS,
} from "./order-flow-copy.ts";
import {
  CHECKOUT_TAX_SUPPORTING_COPY,
  CUSTOM_QUOTE_SUPPORTING_COPY,
  ORDINARY_FIXED_PRICE_FOOTER_COPY,
  ORDINARY_FIXED_PRICE_SUPPORTING_COPY,
  POSITIVE_WELCOME_OFFER_SUPPORTING_COPY,
  ZERO_TOTAL_FOOTER_COPY,
  ZERO_TOTAL_SUPPORTING_COPY,
  getOrderSubmitFooterCopy,
  getOrderSummarySupportingCopy,
  getOrderTotalSupportingCopy,
} from "./order-summary-copy.ts";

const source = (path: string) => readFileSync(path, "utf8");

const twoStepForms = [
  "src/components/order/virtual-staging/VirtualStagingOrderForm.tsx",
  "src/components/order/virtual-renovation/VirtualRenovationOrderForm.tsx",
  "src/components/order/image-enhancement/SingleExposureOrderForm.tsx",
  "src/components/order/day-to-dusk/DayToDuskOrderForm.tsx",
  "src/components/order/photo-editing/PhotoEditingOrderForm.tsx",
  "src/components/order/item-removal/ItemRemovalOrderForm.tsx",
];

const reviewComponents = [
  "src/components/order/virtual-staging/VirtualStagingReview.tsx",
  "src/components/order/virtual-renovation/VirtualRenovationReview.tsx",
  "src/components/order/image-enhancement/SingleExposureReview.tsx",
  "src/components/order/day-to-dusk/DayToDuskReview.tsx",
  "src/components/order/photo-editing/PhotoEditingReview.tsx",
  "src/components/order/item-removal/ItemRemovalReview.tsx",
];

test("all two-step order flows share the final labels and review back copy", () => {
  assert.deepEqual(TWO_STEP_ORDER_STEPS, [
    { id: "configure", label: "Order Details" },
    { id: "review", label: "Review & Confirm" },
  ]);
  assert.equal(ORDER_REVIEW_BACK_LABEL, "Back to Order Details");

  for (const path of twoStepForms) {
    const form = source(path);
    assert.match(form, /const STEPS = TWO_STEP_ORDER_STEPS/);
    assert.match(form, /<OrderStepIndicator steps=\{STEPS\}/);
  }
  for (const path of reviewComponents) {
    const review = source(path);
    assert.equal(
      (review.match(/\{ORDER_REVIEW_BACK_LABEL\}/g) ?? []).length,
      2,
      path,
    );
  }

  const customerOrderSources = [
    ...twoStepForms,
    ...reviewComponents,
    "src/components/order/OrderStepIndicator.tsx",
    "src/components/order/order-flow-copy.ts",
    "src/components/order/floor-plans/FloorPlansOrderForm.tsx",
    "src/components/order/photo-editing/DedicatedPhotoEditingOrderForm.tsx",
  ].map(source).join("\n");
  assert.doesNotMatch(customerOrderSources, /Configure Order/);
  assert.doesNotMatch(customerOrderSources, /Review & Submit/);
  assert.doesNotMatch(customerOrderSources, /Back to Edit/);
});

test("summary copy distinguishes free, discounted balance, ordinary, and custom orders", () => {
  const zeroQuote = {
    customQuote: false,
    totalCents: 0,
    welcomeDiscountCents: 100,
  };
  const welcomeBalanceQuote = {
    customQuote: false,
    totalCents: 2100,
    welcomeDiscountCents: 700,
  };
  const ordinaryQuote = {
    customQuote: false,
    totalCents: 2800,
    welcomeDiscountCents: 0,
  };
  const customQuote = {
    customQuote: true,
    totalCents: null,
    welcomeDiscountCents: 0,
  };

  assert.deepEqual(getOrderTotalSupportingCopy(zeroQuote), [
    ZERO_TOTAL_SUPPORTING_COPY,
  ]);
  assert.doesNotMatch(getOrderTotalSupportingCopy(zeroQuote).join(" "), /Stripe/);
  assert.equal(getOrderSubmitFooterCopy(zeroQuote), ZERO_TOTAL_FOOTER_COPY);

  assert.deepEqual(getOrderTotalSupportingCopy(welcomeBalanceQuote), [
    POSITIVE_WELCOME_OFFER_SUPPORTING_COPY,
    CHECKOUT_TAX_SUPPORTING_COPY,
  ]);
  assert.equal(
    getOrderSubmitFooterCopy(welcomeBalanceQuote),
    POSITIVE_WELCOME_OFFER_SUPPORTING_COPY,
  );
  assert.deepEqual(getOrderSummarySupportingCopy(welcomeBalanceQuote), [
    CHECKOUT_TAX_SUPPORTING_COPY,
  ]);

  assert.deepEqual(getOrderTotalSupportingCopy(ordinaryQuote), [
    ORDINARY_FIXED_PRICE_SUPPORTING_COPY,
  ]);
  assert.equal(
    getOrderSubmitFooterCopy(ordinaryQuote),
    ORDINARY_FIXED_PRICE_FOOTER_COPY,
  );

  assert.deepEqual(getOrderTotalSupportingCopy(customQuote), [
    CUSTOM_QUOTE_SUPPORTING_COPY,
  ]);
  assert.equal(getOrderSubmitFooterCopy(customQuote), null);
});

test("summary rows keep labels and long values separated at narrow widths", () => {
  const summary = source("src/components/order/OrderSummary.tsx");
  assert.equal(
    (summary.match(/grid-cols-\[minmax\(0,1fr\)_minmax\(0,2fr\)\]/g) ?? [])
      .length,
    2,
  );
  assert.match(
    summary,
    /min-w-0 break-words text-right font-medium text-foreground/,
  );
  assert.match(summary, /flex justify-between gap-4 text-xs/);
  assert.doesNotMatch(
    summary,
    /No payment now\. We confirm & invoice after review\./,
  );

  for (const path of [
    "src/components/order/image-enhancement/SingleExposureOrderForm.tsx",
    "src/components/order/photo-editing/PhotoEditingOrderForm.tsx",
    "src/components/order/item-removal/ItemRemovalOrderForm.tsx",
  ]) {
    const form = source(path);
    assert.equal((form.match(/<OrderSummary/g) ?? []).length, 1, path);
    assert.match(form, /<OrderReviewAction/, path);
    assert.doesNotMatch(form, /No payment now\. You’ll confirm your order on the next step\./);
  }
});
