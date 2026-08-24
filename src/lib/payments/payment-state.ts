import {
  CheckoutEligibilityError,
  getStoredCheckoutPrice,
  type StoredCheckoutPriceOrder,
} from "./checkout-eligibility.ts";
import type { PaymentStatus, RefundStatus } from "./domain.ts";

export type PersistedOrderPaymentState =
  | "paid"
  | "partially_refunded"
  | "refunded"
  | "payment_required"
  | "processing"
  | "manual_review";

export interface PaymentStateOrder extends StoredCheckoutPriceOrder {
  id: string;
}

export interface PersistedOrderPayment {
  order_id: string;
  provider: string;
  payment_status: PaymentStatus;
  refund_status: RefundStatus;
  refunded_amount_cents: number;
  subtotal_cents: number;
  tax_cents: number | null;
  total_cents: number | null;
  currency: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_livemode: boolean | null;
  paid_at: string | null;
}

/**
 * Derives an operational payment state from the immutable order snapshot and
 * the webhook-owned payment record. A browser redirect or UI status is never
 * an input. Paid also requires the persisted mode to match the current Stripe
 * environment. Successful refunds remain separate from payment_status and are
 * derived only from the persisted aggregate refund fields. Ineligible and
 * custom-quote orders retain their manual workflow.
 */
export function getPersistedOrderPaymentState(
  order: PaymentStateOrder,
  payment: PersistedOrderPayment | null,
  expectedStripeLivemode: boolean | null,
): PersistedOrderPaymentState {
  let price: ReturnType<typeof getStoredCheckoutPrice>;
  try {
    price = getStoredCheckoutPrice(order);
  } catch (error) {
    if (error instanceof CheckoutEligibilityError) return "manual_review";
    throw error;
  }

  const matchesCheckoutSnapshot = paymentMatchesPrice(
    order,
    payment,
    price,
    expectedStripeLivemode,
  );

  const verifiedPaid =
    matchesCheckoutSnapshot &&
    payment &&
    payment.payment_status === "paid" &&
    payment.paid_at !== null &&
    payment.total_cents === price.subtotalCents &&
    payment.tax_cents !== null &&
    Number.isSafeInteger(payment.tax_cents) &&
    payment.tax_cents >= 0 &&
    payment.tax_cents <= price.subtotalCents &&
    Boolean(payment.stripe_checkout_session_id) &&
    Boolean(payment.stripe_payment_intent_id) &&
    Number.isSafeInteger(payment.refunded_amount_cents) &&
    payment.refunded_amount_cents >= 0 &&
    payment.refunded_amount_cents <= price.subtotalCents;

  if (verifiedPaid && payment) {
    if (
      payment.refund_status === "full" &&
      payment.refunded_amount_cents === price.subtotalCents
    ) {
      return "refunded";
    }
    if (
      payment.refund_status === "partial" &&
      payment.refunded_amount_cents > 0 &&
      payment.refunded_amount_cents < price.subtotalCents
    ) {
      return "partially_refunded";
    }
    if (
      payment.refund_status === "none" &&
      payment.refunded_amount_cents === 0
    ) {
      return "paid";
    }
  }

  if (
    matchesCheckoutSnapshot &&
    payment?.payment_status === "checkout_open"
  ) {
    return "processing";
  }

  return "payment_required";
}

export function paymentRecordMatchesCheckoutSnapshot(
  order: PaymentStateOrder,
  payment: PersistedOrderPayment | null,
  expectedStripeLivemode: boolean | null,
): boolean {
  try {
    return paymentMatchesPrice(
      order,
      payment,
      getStoredCheckoutPrice(order),
      expectedStripeLivemode,
    );
  } catch (error) {
    if (error instanceof CheckoutEligibilityError) return false;
    throw error;
  }
}

function paymentMatchesPrice(
  order: PaymentStateOrder,
  payment: PersistedOrderPayment | null,
  price: ReturnType<typeof getStoredCheckoutPrice>,
  expectedStripeLivemode: boolean | null,
): boolean {
  return Boolean(
    payment &&
      payment.order_id === order.id &&
      payment.provider === "stripe" &&
      payment.subtotal_cents === price.subtotalCents &&
      payment.currency === price.currency &&
      expectedStripeLivemode !== null &&
      payment.stripe_livemode === expectedStripeLivemode,
  );
}
