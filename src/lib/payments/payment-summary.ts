import "server-only";

import { getServiceLabel } from "@/lib/display/service-labels";
import {
  CheckoutEligibilityError,
  getStoredCheckoutPrice,
} from "./checkout-eligibility.ts";
import type {
  CheckoutRepository,
} from "./checkout-repository.ts";
import {
  getPersistedOrderPaymentState,
  paymentRecordMatchesCheckoutSnapshot,
} from "./payment-state.ts";
import type {
  AuthoritativePaymentSummary,
  CustomerPaymentState,
} from "./domain.ts";

export interface PaymentSummaryDependencies {
  repository: CheckoutRepository;
}

/**
 * Loads a browser-safe payment summary from server-owned order and payment
 * records. Identity is always supplied by the verified authenticated session.
 */
export async function getAuthoritativePaymentSummary(
  orderId: string,
  authenticatedUserId: string,
  dependencies: PaymentSummaryDependencies,
): Promise<AuthoritativePaymentSummary | null> {
  const order = await dependencies.repository.getOrder(orderId);
  if (!order || order.user_id !== authenticatedUserId) return null;

  const payment = await dependencies.repository.getPayment(order.id);
  let price: ReturnType<typeof getStoredCheckoutPrice> | null = null;
  try {
    price = getStoredCheckoutPrice(order);
  } catch (error) {
    if (!(error instanceof CheckoutEligibilityError)) throw error;
  }

  const paymentMatches = paymentRecordMatchesCheckoutSnapshot(order, payment);
  const state = deriveCustomerPaymentState({
    orderStatus: order.status,
    persistedState: getPersistedOrderPaymentState(order, payment),
    paymentExists: payment !== null,
    paymentMatches,
  });
  const summaryPaymentStatus =
    paymentMatches &&
    payment &&
    (state === "paid" ||
      state === "processing" ||
      payment.payment_status === "pending" ||
      payment.payment_status === "expired" ||
      payment.payment_status === "failed")
      ? payment.payment_status
      : null;

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    serviceLabel: getServiceLabel(order.service_type),
    itemCount: order.item_count,
    finalTotalCents: price?.subtotalCents ?? null,
    currency: price
      ? (order.currency as AuthoritativePaymentSummary["currency"])
      : null,
    paymentStatus: summaryPaymentStatus,
    state,
  };
}

function deriveCustomerPaymentState({
  orderStatus,
  persistedState,
  paymentExists,
  paymentMatches,
}: {
  orderStatus: string;
  persistedState: ReturnType<typeof getPersistedOrderPaymentState>;
  paymentExists: boolean;
  paymentMatches: boolean;
}): CustomerPaymentState {
  if (persistedState === "paid") return "paid";
  if (persistedState === "processing") return "processing";
  if (
    orderStatus === "pending" &&
    persistedState === "payment_required" &&
    (!paymentExists || paymentMatches)
  ) {
    return "payment_required";
  }
  return "not_available";
}

export const paymentSummaryInternals = { deriveCustomerPaymentState };
