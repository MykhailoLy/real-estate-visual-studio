import { getVolumeDiscount } from "@/lib/pricing/discounts";
import { PRICING_VERSION } from "@/lib/pricing/catalog";
import { getCatalogPrice } from "@/lib/pricing/catalog";
import { parsePricingSnapshot } from "@/lib/pricing/snapshot";
import {
  WELCOME_OFFER_BENEFIT_RULES,
  WELCOME_OFFER_VERSION,
} from "@/lib/welcome-offer";
import {
  toStripeCheckoutCurrency,
  type StripeCheckoutCurrency,
} from "./domain.ts";

const SUPPORTED_CHECKOUT_SERVICES = new Set([
  "virtual-staging",
  "virtual-renovation",
  "3d-floor-plans",
  "photo-editing",
]);

export interface StoredCheckoutPriceOrder {
  service_type: string;
  estimated_total_cents: number;
  currency: string;
  pricing_snapshot: unknown;
}

export interface CheckoutEligibleOrder extends StoredCheckoutPriceOrder {
  id: string;
  order_number: string;
  user_id: string | null;
  client_email: string | null;
  status: string;
  item_count: number;
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
  currency: StripeCheckoutCurrency;
}

/**
 * Narrow, fail-closed exemption for a committed one-image free Welcome Offer
 * order. It uses only the immutable current-version server snapshot; it never
 * accepts a browser total or manufactures a payment record.
 */
export function isNoPaymentRequiredOrder(
  order: StoredCheckoutPriceOrder,
): boolean {
  if (
    order.service_type !== "photo-editing" ||
    order.estimated_total_cents !== 0
  ) {
    return false;
  }
  const snapshot = parsePricingSnapshot(order.pricing_snapshot);
  if (
    !snapshot ||
    snapshot.pricingVersion !== PRICING_VERSION ||
    snapshot.serviceType !== order.service_type ||
    snapshot.currency !== order.currency ||
    !toStripeCheckoutCurrency(snapshot.currency) ||
    snapshot.customQuote ||
    snapshot.eligibleUnits !== 1 ||
    snapshot.volumeEligibleUnits !== 0 ||
    snapshot.volumeDiscountPercent !== 0 ||
    snapshot.volumeDiscountCents !== 0 ||
    snapshot.addOnSubtotalCents !== 0 ||
    snapshot.subtotalAfterDiscountCents !== 0 ||
    snapshot.totalCents !== 0 ||
    snapshot.welcomeOffer.version !== WELCOME_OFFER_VERSION ||
    snapshot.welcomeOffer.benefits.length !== 1 ||
    snapshot.items.length !== 1
  ) {
    return false;
  }

  const benefit = snapshot.welcomeOffer.benefits[0];
  if (
    benefit.key !== "image-enhancement-free" &&
    benefit.key !== "day-to-dusk-free"
  ) {
    return false;
  }
  const rule = WELCOME_OFFER_BENEFIT_RULES[benefit.key];
  const catalogPrice = getCatalogPrice(rule.priceKey, snapshot.currency);
  const item = snapshot.items[0];
  return (
    benefit.itemIndex === 0 &&
    benefit.priceKey === rule.priceKey &&
    benefit.discountPercent === 100 &&
    benefit.discountCents === catalogPrice &&
    snapshot.welcomeDiscountCents === catalogPrice &&
    snapshot.welcomeOffer.totalDiscountCents === catalogPrice &&
    snapshot.baseSubtotalCents === catalogPrice &&
    item.priceKey === rule.priceKey &&
    item.unitPriceCents === catalogPrice &&
    item.baseSubtotalCents === catalogPrice &&
    item.addOnSubtotalCents === 0 &&
    item.addOns.length === 0 &&
    item.lineSubtotalCents === catalogPrice
  );
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

  return getStoredCheckoutPrice(order);
}

/**
 * Validates the immutable fixed-price snapshot without applying the mutable
 * order workflow status gate. Read-only payment summaries use this so a paid
 * order remains displayable after an administrator advances fulfillment.
 */
export function getStoredCheckoutPrice(
  order: StoredCheckoutPriceOrder,
): CheckoutPrice {
  if (!SUPPORTED_CHECKOUT_SERVICES.has(order.service_type)) {
    throw new CheckoutEligibilityError(
      "ineligible",
      "This order is not eligible for automatic Checkout.",
    );
  }

  const stripeCurrency = toStripeCheckoutCurrency(order.currency);
  if (!stripeCurrency) {
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
    snapshot.currency !== order.currency
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

  return { subtotalCents: totalCents, currency: stripeCurrency };
}
