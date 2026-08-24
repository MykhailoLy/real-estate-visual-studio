import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentStatus, RefundStatus } from "./domain.ts";

export type WebhookEventProcessingStatus = "received" | "processed" | "ignored" | "failed";

export interface StripeWebhookEventRecord {
  stripe_event_id: string;
  processing_status: WebhookEventProcessingStatus;
  processed_at: string | null;
  order_id: string | null;
}

export interface WebhookPaymentRecord {
  id: string;
  order_id: string;
  provider: "stripe";
  payment_status: PaymentStatus;
  refund_status: RefundStatus;
  refunded_amount_cents: number;
  refunded_at: string | null;
  subtotal_cents: number;
  tax_cents: number | null;
  total_cents: number | null;
  currency: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  stripe_livemode: boolean | null;
  checkout_expires_at: string | null;
  paid_at: string | null;
}

export interface WebhookRepository {
  registerEvent(input: {
    stripeEventId: string;
    eventType: string;
    stripeLivemode: boolean;
    stripeObjectId: string | null;
    stripeCreatedAt: string | null;
    receivedAt: string;
  }): Promise<StripeWebhookEventRecord | null>;
  getEvent(stripeEventId: string): Promise<StripeWebhookEventRecord | null>;
  finishEvent(input: {
    stripeEventId: string;
    status: Exclude<WebhookEventProcessingStatus, "received">;
    processedAt: string | null;
    errorMessage: string | null;
    orderId: string | null;
  }): Promise<boolean>;
  getPayment(orderId: string): Promise<WebhookPaymentRecord | null>;
  getPaymentByPaymentIntent(
    stripePaymentIntentId: string,
  ): Promise<WebhookPaymentRecord | null>;
  markPaid(input: {
    payment: WebhookPaymentRecord;
    stripeCheckoutSessionId: string;
    stripePaymentIntentId: string;
    stripeCustomerId: string | null;
    taxCents: number;
    totalCents: number;
    paidAt: string;
  }): Promise<boolean>;
  markFailed(input: {
    payment: WebhookPaymentRecord;
    stripeCheckoutSessionId: string;
    stripePaymentIntentId: string | null;
  }): Promise<boolean>;
  markExpired(input: {
    payment: WebhookPaymentRecord;
    stripeCheckoutSessionId: string;
    stripePaymentIntentId: string | null;
  }): Promise<boolean>;
  syncRefund(input: {
    payment: WebhookPaymentRecord;
    refundStatus: Exclude<RefundStatus, "none">;
    refundedAmountCents: number;
    refundedAt: string;
  }): Promise<boolean>;
}

export class WebhookRepositoryError extends Error {
  constructor(message = "Payment webhook storage is unavailable.") {
    super(message);
    this.name = "WebhookRepositoryError";
  }
}

const EVENT_COLUMNS = "stripe_event_id, processing_status, processed_at, order_id";
const PAYMENT_COLUMNS =
  "id, order_id, provider, payment_status, refund_status, refunded_amount_cents, refunded_at, " +
  "subtotal_cents, tax_cents, total_cents, " +
  "currency, stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id, " +
  "stripe_livemode, checkout_expires_at, paid_at";
const UNPAID_PAYMENT_STATUSES = ["pending", "checkout_open", "expired", "failed"];
const RETRYABLE_EVENT_FILTER =
  "processing_status.eq.received,and(processing_status.eq.failed,processed_at.is.null)";

export function createSupabaseWebhookRepository(
  supabase: SupabaseClient,
): WebhookRepository {
  return {
    async registerEvent(input) {
      const { data, error } = await supabase
        .from("stripe_webhook_events")
        .insert({
          stripe_event_id: input.stripeEventId,
          event_type: input.eventType,
          stripe_livemode: input.stripeLivemode,
          stripe_object_id: input.stripeObjectId,
          // Metadata is not a database identity proof. A payment lookup must
          // succeed before a later conditional finalization may link this FK.
          order_id: null,
          processing_status: "received",
          stripe_created_at: input.stripeCreatedAt,
          received_at: input.receivedAt,
        })
        .select(EVENT_COLUMNS)
        .maybeSingle();
      if (error) {
        if (error.code === "23505") return null;
        throw new WebhookRepositoryError();
      }
      if (!data) throw new WebhookRepositoryError();
      return data as unknown as StripeWebhookEventRecord;
    },

    async getEvent(stripeEventId) {
      const { data, error } = await supabase
        .from("stripe_webhook_events")
        .select(EVENT_COLUMNS)
        .eq("stripe_event_id", stripeEventId)
        .maybeSingle();
      if (error) throw new WebhookRepositoryError();
      return (data as unknown as StripeWebhookEventRecord | null) ?? null;
    },

    async finishEvent(input) {
      const { data, error } = await supabase
        .from("stripe_webhook_events")
        .update({
          processing_status: input.status,
          processed_at: input.processedAt,
          error_message: input.errorMessage,
          ...(input.orderId ? { order_id: input.orderId } : {}),
        })
        .eq("stripe_event_id", input.stripeEventId)
        .or(RETRYABLE_EVENT_FILTER)
        .select("stripe_event_id")
        .maybeSingle();
      if (error) throw new WebhookRepositoryError();
      return Boolean(data);
    },

    async getPayment(orderId) {
      const { data, error } = await supabase
        .from("order_payments")
        .select(PAYMENT_COLUMNS)
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw new WebhookRepositoryError();
      return (data as unknown as WebhookPaymentRecord | null) ?? null;
    },

    async getPaymentByPaymentIntent(stripePaymentIntentId) {
      const { data, error } = await supabase
        .from("order_payments")
        .select(PAYMENT_COLUMNS)
        .eq("stripe_payment_intent_id", stripePaymentIntentId)
        .maybeSingle();
      if (error) throw new WebhookRepositoryError();
      return (data as unknown as WebhookPaymentRecord | null) ?? null;
    },

    async markPaid(input) {
      let query = supabase
        .from("order_payments")
        .update({
          payment_status: "paid",
          stripe_checkout_session_id: input.stripeCheckoutSessionId,
          stripe_payment_intent_id: input.stripePaymentIntentId,
          stripe_customer_id: input.stripeCustomerId,
          tax_cents: input.taxCents,
          total_cents: input.totalCents,
          paid_at: input.paidAt,
          checkout_expires_at: null,
        })
        .eq("id", input.payment.id)
        .eq("order_id", input.payment.order_id)
        .eq("provider", "stripe")
        .eq("stripe_livemode", input.payment.stripe_livemode)
        .eq("currency", input.payment.currency)
        .eq("subtotal_cents", input.payment.subtotal_cents)
        .in("payment_status", UNPAID_PAYMENT_STATUSES)
        .is("paid_at", null);
      query = withExpectedStripeIds(query, input.payment);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) throw new WebhookRepositoryError();
      return Boolean(data);
    },

    async markFailed(input) {
      let query = supabase
        .from("order_payments")
        .update({
          payment_status: "failed",
          stripe_checkout_session_id: input.stripeCheckoutSessionId,
          stripe_payment_intent_id: input.stripePaymentIntentId,
          checkout_expires_at: null,
        })
        .eq("id", input.payment.id)
        .eq("order_id", input.payment.order_id)
        .eq("provider", "stripe")
        .eq("stripe_livemode", input.payment.stripe_livemode)
        .eq("currency", input.payment.currency)
        .eq("subtotal_cents", input.payment.subtotal_cents)
        .in("payment_status", UNPAID_PAYMENT_STATUSES)
        .is("paid_at", null);
      query = withExpectedStripeIds(query, input.payment);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) throw new WebhookRepositoryError();
      return Boolean(data);
    },

    async markExpired(input) {
      let query = supabase
        .from("order_payments")
        .update({ payment_status: "expired", checkout_expires_at: null })
        .eq("id", input.payment.id)
        .eq("order_id", input.payment.order_id)
        .eq("provider", "stripe")
        .eq("stripe_livemode", input.payment.stripe_livemode)
        .eq("currency", input.payment.currency)
        .eq("subtotal_cents", input.payment.subtotal_cents)
        .eq("payment_status", "checkout_open")
        .eq("stripe_checkout_session_id", input.stripeCheckoutSessionId)
        .is("paid_at", null);
      query = withExpectedStripePaymentIntent(query, input.payment);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) throw new WebhookRepositoryError();
      return Boolean(data);
    },

    async syncRefund(input) {
      let query = supabase
        .from("order_payments")
        .update({
          refund_status: input.refundStatus,
          refunded_amount_cents: input.refundedAmountCents,
          refunded_at: input.refundedAt,
        })
        .eq("id", input.payment.id)
        .eq("order_id", input.payment.order_id)
        .eq("provider", "stripe")
        .eq("payment_status", "paid")
        .eq("refund_status", input.payment.refund_status)
        .eq("refunded_amount_cents", input.payment.refunded_amount_cents)
        .eq("stripe_livemode", input.payment.stripe_livemode)
        .eq("currency", input.payment.currency)
        .eq("subtotal_cents", input.payment.subtotal_cents);
      query = withExpectedStripeIds(query, input.payment);
      query = input.payment.total_cents === null
        ? query.is("total_cents", null)
        : query.eq("total_cents", input.payment.total_cents);
      query = input.payment.paid_at === null
        ? query.is("paid_at", null)
        : query.eq("paid_at", input.payment.paid_at);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) throw new WebhookRepositoryError();
      return Boolean(data);
    },
  };
}

function withExpectedStripeIds<T extends { is(column: string, value: null): T; eq(column: string, value: string): T }>(
  query: T,
  payment: WebhookPaymentRecord,
): T {
  const withSession = payment.stripe_checkout_session_id === null
    ? query.is("stripe_checkout_session_id", null)
    : query.eq("stripe_checkout_session_id", payment.stripe_checkout_session_id);
  return withExpectedStripePaymentIntent(withSession, payment);
}

function withExpectedStripePaymentIntent<T extends { is(column: string, value: null): T; eq(column: string, value: string): T }>(
  query: T,
  payment: WebhookPaymentRecord,
): T {
  return payment.stripe_payment_intent_id === null
    ? query.is("stripe_payment_intent_id", null)
    : query.eq("stripe_payment_intent_id", payment.stripe_payment_intent_id);
}
