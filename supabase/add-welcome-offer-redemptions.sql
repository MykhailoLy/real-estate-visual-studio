-- Additive two-phase rollout for per-account Welcome Offer redemption.
-- Apply this file before deploying the application that calls the versioned RPC.
-- Existing rows are not backfilled and the existing commit_order_submission RPC
-- remains unchanged for compatibility with the previously deployed application.

BEGIN;

CREATE TABLE IF NOT EXISTS public.welcome_offer_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  benefit_key TEXT NOT NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id)
    DEFERRABLE INITIALLY DEFERRED,
  welcome_offer_version TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT welcome_offer_redemptions_allowed_benefit_check CHECK (
    benefit_key IN (
      'image-enhancement-free',
      'day-to-dusk-free',
      'virtual-staging-first-image-50'
    )
  ),
  CONSTRAINT welcome_offer_redemptions_user_benefit_key UNIQUE (
    user_id,
    benefit_key
  )
);

ALTER TABLE public.welcome_offer_redemptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.welcome_offer_redemptions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.welcome_offer_redemptions
  TO service_role;

CREATE OR REPLACE FUNCTION public.commit_order_submission_with_welcome_offer_v1(
  p_user_id UUID,
  p_submission_id UUID,
  p_request_hash TEXT,
  p_lease_token UUID,
  p_client_name TEXT,
  p_client_email TEXT,
  p_client_phone TEXT,
  p_client_company TEXT,
  p_job_title TEXT,
  p_items JSONB,
  p_draft_expected_version INTEGER DEFAULT NULL,
  p_draft_finalization_key UUID DEFAULT NULL,
  p_draft_moved_files JSONB DEFAULT NULL,
  p_welcome_offer_benefit_keys TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE (
  result_code TEXT,
  created BOOLEAN,
  order_id UUID,
  order_number TEXT,
  estimated_total_cents INTEGER,
  currency TEXT,
  pricing_snapshot JSONB,
  item_count INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_submission public.order_submissions%ROWTYPE;
  v_snapshot_keys TEXT[];
  v_inserted INTEGER := 0;
  v_benefit JSONB;
  v_result_code TEXT;
  v_created BOOLEAN;
  v_order_id UUID;
  v_order_number TEXT;
  v_estimated_total_cents INTEGER;
  v_currency TEXT;
  v_pricing_snapshot JSONB;
  v_item_count INTEGER;
BEGIN
  SELECT submissions.*
    INTO v_submission
    FROM public.order_submissions AS submissions
   WHERE submissions.submission_id = p_submission_id
   FOR UPDATE;

  IF NOT FOUND OR v_submission.user_id IS DISTINCT FROM p_user_id THEN
    RETURN QUERY SELECT
      'not_found'::TEXT, FALSE, NULL::UUID, NULL::TEXT,
      NULL::INTEGER, NULL::TEXT, NULL::JSONB, NULL::INTEGER;
    RETURN;
  END IF;

  IF v_submission.request_hash IS DISTINCT FROM p_request_hash THEN
    RETURN QUERY SELECT
      'payload_conflict'::TEXT, FALSE, NULL::UUID, NULL::TEXT,
      NULL::INTEGER, NULL::TEXT, NULL::JSONB, NULL::INTEGER;
    RETURN;
  END IF;

  -- Idempotent replays use the already committed immutable snapshot. They do
  -- not attempt another redemption and remain valid after eligibility changes.
  IF v_submission.status = 'committed' THEN
    RETURN QUERY
      SELECT committed.*
        FROM public.commit_order_submission(
          p_user_id,
          p_submission_id,
          p_request_hash,
          p_lease_token,
          p_client_name,
          p_client_email,
          p_client_phone,
          p_client_company,
          p_job_title,
          p_items,
          p_draft_expected_version,
          p_draft_finalization_key,
          p_draft_moved_files
        ) AS committed;
    RETURN;
  END IF;

  IF v_submission.lease_token IS DISTINCT FROM p_lease_token
     OR v_submission.lease_expires_at <= pg_catalog.now() THEN
    RETURN QUERY SELECT
      'lease_conflict'::TEXT, FALSE, NULL::UUID, NULL::TEXT,
      NULL::INTEGER, NULL::TEXT, NULL::JSONB, NULL::INTEGER;
    RETURN;
  END IF;

  IF p_welcome_offer_benefit_keys IS NULL
     OR pg_catalog.cardinality(p_welcome_offer_benefit_keys) > 1
     OR EXISTS (
       SELECT 1
         FROM pg_catalog.unnest(p_welcome_offer_benefit_keys) AS supplied(key)
        WHERE supplied.key NOT IN (
          'image-enhancement-free',
          'day-to-dusk-free',
          'virtual-staging-first-image-50'
        )
     ) THEN
    RAISE EXCEPTION 'invalid Welcome Offer benefit keys';
  END IF;

  IF pg_catalog.jsonb_typeof(v_submission.pricing_snapshot->'welcomeOffer')
       IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(
       v_submission.pricing_snapshot->'welcomeOffer'->'benefits'
     ) IS DISTINCT FROM 'array'
     OR (v_submission.pricing_snapshot->>'welcomeDiscountCents') !~ '^[0-9]+$'
     OR (
       v_submission.pricing_snapshot->'welcomeOffer'->>'totalDiscountCents'
     ) !~ '^[0-9]+$'
     OR (v_submission.pricing_snapshot->>'welcomeDiscountCents')::INTEGER
       IS DISTINCT FROM (
         v_submission.pricing_snapshot->'welcomeOffer'->>'totalDiscountCents'
       )::INTEGER THEN
    RAISE EXCEPTION 'stored Welcome Offer pricing evidence is invalid';
  END IF;

  SELECT pg_catalog.coalesce(
           pg_catalog.array_agg(benefit.value->>'key' ORDER BY benefit.ordinal),
           ARRAY[]::TEXT[]
         )
    INTO v_snapshot_keys
    FROM pg_catalog.jsonb_array_elements(
      v_submission.pricing_snapshot->'welcomeOffer'->'benefits'
    ) WITH ORDINALITY AS benefit(value, ordinal);

  IF v_snapshot_keys IS DISTINCT FROM p_welcome_offer_benefit_keys THEN
    RAISE EXCEPTION 'supplied Welcome Offer keys do not match stored pricing';
  END IF;

  IF pg_catalog.cardinality(v_snapshot_keys) = 0 THEN
    IF (v_submission.pricing_snapshot->>'welcomeDiscountCents')::INTEGER <> 0 THEN
      RAISE EXCEPTION 'Welcome Offer discount has no benefit evidence';
    END IF;
  ELSE
    IF (v_submission.pricing_snapshot->'welcomeOffer'->>'version')
         IS DISTINCT FROM '2026-08-29'
       OR (v_submission.pricing_snapshot->>'welcomeDiscountCents')::INTEGER <= 0
       OR pg_catalog.jsonb_array_length(
         v_submission.pricing_snapshot->'welcomeOffer'->'benefits'
       ) <> 1 THEN
      RAISE EXCEPTION 'Welcome Offer version or benefit count is invalid';
    END IF;

    v_benefit := v_submission.pricing_snapshot->'welcomeOffer'->'benefits'->0;
    IF (v_benefit->>'itemIndex') IS DISTINCT FROM '0'
       OR (v_benefit->>'discountCents') !~ '^[0-9]+$'
       OR (v_benefit->>'discountCents')::INTEGER IS DISTINCT FROM
          (v_submission.pricing_snapshot->>'welcomeDiscountCents')::INTEGER
       OR (v_submission.pricing_snapshot->'items'->0->>'priceKey')
          IS DISTINCT FROM (v_benefit->>'priceKey') THEN
      RAISE EXCEPTION 'Welcome Offer item evidence is invalid';
    END IF;

    IF v_snapshot_keys[1] = 'virtual-staging-first-image-50' THEN
      IF v_submission.service_type IS DISTINCT FROM 'virtual-staging'
         OR (v_benefit->>'priceKey') IS DISTINCT FROM 'virtual-staging'
         OR (v_benefit->>'discountPercent') IS DISTINCT FROM '50'
         OR (v_benefit->>'discountCents')::INTEGER IS DISTINCT FROM
            (
              (
                v_submission.pricing_snapshot->'items'->0->>'baseSubtotalCents'
              )::INTEGER * 50 + 50
            ) / 100 THEN
        RAISE EXCEPTION 'Virtual Staging Welcome Offer evidence is invalid';
      END IF;
    ELSIF v_snapshot_keys[1] = 'image-enhancement-free' THEN
      IF v_submission.service_type IS DISTINCT FROM 'photo-editing'
         OR (v_benefit->>'priceKey') IS DISTINCT FROM 'image-enhancement'
         OR (v_benefit->>'discountPercent') IS DISTINCT FROM '100'
         OR (v_benefit->>'discountCents')::INTEGER IS DISTINCT FROM
            (v_submission.pricing_snapshot->'items'->0->>'baseSubtotalCents')::INTEGER
         OR EXISTS (
           SELECT 1
             FROM pg_catalog.jsonb_array_elements(p_items) AS item(value)
            WHERE item.value->'details'->>'sub_service'
              IS DISTINCT FROM 'image-enhancement-single-exposure'
         ) THEN
        RAISE EXCEPTION 'Image Enhancement Welcome Offer evidence is invalid';
      END IF;
    ELSIF v_snapshot_keys[1] = 'day-to-dusk-free' THEN
      IF v_submission.service_type IS DISTINCT FROM 'photo-editing'
         OR (v_benefit->>'priceKey') IS DISTINCT FROM 'day-to-dusk'
         OR (v_benefit->>'discountPercent') IS DISTINCT FROM '100'
         OR (v_benefit->>'discountCents')::INTEGER IS DISTINCT FROM
            (v_submission.pricing_snapshot->'items'->0->>'baseSubtotalCents')::INTEGER
         OR EXISTS (
           SELECT 1
             FROM pg_catalog.jsonb_array_elements(p_items) AS item(value)
            WHERE item.value->'details'->>'sub_service'
              IS DISTINCT FROM 'day-to-dusk'
         ) THEN
        RAISE EXCEPTION 'Day to Dusk Welcome Offer evidence is invalid';
      END IF;
    END IF;

    INSERT INTO public.welcome_offer_redemptions (
      user_id,
      benefit_key,
      order_id,
      welcome_offer_version
    )
    SELECT
      p_user_id,
      benefit.key,
      v_submission.reserved_order_id,
      v_submission.pricing_snapshot->'welcomeOffer'->>'version'
    FROM pg_catalog.unnest(v_snapshot_keys) AS benefit(key)
    ON CONFLICT (user_id, benefit_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    IF v_inserted IS DISTINCT FROM pg_catalog.cardinality(v_snapshot_keys) THEN
      DELETE FROM public.welcome_offer_redemptions AS redemptions
       WHERE redemptions.order_id = v_submission.reserved_order_id;
      -- This definite loser has no production order. Remove only its claim so
      -- a draft (whose submission ID is stable) can be repriced and retried.
      DELETE FROM public.order_submissions AS submissions
       WHERE submissions.submission_id = p_submission_id
         AND submissions.status = 'processing'
         AND submissions.lease_token IS NOT DISTINCT FROM p_lease_token;
      RETURN QUERY SELECT
        'welcome_offer_conflict'::TEXT, FALSE, NULL::UUID, NULL::TEXT,
        NULL::INTEGER, NULL::TEXT, NULL::JSONB, NULL::INTEGER;
      RETURN;
    END IF;
  END IF;

  SELECT committed.result_code,
         committed.created,
         committed.order_id,
         committed.order_number,
         committed.estimated_total_cents,
         committed.currency,
         committed.pricing_snapshot,
         committed.item_count
    INTO v_result_code,
         v_created,
         v_order_id,
         v_order_number,
         v_estimated_total_cents,
         v_currency,
         v_pricing_snapshot,
         v_item_count
    FROM public.commit_order_submission(
      p_user_id,
      p_submission_id,
      p_request_hash,
      p_lease_token,
      p_client_name,
      p_client_email,
      p_client_phone,
      p_client_company,
      p_job_title,
      p_items,
      p_draft_expected_version,
      p_draft_finalization_key,
      p_draft_moved_files
    ) AS committed;

  IF v_result_code NOT IN ('created', 'replayed') THEN
    DELETE FROM public.welcome_offer_redemptions AS redemptions
     WHERE redemptions.order_id = v_submission.reserved_order_id;
  END IF;

  RETURN QUERY SELECT
    v_result_code,
    v_created,
    v_order_id,
    v_order_number,
    v_estimated_total_cents,
    v_currency,
    v_pricing_snapshot,
    v_item_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.commit_order_submission_with_welcome_offer_v1(
  UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, UUID,
  JSONB, TEXT[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_order_submission_with_welcome_offer_v1(
  UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, UUID,
  JSONB, TEXT[]
) TO service_role;

COMMIT;
