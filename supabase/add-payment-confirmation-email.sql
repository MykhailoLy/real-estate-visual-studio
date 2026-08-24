-- ============================================================
-- PicchuSpot: durable payment confirmation email
-- ============================================================
-- Manual additive migration. Apply before deploying application code that
-- enqueues the new payment_confirmation delivery kind.
-- Existing orders, payments, and email deliveries are not backfilled.

BEGIN;

ALTER TABLE public.order_email_deliveries
  DROP CONSTRAINT IF EXISTS order_email_deliveries_kind_allowed;
ALTER TABLE public.order_email_deliveries
  ADD CONSTRAINT order_email_deliveries_kind_allowed
  CHECK (delivery_kind IN (
    'client_confirmation',
    'admin_notification',
    'payment_confirmation'
  ));

COMMENT ON TABLE public.order_email_deliveries IS
  'Server-only order lifecycle email outbox. It stores delivery state and hashes, never rendered bodies, signed URLs, or secrets.';

CREATE OR REPLACE FUNCTION public.enqueue_order_payment_confirmation_email(
  p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payment public.order_payments%ROWTYPE;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order id is required';
  END IF;

  SELECT payments.*
    INTO v_payment
    FROM public.order_payments AS payments
   WHERE payments.order_id = p_order_id
   FOR UPDATE;

  IF NOT FOUND
     OR v_payment.provider IS DISTINCT FROM 'stripe'
     OR v_payment.payment_status IS DISTINCT FROM 'paid'
     OR v_payment.paid_at IS NULL
     OR v_payment.refund_status IS DISTINCT FROM 'none'
     OR v_payment.refunded_amount_cents IS DISTINCT FROM 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.order_email_deliveries (
    order_id,
    delivery_kind,
    idempotency_key,
    idempotency_expires_at
  ) VALUES (
    p_order_id,
    'payment_confirmation',
    'payment-confirmed-' || p_order_id::TEXT || '-client-v1',
    pg_catalog.now() + interval '24 hours'
  )
  ON CONFLICT (order_id, delivery_kind) DO NOTHING;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_order_payment_confirmation_email(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_order_payment_confirmation_email(UUID)
  TO service_role;

COMMIT;
