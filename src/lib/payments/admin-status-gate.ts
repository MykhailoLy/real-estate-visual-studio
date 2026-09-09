import {
  getPersistedOrderPaymentState,
  type PaymentStateOrder,
  type PersistedOrderPayment,
  type PersistedOrderPaymentState,
} from "./payment-state.ts";
import {
  CheckoutEligibilityError,
  getStoredCheckoutPrice,
  isNoPaymentRequiredOrder,
} from "./checkout-eligibility.ts";
import { isSupportedPricingVersion, parsePricingSnapshot } from "../pricing/snapshot.ts";

export const PRODUCTION_ADVANCING_ORDER_STATUSES = [
  "confirmed",
  "in-progress",
  "delivered",
] as const;

export type ProductionAdvancingOrderStatus =
  (typeof PRODUCTION_ADVANCING_ORDER_STATUSES)[number];

export interface AdminPaymentGateDependencies {
  getExpectedStripeLivemode: () => boolean;
}

export class AdminPaymentGateError extends Error {
  readonly paymentState: PersistedOrderPaymentState;

  constructor(paymentState: PersistedOrderPaymentState) {
    super(
      paymentState === "partially_refunded" || paymentState === "refunded"
        ? "Refunded payments cannot enter production. Review the order and refund before advancing it."
        : paymentState === "processing"
        ? "Payment verification is still processing. Wait for Paid before advancing this order."
        : "A matching Paid payment is required before this fixed-price order can enter production.",
    );
    this.name = "AdminPaymentGateError";
    this.paymentState = paymentState;
  }
}

/**
 * Server-side fulfillment gate. Only fixed-price Checkout orders are gated;
 * custom-quote and otherwise ineligible orders retain the manual workflow and
 * do not require Stripe configuration to advance through that workflow.
 */
export function assertAdminOrderStatusTransitionAllowed(
  order: PaymentStateOrder,
  payment: PersistedOrderPayment | null,
  newStatus: string,
  dependencies: AdminPaymentGateDependencies,
): PersistedOrderPaymentState {
  let expectedStripeLivemode: boolean | null = null;
  const noPaymentRequired = isNoPaymentRequiredOrder(order);
  try {
    getStoredCheckoutPrice(order);
    expectedStripeLivemode = dependencies.getExpectedStripeLivemode();
  } catch (error) {
    if (!(error instanceof CheckoutEligibilityError)) throw error;
  }

  const paymentState = getPersistedOrderPaymentState(
    order,
    payment,
    expectedStripeLivemode,
  );
  const advancesProduction = PRODUCTION_ADVANCING_ORDER_STATUSES.some(
    (status) => status === newStatus,
  );

  if (
    advancesProduction &&
    paymentState !== "paid" &&
    paymentState !== "no_payment_required" &&
    paymentState !== "manual_review"
  ) {
    throw new AdminPaymentGateError(paymentState);
  }

  // A malformed supported fixed-price snapshot must never inherit the
  // legacy/custom-quote manual workflow exemption.
  const snapshot = parsePricingSnapshot(order.pricing_snapshot);
  const rawSnapshot =
    order.pricing_snapshot && typeof order.pricing_snapshot === "object"
      ? (order.pricing_snapshot as Record<string, unknown>)
      : null;
  if (
    advancesProduction &&
    paymentState === "manual_review" &&
    !noPaymentRequired &&
    isSupportedPricingVersion(rawSnapshot?.pricingVersion) &&
    rawSnapshot?.serviceType === order.service_type &&
    snapshot?.customQuote !== true &&
    rawSnapshot.customQuote !== true
  ) {
    throw new AdminPaymentGateError(paymentState);
  }

  return paymentState;
}
