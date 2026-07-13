import assert from "node:assert/strict";
import test from "node:test";
import {
  PAYMENT_STATUSES,
  REFUND_STATUSES,
  STRIPE_LAUNCH_CURRENCY,
  isPaymentStatus,
  isRefundStatus,
  transitionPaymentStatus,
  transitionRefundStatus,
} from "./domain.ts";

test("allows the expected payment status transitions", () => {
  const transitions = [
    ["pending", "checkout_open"],
    ["pending", "failed"],
    ["checkout_open", "paid"],
    ["checkout_open", "expired"],
    ["checkout_open", "failed"],
    ["expired", "checkout_open"],
    ["failed", "checkout_open"],
  ] as const;

  for (const [current, next] of transitions) {
    assert.equal(transitionPaymentStatus(current, next), next);
  }
});

test("rejects regressions from paid payment status", () => {
  for (const next of PAYMENT_STATUSES) {
    assert.equal(transitionPaymentStatus("paid", next), null);
  }
});

test("allows the expected refund status progression", () => {
  const transitions = [
    ["none", "partial"],
    ["none", "full"],
    ["partial", "full"],
  ] as const;

  for (const [current, next] of transitions) {
    assert.equal(transitionRefundStatus(current, next), next);
  }
});

test("rejects refund status regressions", () => {
  assert.equal(transitionRefundStatus("partial", "none"), null);
  assert.equal(transitionRefundStatus("full", "partial"), null);
  assert.equal(transitionRefundStatus("full", "none"), null);
});

test("uses usd as the launch currency", () => {
  assert.equal(STRIPE_LAUNCH_CURRENCY, "usd");
});

test("accepts only defined payment and refund status values", () => {
  for (const status of PAYMENT_STATUSES) {
    assert.equal(isPaymentStatus(status), true);
  }
  for (const status of REFUND_STATUSES) {
    assert.equal(isRefundStatus(status), true);
  }

  assert.equal(isPaymentStatus("cancelled"), false);
  assert.equal(isRefundStatus("refunded"), false);
});
