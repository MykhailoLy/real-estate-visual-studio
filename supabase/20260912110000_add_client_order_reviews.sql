-- ============================================================
-- MIGRATION: add_client_order_reviews
-- One immutable client rating/comment per delivered order.
--
-- Manual migration only. Apply before deploying the application code.
-- Installing this migration does not create or backfill review rows.
-- Browser roles receive no table access and cannot execute the write RPC.
-- Prerequisites: the current public.orders, public.order_deliverables, and
-- public.deliverable_reviews tables, auth.users, pgcrypto, and the service_role
-- database role.
-- This is a forward-only migration; dropping it later would destroy reviews.
-- Re-running it against the exact target state is a no-op apart from replacing
-- the function with the same definition. Do not use it to coerce an unexpected
-- pre-existing object; stop and compare that catalog state before proceeding.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.client_order_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL
    REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT client_order_reviews_order_id_key UNIQUE (order_id),
  CONSTRAINT client_order_reviews_rating_check
    CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT client_order_reviews_comment_length_check
    CHECK (comment IS NULL OR char_length(comment) <= 2000)
);

COMMENT ON TABLE public.client_order_reviews IS
  'One immutable client rating and optional comment per delivered order.';

CREATE INDEX IF NOT EXISTS client_order_reviews_user_id_idx
  ON public.client_order_reviews (user_id);

ALTER TABLE public.client_order_reviews ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.client_order_reviews FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT ON TABLE public.client_order_reviews TO service_role;

-- The application calls this only after getClientUser() validates the session.
-- The order row lock makes ownership and delivery status stable until insert.
-- Eligibility also requires registered, non-expired deliverable metadata and no
-- active rework. UNIQUE(order_id) remains the final concurrent-duplicate guard.
CREATE OR REPLACE FUNCTION public.create_client_order_review(
  p_order_id UUID,
  p_user_id UUID,
  p_user_email TEXT,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL
)
RETURNS TABLE (
  outcome TEXT,
  review_id UUID,
  order_id UUID,
  user_id UUID,
  rating SMALLINT,
  comment TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order_user_id UUID;
  v_order_client_email TEXT;
  v_order_status TEXT;
  v_review public.client_order_reviews%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR NULLIF(pg_catalog.btrim(p_user_email), '') IS NULL THEN
    outcome := 'not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT orders.user_id, orders.client_email, orders.status
    INTO v_order_user_id, v_order_client_email, v_order_status
  FROM public.orders AS orders
  WHERE orders.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    outcome := 'not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  IF (
    v_order_user_id IS NOT NULL
    AND v_order_user_id IS DISTINCT FROM p_user_id
  ) OR (
    v_order_user_id IS NULL
    AND pg_catalog.lower(pg_catalog.btrim(v_order_client_email))
      IS DISTINCT FROM pg_catalog.lower(pg_catalog.btrim(p_user_email))
  ) THEN
    outcome := 'not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_order_status IS DISTINCT FROM 'delivered' THEN
    outcome := 'not_delivered';
    RETURN NEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_order_reviews AS reviews
    WHERE reviews.order_id = p_order_id
  ) THEN
    outcome := 'duplicate';
    RETURN NEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.deliverable_reviews AS deliverable_review
    WHERE deliverable_review.order_id = p_order_id
      AND deliverable_review.status IN (
        'rework_requested',
        'rework_in_progress'
      )
  ) THEN
    outcome := 'active_rework';
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.order_deliverables AS deliverable
    WHERE deliverable.order_id = p_order_id
      AND deliverable.file_size > 0
      AND NULLIF(pg_catalog.btrim(deliverable.storage_path), '') IS NOT NULL
      AND (
        deliverable.expires_at IS NULL
        OR deliverable.expires_at > pg_catalog.now()
      )
  ) THEN
    outcome := 'no_deliverables';
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.client_order_reviews (
    order_id,
    user_id,
    rating,
    comment
  )
  VALUES (
    p_order_id,
    p_user_id,
    p_rating,
    NULLIF(pg_catalog.btrim(p_comment), '')
  )
  ON CONFLICT ON CONSTRAINT client_order_reviews_order_id_key DO NOTHING
  RETURNING * INTO v_review;

  IF NOT FOUND THEN
    outcome := 'duplicate';
    RETURN NEXT;
    RETURN;
  END IF;

  outcome := 'created';
  review_id := v_review.id;
  order_id := v_review.order_id;
  user_id := v_review.user_id;
  rating := v_review.rating;
  comment := v_review.comment;
  created_at := v_review.created_at;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.create_client_order_review(UUID, UUID, TEXT, SMALLINT, TEXT) IS
  'Atomically creates one review after ownership, delivery, deliverable, and active-rework checks.';

REVOKE ALL ON FUNCTION public.create_client_order_review(UUID, UUID, TEXT, SMALLINT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_client_order_review(UUID, UUID, TEXT, SMALLINT, TEXT)
  TO service_role;

COMMIT;
