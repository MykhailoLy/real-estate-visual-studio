-- ============================================================
-- MIGRATION: add_stripe_payment_data_model
--
-- Creates server-managed payment and webhook-event records for a future
-- Stripe Checkout integration. Run manually in the Supabase SQL Editor
-- after review. Do NOT execute automatically through Supabase CLI.
--
-- This migration deliberately does not backfill payment rows, modify
-- existing orders, or change order fulfillment statuses.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------
-- TABLE: order_payments
-- -----------------------------------------------------------
-- A payment record belongs to exactly one order. RESTRICT preserves
-- financial history by preventing an order from being deleted while its
-- payment record exists; payment records must be handled explicitly first.
CREATE TABLE IF NOT EXISTS public.order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE
    REFERENCES public.orders(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'stripe'
    CONSTRAINT order_payments_provider_allowed CHECK (provider = 'stripe'),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT order_payments_payment_status_allowed CHECK (
      payment_status IN ('pending', 'checkout_open', 'paid', 'expired', 'failed')
    ),
  refund_status TEXT NOT NULL DEFAULT 'none'
    CONSTRAINT order_payments_refund_status_allowed CHECK (
      refund_status IN ('none', 'partial', 'full')
    ),
  currency TEXT NOT NULL DEFAULT 'usd'
    CONSTRAINT order_payments_currency_lowercase_iso CHECK (
      currency ~ '^[a-z]{3}$'
    ),
  subtotal_cents INTEGER NOT NULL
    CONSTRAINT order_payments_subtotal_cents_non_negative CHECK (subtotal_cents >= 0),
  tax_cents INTEGER NULL
    CONSTRAINT order_payments_tax_cents_non_negative CHECK (
      tax_cents IS NULL OR tax_cents >= 0
    ),
  total_cents INTEGER NULL
    CONSTRAINT order_payments_total_cents_non_negative CHECK (
      total_cents IS NULL OR total_cents >= 0
    ),
  stripe_checkout_session_id TEXT NULL UNIQUE,
  stripe_payment_intent_id TEXT NULL UNIQUE,
  stripe_customer_id TEXT NULL,
  stripe_livemode BOOLEAN NULL,
  checkout_attempt INTEGER NOT NULL DEFAULT 0
    CONSTRAINT order_payments_checkout_attempt_non_negative CHECK (checkout_attempt >= 0),
  checkout_expires_at TIMESTAMPTZ NULL,
  paid_at TIMESTAMPTZ NULL,
  refunded_amount_cents INTEGER NOT NULL DEFAULT 0
    CONSTRAINT order_payments_refunded_amount_cents_non_negative CHECK (
      refunded_amount_cents >= 0
    ),
  refunded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.order_payments IS
  'Server-managed Stripe payment records. No browser role receives direct access; service-role server code owns all reads and mutations.';

COMMENT ON COLUMN public.order_payments.subtotal_cents IS
  'Authoritative server-calculated pre-tax amount in the payment currency''s minor unit.';

COMMENT ON COLUMN public.order_payments.refund_status IS
  'Refund lifecycle is independent from payment_status so paid payments retain their payment history after refunds.';

-- -----------------------------------------------------------
-- TABLE: stripe_webhook_events
-- -----------------------------------------------------------
-- Event rows intentionally keep only reconciliation metadata. Raw Stripe
-- payloads, card details, billing addresses, customer data, and secrets are
-- not stored here.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_livemode BOOLEAN NOT NULL,
  stripe_object_id TEXT NULL,
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  processing_status TEXT NOT NULL DEFAULT 'received'
    CONSTRAINT stripe_webhook_events_processing_status_allowed CHECK (
      processing_status IN ('received', 'processed', 'ignored', 'failed')
    ),
  stripe_created_at TIMESTAMPTZ NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NULL,
  error_message TEXT NULL
);

COMMENT ON TABLE public.stripe_webhook_events IS
  'Server-managed Stripe webhook idempotency and audit metadata. Raw webhook payloads and customer payment data are intentionally not stored.';

COMMENT ON COLUMN public.stripe_webhook_events.error_message IS
  'Sanitized internal processing error only; never store raw payloads, card data, addresses, customer data, or secrets.';

-- -----------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------
-- order_id and Stripe identifiers already have unique indexes from their
-- constraints. These indexes support future server-side status, expiry,
-- retry, and order-history queries without duplicating those indexes.
CREATE INDEX IF NOT EXISTS idx_order_payments_payment_status_created
  ON public.order_payments (payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_payments_checkout_expiry_open
  ON public.order_payments (checkout_expires_at)
  WHERE payment_status IN ('pending', 'checkout_open')
    AND checkout_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_order_received
  ON public.stripe_webhook_events (order_id, received_at DESC)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processing_received
  ON public.stripe_webhook_events (processing_status, received_at);

-- -----------------------------------------------------------
-- UPDATED_AT TRIGGER
-- -----------------------------------------------------------
-- Reuses the project-wide helper from supabase/schema.sql.
DROP TRIGGER IF EXISTS order_payments_updated_at ON public.order_payments;
CREATE TRIGGER order_payments_updated_at
  BEFORE UPDATE ON public.order_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- -----------------------------------------------------------
-- ROW LEVEL SECURITY AND GRANTS
-- -----------------------------------------------------------
-- Both tables are server-only. No client-facing policies are created, and
-- anon/authenticated are explicitly denied table privileges. service_role
-- retains trusted server-side access and bypasses RLS.
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO service_role;

REVOKE ALL ON public.order_payments FROM anon, authenticated;
REVOKE ALL ON public.stripe_webhook_events FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_webhook_events TO service_role;

-- No policies are intentionally defined: payment and webhook records must
-- only be read or mutated by trusted server-side service-role code.

-- ============================================================
-- Manual rollback, only before any payment or webhook history must be kept:
-- DROP TABLE IF EXISTS public.stripe_webhook_events;
-- DROP TABLE IF EXISTS public.order_payments;
-- ============================================================
