import { getVolumeDiscount } from "@/lib/pricing/discounts";
import { PRICING_VERSION } from "@/lib/pricing/catalog";
import { parsePricingSnapshot } from "@/lib/pricing/snapshot";
import { STRIPE_LAUNCH_CURRENCY } from "./domain.ts";

const SUPPORTED_CHECKOUT_SERVICES = new Set([
  "virtual-staging",
  "virtual-renovation",
  "3d-floor-plans",
  "photo-editing",
]);

export interface CheckoutEligibleOrder {
  id: string;
  order_number: string;
  user_id: string | null;
  client_email: string | null;
  status: string;
  service_type: string;
  estimated_total_cents: number;
  currency: string;
  pricing_snapshot: unknown;
}

export class CheckoutEligibilityError extends Error {
  readonly kind: "conflict" | "ineligible";

  constructor(
    kind: "conflict" | "ineligible",
    message: string,
  ) {
    super(message);
    this.name = "CheckoutEligibilityError";
    this.kind = kind;
  }
}

export interface CheckoutPrice {
  subtotalCents: number;
  currency: typeof STRIPE_LAUNCH_CURRENCY;
}

/**
 * Determines Checkout eligibility solely from the immutable server-created
 * order snapshot. This deliberately never recalculates a quote from order
 * items or accepts values supplied by a browser.
 */
export function getCheckoutPrice(order: CheckoutEligibleOrder): CheckoutPrice {
  if (order.status !== "pending") {
    throw new CheckoutEligibilityError(
      "conflict",
      "This order is not available for payment.",
    );
  }

  if (!SUPPORTED_CHECKOUT_SERVICES.has(order.service_type)) {
    throw new CheckoutEligibilityError(
      "ineligible",
      "This order is not eligible for automatic Checkout.",
    );
  }

  if (order.currency !== "USD") {
    throw new CheckoutEligibilityError(
      "ineligible",
      "This order is not eligible for automatic Checkout.",
    );
  }

  const snapshot = parsePricingSnapshot(order.pricing_snapshot);
  if (
    !snapshot ||
    snapshot.pricingVersion !== PRICING_VERSION ||
    snapshot.serviceType !== order.service_type ||
    snapshot.currency !== "USD"
  ) {
    throw new CheckoutEligibilityError(
      "ineligible",
      "This order does not have a current fixed-price snapshot.",
    );
  }

  if (!Number.isInteger(snapshot.eligibleUnits) || snapshot.eligibleUnits < 0) {
    throw new CheckoutEligibilityError(
      "ineligible",
      "This order is not eligible for automatic Checkout.",
    );
  }

  const volume = getVolumeDiscount(snapshot.eligibleUnits);
  if (snapshot.customQuote || volume.customQuote) {
    throw new CheckoutEligibilityError(
      "ineligible",
      "This order requires a custom quote.",
    );
  }

  const totalCents = snapshot.totalCents;
  if (
    typeof totalCents !== "number" ||
    !Number.isSafeInteger(totalCents) ||
    totalCents <= 0 ||
    totalCents !== snapshot.subtotalAfterDiscountCents ||
    !Number.isSafeInteger(order.estimated_total_cents) ||
    order.estimated_total_cents !== totalCents
  ) {
    throw new CheckoutEligibilityError(
      "conflict",
      "The stored order total cannot be verified.",
    );
  }

  return { subtotalCents: totalCents, currency: STRIPE_LAUNCH_CURRENCY };
}
