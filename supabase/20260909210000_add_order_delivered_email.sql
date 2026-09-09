-- Manual Supabase migration required before deploying the application code.
-- Prerequisites: add-atomic-order-submissions.sql and add-payment-confirmation-email.sql.
-- Also requires the existing order_deliverables and deliverable_reviews tables
-- and their updated_at triggers from the current migration lineage.
-- Additive/idempotent; no historical delivery backfill, RLS/grant changes to
-- tables, payment changes, or Storage changes. Never apply automatically.
BEGIN;

ALTER TABLE public.order_email_deliveries
  DROP CONSTRAINT IF EXISTS order_email_deliveries_kind_allowed;
ALTER TABLE public.order_email_deliveries
  ADD CONSTRAINT order_email_deliveries_kind_allowed
  CHECK (delivery_kind IN (
    'client_confirmation', 'admin_notification', 'payment_confirmation', 'order_delivered'
  ) OR delivery_kind ~ '^admin_replacement_ready:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- The review UUID scopes the existing event to one rework cycle. Keeping the
-- existing (order_id, delivery_kind) unique constraint means earlier order and
-- payment enqueue functions and every existing delivery row stay unchanged.

-- Called only by the new authenticated admin status route, after its existing
-- payment gate. Installing this migration alone does not activate new events.
CREATE OR REPLACE FUNCTION public.mark_order_delivered_with_email(p_order_id UUID)
RETURNS TABLE (id UUID, status TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_previous_status TEXT;
BEGIN
  SELECT orders.status INTO v_previous_status
    FROM public.orders AS orders
   WHERE orders.id = p_order_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.orders AS orders SET status = 'delivered'
   WHERE orders.id = p_order_id;

  IF v_previous_status IS DISTINCT FROM 'delivered' THEN
    INSERT INTO public.order_email_deliveries (
      order_id, delivery_kind, idempotency_key, idempotency_expires_at
    ) VALUES (
      p_order_id, 'order_delivered',
      'order-delivered-' || p_order_id::TEXT || '-client-v1',
      pg_catalog.now() + interval '24 hours'
    )
    ON CONFLICT (order_id, delivery_kind) DO NOTHING;
  END IF;
  RETURN QUERY SELECT orders.id, orders.status, orders.updated_at
    FROM public.orders AS orders WHERE orders.id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_order_delivered_with_email(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_delivered_with_email(UUID) TO service_role;

-- Storage verification remains in the admin route before this call. The DB
-- rechecks lifecycle and assignment under the update lock, then persists the
-- event atomically. Repeated/concurrent attachments return no row, no event.
CREATE OR REPLACE FUNCTION public.attach_replacement_with_email(
  p_review_id UUID,
  p_replacement_deliverable_id UUID
)
RETURNS TABLE (id UUID)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  UPDATE public.deliverable_reviews AS reviews
     SET replacement_deliverable_id = p_replacement_deliverable_id,
         status = 'rework_delivered'
    FROM public.order_deliverables AS replacement
   WHERE reviews.id = p_review_id
     AND reviews.status IN ('rework_requested', 'rework_in_progress')
     AND reviews.replacement_deliverable_id IS NULL
     AND replacement.id = p_replacement_deliverable_id
     AND replacement.id <> reviews.deliverable_id
     AND replacement.order_id = reviews.order_id
     AND replacement.item_index IS NOT DISTINCT FROM reviews.item_index
     AND (replacement.expires_at IS NULL OR replacement.expires_at > pg_catalog.now())
  RETURNING reviews.order_id INTO v_order_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.order_email_deliveries (
    order_id, delivery_kind, idempotency_key, idempotency_expires_at
  ) VALUES (
    v_order_id, 'admin_replacement_ready:' || p_review_id::TEXT,
    'review-' || p_review_id::TEXT || '-replacement-' || p_replacement_deliverable_id::TEXT || '-ready-v1',
    pg_catalog.now() + interval '24 hours'
  )
  ON CONFLICT (order_id, delivery_kind) DO NOTHING;

  RETURN QUERY SELECT p_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_replacement_with_email(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_replacement_with_email(UUID, UUID) TO service_role;

COMMIT;
