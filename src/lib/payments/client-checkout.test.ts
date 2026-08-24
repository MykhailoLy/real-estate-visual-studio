import assert from "node:assert/strict";
import test from "node:test";
import { getStripeCheckoutRedirectUrl } from "./client-checkout.ts";

test("accepts only Stripe-hosted HTTPS Checkout destinations", () => {
  assert.equal(
    getStripeCheckoutRedirectUrl(
      "https://checkout.stripe.com/c/pay/cs_test_123?prefilled_email=test%40example.com",
    ),
    "https://checkout.stripe.com/c/pay/cs_test_123?prefilled_email=test%40example.com",
  );

  for (const unsafe of [
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "http://checkout.stripe.com/c/pay/cs_test_123",
    "https://example.com/c/pay/cs_test_123",
    "https://checkout.stripe.com.evil.example/c/pay/cs_test_123",
    "https://user:secret@checkout.stripe.com/c/pay/cs_test_123",
    "not a url",
    null,
  ]) {
    assert.equal(getStripeCheckoutRedirectUrl(unsafe), null);
  }
});
