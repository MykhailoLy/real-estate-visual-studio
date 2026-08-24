import "server-only";

import Stripe from "stripe";

import {
  parseStripeApiConfig,
  parseStripeWebhookConfig,
  type StripeApiConfig,
  type StripeWebhookConfig,
} from "./stripe-config.ts";

let stripeServerClient: Stripe | null = null;

/**
 * Reads and validates the Stripe API key only at server runtime.
 */
export function getStripeApiConfig(): StripeApiConfig {
  return parseStripeApiConfig(process.env);
}

/** Current server-side Stripe environment, derived from the validated API key. */
export function getExpectedStripeLivemode(): boolean {
  return getStripeApiConfig().mode === "live";
}

/**
 * Reads and validates the webhook signing secret only when verification needs it.
 */
export function getStripeWebhookConfig(): StripeWebhookConfig {
  return parseStripeWebhookConfig(process.env);
}

/**
 * Returns one lazily constructed server-only Stripe client per process.
 * Constructing the SDK client is local only; no Stripe request is made here.
 */
export function getStripeServerClient(): Stripe {
  stripeServerClient ??= new Stripe(getStripeApiConfig().secretKey);
  return stripeServerClient;
}
