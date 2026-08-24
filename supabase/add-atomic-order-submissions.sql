-- ============================================================
-- PicchuSpot: atomic, idempotent order creation
-- ============================================================
-- Manual additive migration. Apply before deploying the application code
-- that calls these RPCs. Do not run automatically from application code.
-- Existing orders are not backfilled or modified.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.order_submissions (
  submission_id UUID PRIMARY KEY,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  request_hash TEXT NOT NULL,
  request_schema_version SMALLINT NOT NULL DEFAULT 1,
  service_type TEXT NOT NULL,
  source_draft_id UUID NULL
    REFERENCES public.order_drafts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  lease_token UUID NULL,
  lease_expires_at TIMESTAMPTZ NULL,
  reserved_order_id UUID NOT NULL UNIQUE,
  reserved_order_number TEXT NOT NULL UNIQUE,
  order_id UUID NULL UNIQUE
    REFERENCES public.orders(id) ON DELETE RESTRICT,
  currency TEXT NOT NULL,
  pricing_version TEXT NOT NULL,
  quote_hash TEXT NOT NULL,
  estimated_total_cents INTEGER NOT NULL,
  pricing_snapshot JSONB NOT NULL,
  last_error_code TEXT NULL,
  committed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT order_submissions_request_hash_sha256
    CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT order_submissions_quote_hash_sha256
    CHECK (quote_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT order_submissions_schema_version_positive
    CHECK (request_schema_version > 0),
  CONSTRAINT order_submissions_service_type_allowed
    CHECK (service_type IN (
      'virtual-staging',
      'virtual-renovation',
      '3d-floor-plans',
      'photo-editing'
    )),
  CONSTRAINT order_submissions_status_allowed
    CHECK (status IN ('processing', 'committed')),
  CONSTRAINT order_submissions_currency_allowed
    CHECK (currency IN ('USD', 'EUR', 'CAD')),
  CONSTRAINT order_submissions_total_nonnegative
    CHECK (estimated_total_cents >= 0),
  CONSTRAINT order_submissions_snapshot_is_object
    CHECK (jsonb_typeof(pricing_snapshot) = 'object'),
  CONSTRAINT order_submissions_lease_pair
    CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL)),
  CONSTRAINT order_submissions_commit_state
    CHECK (
      (status = 'processing' AND order_id IS NULL AND committed_at IS NULL)
      OR
      (status = 'committed'
        AND order_id IS NOT NULL
        AND order_id = reserved_order_id
        AND committed_at IS NOT NULL
        AND lease_token IS NULL
        AND lease_expires_at IS NULL)
    )
);

COMMENT ON TABLE public.order_submissions IS
  'Server-only durable claims and replay results for logical customer order submissions.';
COMMENT ON COLUMN public.order_submissions.request_hash IS
  'Server-generated SHA-256 of canonical validated customer intent and immutable upload descriptors. Excludes derived pricing.';
COMMENT ON COLUMN public.order_submissions.quote_hash IS
  'Server-generated SHA-256 of the authoritative canonical quote at first claim.';

CREATE UNIQUE INDEX IF NOT EXISTS order_submissions_source_draft_unique
  ON public.order_submissions (source_draft_id)
  WHERE source_draft_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_submissions_user_created
  ON public.order_submissions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_submissions_processing_lease
  ON public.order_submissions (lease_expires_at)
  WHERE status = 'processing';

DROP TRIGGER IF EXISTS order_submissions_updated_at
  ON public.order_submissions;
CREATE TRIGGER order_submissions_updated_at
  BEFORE UPDATE ON public.order_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.order_email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL
    REFERENCES public.orders(id) ON DELETE RESTRICT,
  delivery_kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL UNIQUE,
  idempotency_expires_at TIMESTAMPTZ NOT NULL,
  payload_hash TEXT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  claim_token UUID NULL,
  lease_expires_at TIMESTAMPTZ NULL,
  provider_message_id TEXT NULL,
  last_error_code TEXT NULL,
  last_attempt_at TIMESTAMPTZ NULL,
  sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT order_email_deliveries_kind_allowed
    CHECK (delivery_kind IN ('client_confirmation', 'admin_notification')),
  CONSTRAINT order_email_deliveries_status_allowed
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'unknown')),
  CONSTRAINT order_email_deliveries_attempt_nonnegative
    CHECK (attempt_count >= 0),
  CONSTRAINT order_email_deliveries_payload_hash_sha256
    CHECK (payload_hash IS NULL OR payload_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT order_email_deliveries_claim_pair
    CHECK ((claim_token IS NULL) = (lease_expires_at IS NULL)),
  CONSTRAINT order_email_deliveries_order_kind_unique
    UNIQUE (order_id, delivery_kind)
);

COMMENT ON TABLE public.order_email_deliveries IS
  'Server-only order-created email outbox. It stores delivery state and hashes, never rendered bodies, signed URLs, or secrets.';

CREATE INDEX IF NOT EXISTS idx_order_email_deliveries_retryable
  ON public.order_email_deliveries (status, idempotency_expires_at, created_at)
  WHERE status IN ('pending', 'failed', 'unknown', 'sending');

DROP TRIGGER IF EXISTS order_email_deliveries_updated_at
  ON public.order_email_deliveries;
CREATE TRIGGER order_email_deliveries_updated_at
  BEFORE UPDATE ON public.order_email_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.order_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_email_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.order_submissions
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.order_email_deliveries
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_submissions
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_email_deliveries
  TO service_role;

-- A claim is a short transaction. The advisory transaction lock prevents two
-- first requests from reserving different order numbers for one submission.
CREATE OR REPLACE FUNCTION public.claim_order_submission(
  p_user_id UUID,
  p_submission_id UUID,
  p_request_hash TEXT,
  p_request_schema_version SMALLINT,
  p_service_type TEXT,
  p_source_draft_id UUID,
  p_lease_token UUID,
  p_currency TEXT,
  p_pricing_version TEXT,
  p_quote_hash TEXT,
  p_estimated_total_cents INTEGER,
  p_pricing_snapshot JSONB
)
RETURNS TABLE (
  result_code TEXT,
  submission_id UUID,
  lease_token UUID,
  reserved_order_id UUID,
  reserved_order_number TEXT,
  order_id UUID,
  estimated_total_cents INTEGER,
  currency TEXT,
  pricing_snapshot JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_submission public.order_submissions%ROWTYPE;
  v_reserved_order_id UUID;
  v_reserved_order_number TEXT;
  v_lease_cutoff TIMESTAMPTZ := pg_catalog.now() + interval '10 minutes';
BEGIN
  IF p_user_id IS NULL
     OR p_submission_id IS NULL
     OR p_lease_token IS NULL
     OR p_request_hash !~ '^[0-9a-f]{64}$'
     OR p_quote_hash !~ '^[0-9a-f]{64}$'
     OR p_request_schema_version < 1
     OR p_estimated_total_cents < 0
     OR pg_catalog.jsonb_typeof(p_pricing_snapshot) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid order submission claim';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_submission_id::TEXT, 0)
  );

  SELECT submissions.*
    INTO v_submission
    FROM public.order_submissions AS submissions
   WHERE submissions.submission_id = p_submission_id
   FOR UPDATE;

  IF NOT FOUND THEN
    v_reserved_order_id := gen_random_uuid();
    v_reserved_order_number := public.generate_order_number(p_service_type);

    INSERT INTO public.order_submissions (
      submission_id,
      user_id,
      request_hash,
      request_schema_version,
      service_type,
      source_draft_id,
      status,
      lease_token,
      lease_expires_at,
      reserved_order_id,
      reserved_order_number,
      currency,
      pricing_version,
      quote_hash,
      estimated_total_cents,
      pricing_snapshot
    ) VALUES (
      p_submission_id,
      p_user_id,
      p_request_hash,
      p_request_schema_version,
      p_service_type,
      p_source_draft_id,
      'processing',
      p_lease_token,
      v_lease_cutoff,
      v_reserved_order_id,
      v_reserved_order_number,
      p_currency,
      p_pricing_version,
      p_quote_hash,
      p_estimated_total_cents,
      p_pricing_snapshot
    )
    RETURNING * INTO v_submission;

    RETURN QUERY SELECT
      'claimed'::TEXT,
      v_submission.submission_id,
      v_submission.lease_token,
      v_submission.reserved_order_id,
      v_submission.reserved_order_number,
      v_submission.order_id,
      v_submission.estimated_total_cents,
      v_submission.currency,
      v_submission.pricing_snapshot;
    RETURN;
  END IF;

  IF v_submission.user_id IS DISTINCT FROM p_user_id THEN
    RETURN QUERY SELECT
      'not_found'::TEXT, NULL::UUID, NULL::UUID, NULL::UUID, NULL::TEXT,
      NULL::UUID, NULL::INTEGER, NULL::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  IF v_submission.request_hash IS DISTINCT FROM p_request_hash
     OR v_submission.request_schema_version IS DISTINCT FROM p_request_schema_version
     OR v_submission.service_type IS DISTINCT FROM p_service_type
     OR v_submission.source_draft_id IS DISTINCT FROM p_source_draft_id THEN
    RETURN QUERY SELECT
      'payload_conflict'::TEXT,
      v_submission.submission_id,
      NULL::UUID,
      v_submission.reserved_order_id,
      v_submission.reserved_order_number,
      v_submission.order_id,
      v_submission.estimated_total_cents,
      v_submission.currency,
      v_submission.pricing_snapshot;
    RETURN;
  END IF;

  -- A committed order always replays its original authoritative snapshot,
  -- even if the live catalog has changed since the first request.
  IF v_submission.status = 'committed' THEN
    RETURN QUERY SELECT
      'committed'::TEXT,
      v_submission.submission_id,
      NULL::UUID,
      v_submission.reserved_order_id,
      v_submission.reserved_order_number,
      v_submission.order_id,
      v_submission.estimated_total_cents,
      v_submission.currency,
      v_submission.pricing_snapshot;
    RETURN;
  END IF;

  IF v_submission.pricing_version IS DISTINCT FROM p_pricing_version
     OR v_submission.quote_hash IS DISTINCT FROM p_quote_hash
     OR v_submission.currency IS DISTINCT FROM p_currency
     OR v_submission.estimated_total_cents IS DISTINCT FROM p_estimated_total_cents THEN
    RETURN QUERY SELECT
      'pricing_changed'::TEXT,
      v_submission.submission_id,
      NULL::UUID,
      v_submission.reserved_order_id,
      v_submission.reserved_order_number,
      NULL::UUID,
      v_submission.estimated_total_cents,
      v_submission.currency,
      v_submission.pricing_snapshot;
    RETURN;
  END IF;

  IF v_submission.lease_token IS DISTINCT FROM p_lease_token
     AND v_submission.lease_expires_at > pg_catalog.now() THEN
    RETURN QUERY SELECT
      'in_progress'::TEXT,
      v_submission.submission_id,
      NULL::UUID,
      v_submission.reserved_order_id,
      v_submission.reserved_order_number,
      NULL::UUID,
      v_submission.estimated_total_cents,
      v_submission.currency,
      v_submission.pricing_snapshot;
    RETURN;
  END IF;

  UPDATE public.order_submissions AS submissions
     SET lease_token = p_lease_token,
         lease_expires_at = v_lease_cutoff,
         last_error_code = NULL
   WHERE submissions.submission_id = p_submission_id
   RETURNING * INTO v_submission;

  RETURN QUERY SELECT
    'claimed'::TEXT,
    v_submission.submission_id,
    v_submission.lease_token,
    v_submission.reserved_order_id,
    v_submission.reserved_order_number,
    NULL::UUID,
    v_submission.estimated_total_cents,
    v_submission.currency,
    v_submission.pricing_snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_order_submission(
  p_user_id UUID,
  p_submission_id UUID,
  p_lease_token UUID,
  p_error_code TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.order_submissions AS submissions
     SET lease_token = NULL,
         lease_expires_at = NULL,
         last_error_code = NULLIF(pg_catalog.left(p_error_code, 100), '')
   WHERE submissions.submission_id = p_submission_id
     AND submissions.user_id IS NOT DISTINCT FROM p_user_id
     AND submissions.status = 'processing'
     AND submissions.lease_token IS NOT DISTINCT FROM p_lease_token;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN CASE WHEN v_updated = 1 THEN 'released' ELSE 'not_released' END;
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_order_submission(
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
  p_draft_moved_files JSONB DEFAULT NULL
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
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_submission public.order_submissions%ROWTYPE;
  v_draft public.order_drafts%ROWTYPE;
  v_item JSONB;
  v_reference JSONB;
  v_moved JSONB;
  v_item_id UUID;
  v_item_index INTEGER;
  v_expected_item_index INTEGER := 0;
  v_item_count INTEGER;
  v_live_file_count INTEGER;
  v_updated_file_count INTEGER;
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

  IF v_submission.status = 'committed' THEN
    RETURN QUERY SELECT
      'replayed'::TEXT,
      FALSE,
      v_submission.order_id,
      v_submission.reserved_order_number,
      v_submission.estimated_total_cents,
      v_submission.currency,
      v_submission.pricing_snapshot,
      (SELECT orders.item_count
         FROM public.orders AS orders
        WHERE orders.id = v_submission.order_id);
    RETURN;
  END IF;

  IF v_submission.lease_token IS DISTINCT FROM p_lease_token
     OR v_submission.lease_expires_at <= pg_catalog.now() THEN
    RETURN QUERY SELECT
      'lease_conflict'::TEXT, FALSE, NULL::UUID, NULL::TEXT,
      NULL::INTEGER, NULL::TEXT, NULL::JSONB, NULL::INTEGER;
    RETURN;
  END IF;

  IF pg_catalog.jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'order items must be an array';
  END IF;
  v_item_count := pg_catalog.jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 50 THEN
    RAISE EXCEPTION 'order item count is outside the allowed range';
  END IF;

  IF (v_submission.pricing_snapshot->>'serviceType') IS DISTINCT FROM v_submission.service_type
     OR (v_submission.pricing_snapshot->>'currency') IS DISTINCT FROM v_submission.currency
     OR (v_submission.pricing_snapshot->>'pricingVersion') IS DISTINCT FROM v_submission.pricing_version
     OR (v_submission.pricing_snapshot->>'totalCents') !~ '^[0-9]+$'
     OR (v_submission.pricing_snapshot->>'totalCents')::INTEGER IS DISTINCT FROM v_submission.estimated_total_cents
     OR pg_catalog.jsonb_array_length(v_submission.pricing_snapshot->'items') IS DISTINCT FROM v_item_count THEN
    RAISE EXCEPTION 'stored authoritative pricing snapshot is inconsistent';
  END IF;

  IF v_submission.source_draft_id IS NOT NULL THEN
    SELECT drafts.*
      INTO v_draft
      FROM public.order_drafts AS drafts
     WHERE drafts.id = v_submission.source_draft_id
     FOR UPDATE;

    IF NOT FOUND
       OR v_draft.user_id IS DISTINCT FROM p_user_id
       OR v_draft.service_type IS DISTINCT FROM 'virtual-staging'
       OR v_draft.route IS DISTINCT FROM '/dashboard/orders/new/virtual-staging'
       OR v_draft.version IS DISTINCT FROM p_draft_expected_version
       OR v_draft.status IS DISTINCT FROM 'converting'
       OR v_draft.finalization_key IS DISTINCT FROM p_draft_finalization_key
       OR p_draft_finalization_key IS NULL
       OR pg_catalog.jsonb_typeof(p_draft_moved_files) IS DISTINCT FROM 'array' THEN
      RETURN QUERY SELECT
        'draft_conflict'::TEXT, FALSE, NULL::UUID, NULL::TEXT,
        NULL::INTEGER, NULL::TEXT, NULL::JSONB, NULL::INTEGER;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.orders (
    id,
    order_number,
    service_type,
    status,
    job_title,
    user_id,
    client_name,
    client_email,
    client_phone,
    client_company,
    item_count,
    estimated_total_cents,
    currency,
    pricing_snapshot,
    source_draft_id
  ) VALUES (
    v_submission.reserved_order_id,
    v_submission.reserved_order_number,
    v_submission.service_type,
    'pending',
    pg_catalog.btrim(p_job_title),
    p_user_id,
    p_client_name,
    p_client_email,
    p_client_phone,
    NULLIF(pg_catalog.btrim(p_client_company), ''),
    v_item_count,
    v_submission.estimated_total_cents,
    v_submission.currency,
    v_submission.pricing_snapshot,
    v_submission.source_draft_id
  );

  FOR v_item IN
    SELECT item.value
      FROM pg_catalog.jsonb_array_elements(p_items) WITH ORDINALITY AS item(value, ordinal)
     ORDER BY item.ordinal
  LOOP
    IF pg_catalog.jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR (v_item->>'itemIndex') !~ '^[0-9]+$'
       OR pg_catalog.jsonb_typeof(v_item->'details') IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(v_item->'references') IS DISTINCT FROM 'array'
       OR (v_item->>'subtotalCents') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'invalid order item payload';
    END IF;

    v_item_index := (v_item->>'itemIndex')::INTEGER;
    IF v_item_index IS DISTINCT FROM v_expected_item_index THEN
      RAISE EXCEPTION 'order item indexes must be unique and contiguous';
    END IF;
    IF (v_item->>'subtotalCents')::INTEGER IS DISTINCT FROM
       (v_submission.pricing_snapshot->'items'->v_item_index->>'lineSubtotalCents')::INTEGER THEN
      RAISE EXCEPTION 'order item subtotal does not match authoritative pricing snapshot';
    END IF;

    v_item_id := gen_random_uuid();
    INSERT INTO public.order_items (
      id,
      order_id,
      item_index,
      original_photo_path,
      reference_image_path,
      subtotal_cents,
      details
    ) VALUES (
      v_item_id,
      v_submission.reserved_order_id,
      v_item_index,
      NULLIF(v_item->>'originalPhotoPath', ''),
      NULLIF(v_item->>'referenceImagePath', ''),
      (v_item->>'subtotalCents')::INTEGER,
      v_item->'details'
    );

    FOR v_reference IN
      SELECT reference.value
        FROM pg_catalog.jsonb_array_elements(v_item->'references')
          AS reference(value)
    LOOP
      INSERT INTO public.order_item_reference_files (
        order_item_id,
        reference_id,
        position,
        bucket,
        storage_path,
        original_filename,
        file_size,
        mime_type
      ) VALUES (
        v_item_id,
        (v_reference->>'referenceId')::UUID,
        (v_reference->>'position')::SMALLINT,
        v_reference->>'bucket',
        v_reference->>'storagePath',
        v_reference->>'originalFilename',
        (v_reference->>'fileSize')::BIGINT,
        v_reference->>'mimeType'
      );
    END LOOP;

    v_expected_item_index := v_expected_item_index + 1;
  END LOOP;

  IF v_submission.source_draft_id IS NOT NULL THEN
    SELECT count(*)::INTEGER
      INTO v_live_file_count
      FROM public.order_draft_files AS files
     WHERE files.draft_id = v_submission.source_draft_id
       AND files.upload_status = 'uploaded'
       AND files.deleted_at IS NULL;

    IF v_live_file_count <> pg_catalog.jsonb_array_length(p_draft_moved_files) THEN
      RAISE EXCEPTION 'draft moved-file count mismatch';
    END IF;

    FOR v_moved IN
      SELECT moved.value
        FROM pg_catalog.jsonb_array_elements(p_draft_moved_files) AS moved(value)
    LOOP
      UPDATE public.order_draft_files AS files
         SET upload_status = 'moved',
             storage_path = pg_catalog.btrim(v_moved->>'finalPath'),
             moved_at = pg_catalog.now()
       WHERE files.id = (v_moved->>'fileId')::UUID
         AND files.draft_id = v_submission.source_draft_id
         AND files.upload_status = 'uploaded'
         AND files.deleted_at IS NULL;
      GET DIAGNOSTICS v_updated_file_count = ROW_COUNT;
      IF v_updated_file_count <> 1 THEN
        RAISE EXCEPTION 'draft moved-file update mismatch';
      END IF;
    END LOOP;

    -- Normalized draft references use the historical status vocabulary
    -- (there is no "moved" value). Retire those source rows atomically; the
    -- committed order_item_reference_files rows above retain their metadata.
    UPDATE public.order_draft_item_reference_files AS draft_references
       SET upload_status = 'deleted',
           deleted_at = pg_catalog.now()
     WHERE draft_references.draft_id = v_submission.source_draft_id
       AND draft_references.upload_status = 'uploaded'
       AND draft_references.deleted_at IS NULL;

    UPDATE public.order_drafts AS drafts
       SET status = 'converted',
           converted_order_id = v_submission.reserved_order_id,
           converted_at = pg_catalog.now(),
           finalization_key = NULL,
           expires_at = GREATEST(drafts.expires_at, pg_catalog.now() + interval '90 days')
     WHERE drafts.id = v_submission.source_draft_id;
  END IF;

  INSERT INTO public.order_email_deliveries (
    order_id,
    delivery_kind,
    idempotency_key,
    idempotency_expires_at
  ) VALUES
    (
      v_submission.reserved_order_id,
      'client_confirmation',
      'order-created-' || v_submission.reserved_order_id::TEXT || '-client-v1',
      pg_catalog.now() + interval '24 hours'
    ),
    (
      v_submission.reserved_order_id,
      'admin_notification',
      'order-created-' || v_submission.reserved_order_id::TEXT || '-admin-v1',
      pg_catalog.now() + interval '24 hours'
    );

  UPDATE public.order_submissions AS submissions
     SET status = 'committed',
         order_id = submissions.reserved_order_id,
         committed_at = pg_catalog.now(),
         lease_token = NULL,
         lease_expires_at = NULL,
         last_error_code = NULL
   WHERE submissions.submission_id = p_submission_id
   RETURNING * INTO v_submission;

  RETURN QUERY SELECT
    'created'::TEXT,
    TRUE,
    v_submission.order_id,
    v_submission.reserved_order_number,
    v_submission.estimated_total_cents,
    v_submission.currency,
    v_submission.pricing_snapshot,
    v_item_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_order_email_deliveries(
  p_claim_token UUID,
  p_limit INTEGER DEFAULT 10,
  p_order_id UUID DEFAULT NULL
)
RETURNS TABLE (
  delivery_id UUID,
  order_id UUID,
  delivery_kind TEXT,
  idempotency_key TEXT,
  payload_hash TEXT,
  attempt_count INTEGER,
  idempotency_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_claim_token IS NULL OR p_limit < 1 OR p_limit > 25 THEN
    RAISE EXCEPTION 'invalid email delivery claim';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT deliveries.id
      FROM public.order_email_deliveries AS deliveries
     WHERE deliveries.attempt_count < 3
       AND (p_order_id IS NULL OR deliveries.order_id = p_order_id)
       AND (
         deliveries.status = 'pending'
         OR deliveries.status = 'failed'
         OR (
           deliveries.status IN ('unknown', 'sending')
           AND deliveries.idempotency_expires_at > pg_catalog.now()
           AND (
             deliveries.status = 'unknown'
             OR deliveries.lease_expires_at <= pg_catalog.now()
           )
         )
       )
     ORDER BY deliveries.created_at
     FOR UPDATE SKIP LOCKED
     LIMIT p_limit
  )
  UPDATE public.order_email_deliveries AS deliveries
     SET status = 'sending',
         claim_token = p_claim_token,
         lease_expires_at = pg_catalog.now() + interval '5 minutes',
         attempt_count = deliveries.attempt_count + 1,
         last_attempt_at = pg_catalog.now(),
         last_error_code = NULL
    FROM candidates
   WHERE deliveries.id = candidates.id
  RETURNING
    deliveries.id,
    deliveries.order_id,
    deliveries.delivery_kind,
    deliveries.idempotency_key,
    deliveries.payload_hash,
    deliveries.attempt_count,
    deliveries.idempotency_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_order_email_delivery(
  p_delivery_id UUID,
  p_claim_token UUID,
  p_status TEXT,
  p_payload_hash TEXT,
  p_provider_message_id TEXT,
  p_error_code TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_status NOT IN ('sent', 'failed', 'unknown')
     OR (
       p_payload_hash IS NULL
       AND p_status IN ('sent', 'unknown')
     )
     OR (
       p_payload_hash IS NOT NULL
       AND p_payload_hash !~ '^[0-9a-f]{64}$'
     ) THEN
    RAISE EXCEPTION 'invalid email completion';
  END IF;

  UPDATE public.order_email_deliveries AS deliveries
     SET status = p_status,
         payload_hash = COALESCE(deliveries.payload_hash, p_payload_hash),
         provider_message_id = CASE
           WHEN p_status = 'sent' THEN NULLIF(p_provider_message_id, '')
           ELSE deliveries.provider_message_id
         END,
         last_error_code = CASE
           WHEN p_status = 'sent' THEN NULL
           ELSE NULLIF(pg_catalog.left(p_error_code, 100), '')
         END,
         sent_at = CASE WHEN p_status = 'sent' THEN pg_catalog.now() ELSE NULL END,
         claim_token = NULL,
         lease_expires_at = NULL
   WHERE deliveries.id = p_delivery_id
     AND deliveries.status = 'sending'
     AND deliveries.claim_token IS NOT DISTINCT FROM p_claim_token
     AND (
       deliveries.payload_hash IS NULL
       OR deliveries.payload_hash IS NOT DISTINCT FROM p_payload_hash
     );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN CASE WHEN v_updated = 1 THEN 'completed' ELSE 'not_completed' END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_order_submission(
  UUID, UUID, TEXT, SMALLINT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_order_submission(
  UUID, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.commit_order_submission(
  UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, UUID, JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_order_email_deliveries(UUID, INTEGER, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_order_email_delivery(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_order_submission(
  UUID, UUID, TEXT, SMALLINT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_order_submission(
  UUID, UUID, UUID, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_order_submission(
  UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, UUID, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_order_email_deliveries(UUID, INTEGER, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_order_email_delivery(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT
) TO service_role;

COMMIT;

-- Read-only verification examples after manual application:
-- SELECT relname, relrowsecurity
-- FROM pg_catalog.pg_class
-- WHERE oid IN (
--   'public.order_submissions'::regclass,
--   'public.order_email_deliveries'::regclass
-- );
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'claim_order_submission',
--     'release_order_submission',
--     'commit_order_submission',
--     'claim_order_email_deliveries',
--     'complete_order_email_delivery'
--   );

-- Rollback guidance:
-- Prefer application rollback and retain these tables once any row exists.
-- Only before use, drop the five functions, then the two new tables.
