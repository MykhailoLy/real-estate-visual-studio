-- ============================================================
-- PicchuSpot: durable payment confirmation email
-- ============================================================
-- Manual additive migration. Apply before deploying application code that
-- renders the new payment_confirmation delivery kind.
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

CREATE OR REPLACE FUNCTION public.enqueue_order_payment_confirmation_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.provider = 'stripe'
     AND NEW.payment_status = 'paid'
     AND NEW.paid_at IS NOT NULL
     AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
    INSERT INTO public.order_email_deliveries (
      order_id,
      delivery_kind,
      idempotency_key,
      idempotency_expires_at
    ) VALUES (
      NEW.order_id,
      'payment_confirmation',
      'payment-confirmed-' || NEW.order_id::TEXT || '-client-v1',
      pg_catalog.now() + interval '24 hours'
    )
    ON CONFLICT (order_id, delivery_kind) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_payments_enqueue_payment_confirmation
  ON public.order_payments;
CREATE TRIGGER order_payments_enqueue_payment_confirmation
  AFTER UPDATE OF payment_status, paid_at ON public.order_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_order_payment_confirmation_email();

REVOKE ALL ON FUNCTION public.enqueue_order_payment_confirmation_email()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_order_payment_confirmation_email()
  TO service_role;

COMMIT;
