import "server-only";

import { getServiceLabel } from "@/lib/display/service-labels";
import {
  CheckoutEligibilityError,
  getStoredCheckoutPrice,
} from "./checkout-eligibility.ts";
import type {
  CheckoutRepository,
  OrderPaymentRecord,
} from "./checkout-repository.ts";
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

  const paymentMatches = Boolean(
    price &&
      payment &&
      payment.subtotal_cents === price.subtotalCents &&
      payment.currency === price.currency,
  );
  const state = deriveCustomerPaymentState({
    orderStatus: order.status,
    hasFixedPrice: price !== null,
    payment,
    paymentMatches,
  });

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    serviceLabel: getServiceLabel(order.service_type),
    itemCount: order.item_count,
    finalTotalCents: price?.subtotalCents ?? null,
    currency: price
      ? (order.currency as AuthoritativePaymentSummary["currency"])
      : null,
    paymentStatus: paymentMatches ? payment?.payment_status ?? null : null,
    state,
  };
}

function deriveCustomerPaymentState({
  orderStatus,
  hasFixedPrice,
  payment,
  paymentMatches,
}: {
  orderStatus: string;
  hasFixedPrice: boolean;
  payment: OrderPaymentRecord | null;
  paymentMatches: boolean;
}): CustomerPaymentState {
  if (
    paymentMatches &&
    payment &&
    (payment.payment_status === "paid" || payment.paid_at !== null)
  ) {
    return "paid";
  }
  if (paymentMatches && payment?.payment_status === "checkout_open") {
    return "processing";
  }
  if (
    orderStatus === "pending" &&
    hasFixedPrice &&
    (!payment || paymentMatches)
  ) {
    return "payment_required";
  }
  return "not_available";
}

export const paymentSummaryInternals = { deriveCustomerPaymentState };
