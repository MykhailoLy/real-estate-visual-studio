import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckoutEligibleOrder } from "./checkout-eligibility.ts";
import type { PaymentStatus, RefundStatus } from "./domain.ts";

export interface OrderPaymentRecord {
  id: string;
  order_id: string;
  provider: "stripe";
  payment_status: PaymentStatus;
  refund_status: RefundStatus;
  subtotal_cents: number;
  tax_cents: number | null;
  total_cents: number | null;
  currency: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_livemode: boolean | null;
  checkout_attempt: number;
  checkout_expires_at: string | null;
  paid_at: string | null;
}

export interface CheckoutRepository {
  getOrder(orderId: string): Promise<CheckoutEligibleOrder | null>;
  getPayment(orderId: string): Promise<OrderPaymentRecord | null>;
  createPayment(input: {
    orderId: string;
    subtotalCents: number;
    currency: string;
    stripeLivemode: boolean;
  }): Promise<OrderPaymentRecord | null>;
  reserveAttempt(input: {
    paymentId: string;
    expectedAttempt: number;
    nextAttempt: number;
    leaseExpiresAt: string;
  }): Promise<OrderPaymentRecord | null>;
  markCheckoutOpen(input: {
    paymentId: string;
    attempt: number;
    stripeCheckoutSessionId: string;
    stripeLivemode: boolean;
    checkoutExpiresAt: string | null;
  }): Promise<boolean>;
  markExpired(input: {
    paymentId: string;
    stripeCheckoutSessionId: string;
    attempt: number;
  }): Promise<boolean>;
  markFailed(input: { paymentId: string; attempt: number }): Promise<boolean>;
}

export class CheckoutRepositoryError extends Error {
  constructor(message = "Payment storage is unavailable.") {
    super(message);
    this.name = "CheckoutRepositoryError";
  }
}

const ORDER_COLUMNS =
  "id, order_number, user_id, client_email, status, service_type, " +
  "item_count, estimated_total_cents, currency, pricing_snapshot";
const PAYMENT_COLUMNS =
  "id, order_id, provider, payment_status, refund_status, subtotal_cents, tax_cents, " +
  "total_cents, currency, stripe_checkout_session_id, stripe_payment_intent_id, " +
  "stripe_livemode, checkout_attempt, checkout_expires_at, paid_at";
const RETRYABLE_UNPAID_PAYMENT_STATUSES = ["pending", "expired", "failed"];

export function createSupabaseCheckoutRepository(
  supabase: SupabaseClient,
): CheckoutRepository {
  return {
    async getOrder(orderId) {
      const { data, error } = await supabase
        .from("orders")
        .select(ORDER_COLUMNS)
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw new CheckoutRepositoryError();
      return (data as unknown as CheckoutEligibleOrder | null) ?? null;
    },

    async getPayment(orderId) {
      const { data, error } = await supabase
        .from("order_payments")
        .select(PAYMENT_COLUMNS)
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw new CheckoutRepositoryError();
      return (data as unknown as OrderPaymentRecord | null) ?? null;
    },

    async createPayment(input) {
      const { data, error } = await supabase
        .from("order_payments")
        .insert({
          order_id: input.orderId,
          provider: "stripe",
          payment_status: "pending",
          refund_status: "none",
          subtotal_cents: input.subtotalCents,
          currency: input.currency,
          tax_cents: null,
          total_cents: null,
          stripe_livemode: input.stripeLivemode,
        })
        .select(PAYMENT_COLUMNS)
        .maybeSingle();

      // A concurrent request can win the order_id UNIQUE constraint. The
      // caller reloads the row in that expected case; all other failures are
      // deliberately kept server-side.
      if (error) {
        if (error.code === "23505") return null;
        throw new CheckoutRepositoryError();
      }
      if (!data) throw new CheckoutRepositoryError();
      return data as unknown as OrderPaymentRecord;
    },

    async reserveAttempt(input) {
      const { data, error } = await supabase
        .from("order_payments")
        .update({
          checkout_attempt: input.nextAttempt,
          checkout_expires_at: input.leaseExpiresAt,
        })
        .eq("id", input.paymentId)
        .eq("checkout_attempt", input.expectedAttempt)
        .in("payment_status", RETRYABLE_UNPAID_PAYMENT_STATUSES)
        .is("paid_at", null)
        .select(PAYMENT_COLUMNS)
        .maybeSingle();
      if (error) throw new CheckoutRepositoryError();
      return (data as unknown as OrderPaymentRecord | null) ?? null;
    },

    async markCheckoutOpen(input) {
      const { data, error } = await supabase
        .from("order_payments")
        .update({
          payment_status: "checkout_open",
          stripe_checkout_session_id: input.stripeCheckoutSessionId,
          stripe_livemode: input.stripeLivemode,
          checkout_expires_at: input.checkoutExpiresAt,
        })
        .eq("id", input.paymentId)
        .eq("checkout_attempt", input.attempt)
        .in("payment_status", RETRYABLE_UNPAID_PAYMENT_STATUSES)
        .is("paid_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw new CheckoutRepositoryError();
      return Boolean(data);
    },

    async markExpired(input) {
      const { data, error } = await supabase
        .from("order_payments")
        .update({ payment_status: "expired" })
        .eq("id", input.paymentId)
        .eq("stripe_checkout_session_id", input.stripeCheckoutSessionId)
        .eq("checkout_attempt", input.attempt)
        .eq("payment_status", "checkout_open")
        .is("paid_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw new CheckoutRepositoryError();
      return Boolean(data);
    },

    async markFailed(input) {
      const { data, error } = await supabase
        .from("order_payments")
        .update({ payment_status: "failed", checkout_expires_at: null })
        .eq("id", input.paymentId)
        .eq("checkout_attempt", input.attempt)
        .in("payment_status", RETRYABLE_UNPAID_PAYMENT_STATUSES)
        .is("paid_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw new CheckoutRepositoryError();
      return Boolean(data);
    },
  };
}
