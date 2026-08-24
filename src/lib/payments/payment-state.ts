import {
  CheckoutEligibilityError,
  getStoredCheckoutPrice,
  type StoredCheckoutPriceOrder,
} from "./checkout-eligibility.ts";
import type { PaymentStatus } from "./domain.ts";

export type PersistedOrderPaymentState =
  | "paid"
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
 * an input. Ineligible and custom-quote orders retain their manual workflow.
 */
export function getPersistedOrderPaymentState(
  order: PaymentStateOrder,
  payment: PersistedOrderPayment | null,
): PersistedOrderPaymentState {
  let price: ReturnType<typeof getStoredCheckoutPrice>;
  try {
    price = getStoredCheckoutPrice(order);
  } catch (error) {
    if (error instanceof CheckoutEligibilityError) return "manual_review";
    throw error;
  }

  const matchesCheckoutSnapshot = paymentMatchesPrice(order, payment, price);

  if (
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
    Boolean(payment.stripe_payment_intent_id)
  ) {
    return "paid";
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
): boolean {
  try {
    return paymentMatchesPrice(order, payment, getStoredCheckoutPrice(order));
  } catch (error) {
    if (error instanceof CheckoutEligibilityError) return false;
    throw error;
  }
}

function paymentMatchesPrice(
  order: PaymentStateOrder,
  payment: PersistedOrderPayment | null,
  price: ReturnType<typeof getStoredCheckoutPrice>,
): boolean {
  return Boolean(
    payment &&
      payment.order_id === order.id &&
      payment.provider === "stripe" &&
      payment.subtotal_cents === price.subtotalCents &&
      payment.currency === price.currency &&
      typeof payment.stripe_livemode === "boolean",
  );
}
