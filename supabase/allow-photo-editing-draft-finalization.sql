-- ============================================================
-- ORDER DRAFT FINALIZATION — PHOTO EDITING COMPATIBILITY
-- ============================================================
-- Migration only: this widens the trusted draft service/route allowlist for
-- the existing finalization contract. It does not enable application-level
-- Photo Editing finalization by itself and performs no table or data changes.

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_order_draft_finalization(
  p_user_id uuid,
  p_draft_id uuid,
  p_expected_version integer,
  p_finalization_key uuid
)
RETURNS TABLE (
  result_code text,
  draft_id uuid,
  converted_order_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_draft public.order_drafts%ROWTYPE;
  v_any_source_order_id uuid;
  v_owned_source_order_id uuid;
  v_stale_claim_cutoff timestamptz := now() - interval '15 minutes';
  v_updated_draft_count integer;
BEGIN
  SELECT drafts.*
    INTO v_draft
    FROM public.order_drafts AS drafts
   WHERE drafts.id = p_draft_id
   FOR UPDATE;

  IF NOT FOUND OR v_draft.user_id IS DISTINCT FROM p_user_id THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF NOT (
    (
      v_draft.service_type = 'virtual-staging'
      AND v_draft.route = '/dashboard/orders/new/virtual-staging'
    )
    OR
    (
      v_draft.service_type = 'photo-editing'
      AND v_draft.route = '/dashboard/orders/new/photo-editing'
    )
  ) THEN
    RETURN QUERY SELECT 'invalid_status'::text, v_draft.id, NULL::uuid;
    RETURN;
  END IF;

  SELECT source_orders.id
    INTO v_any_source_order_id
    FROM public.orders AS source_orders
   WHERE source_orders.source_draft_id IS NOT DISTINCT FROM p_draft_id
   LIMIT 1;

  SELECT source_orders.id
    INTO v_owned_source_order_id
    FROM public.orders AS source_orders
   WHERE source_orders.source_draft_id IS NOT DISTINCT FROM p_draft_id
     AND source_orders.user_id IS NOT DISTINCT FROM p_user_id
   LIMIT 1;

  IF v_any_source_order_id IS NOT NULL
     AND v_owned_source_order_id IS NULL THEN
    RETURN QUERY SELECT 'invalid_status'::text, v_draft.id, NULL::uuid;
    RETURN;
  END IF;

  IF v_draft.status = 'converted' THEN
    RETURN QUERY SELECT
      'already_converted'::text,
      v_draft.id,
      COALESCE(v_draft.converted_order_id, v_owned_source_order_id);
    RETURN;
  END IF;

  IF v_draft.status IN ('deleted', 'expired')
     OR v_draft.deleted_at IS NOT NULL
     OR v_draft.expires_at <= now() THEN
    RETURN QUERY SELECT 'invalid_status'::text, v_draft.id, NULL::uuid;
    RETURN;
  END IF;

  -- If a production order already exists but the draft was left active or
  -- converting by an interrupted request, let trusted server code reconcile
  -- against the existing order instead of creating another order. A converting
  -- draft keeps its existing key so stale recovery never takes over a draft
  -- that already has a source-draft production order.
  IF v_owned_source_order_id IS NOT NULL THEN
    IF v_draft.status = 'active' THEN
      IF v_draft.version <> p_expected_version THEN
        RETURN QUERY SELECT 'version_conflict'::text, v_draft.id, NULL::uuid;
        RETURN;
      END IF;

      UPDATE public.order_drafts
         SET status = 'converting',
             finalization_key = p_finalization_key
       WHERE order_drafts.id = p_draft_id
         AND order_drafts.status = 'active';
    END IF;

    RETURN QUERY SELECT 'already_claimed'::text, p_draft_id, v_owned_source_order_id;
    RETURN;
  END IF;

  IF v_draft.status = 'converting' THEN
    IF v_draft.finalization_key IS NOT DISTINCT FROM p_finalization_key
       AND v_draft.finalization_key IS NOT NULL THEN
      RETURN QUERY SELECT 'already_claimed'::text, v_draft.id, NULL::uuid;
      RETURN;
    END IF;

    -- A 15-minute stale-claim policy prevents abandoned pre-order claims from
    -- making a draft permanently inaccessible. Recent different-key claims
    -- remain protected as in-progress conflicts.
    IF v_draft.updated_at <= v_stale_claim_cutoff THEN
      UPDATE public.order_drafts
         SET finalization_key = p_finalization_key
       WHERE order_drafts.id = p_draft_id
         AND order_drafts.status = 'converting'
         AND NOT EXISTS (
           SELECT 1
             FROM public.orders AS source_orders
            WHERE source_orders.source_draft_id IS NOT DISTINCT FROM p_draft_id
         );

      GET DIAGNOSTICS v_updated_draft_count = ROW_COUNT;
      IF v_updated_draft_count <> 1 THEN
        RETURN QUERY SELECT 'finalization_conflict'::text, v_draft.id, NULL::uuid;
        RETURN;
      END IF;

      RETURN QUERY SELECT 'claimed'::text, p_draft_id, NULL::uuid;
      RETURN;
    END IF;

    RETURN QUERY SELECT 'finalization_conflict'::text, v_draft.id, NULL::uuid;
    RETURN;
  END IF;

  IF v_draft.status <> 'active' THEN
    RETURN QUERY SELECT 'invalid_status'::text, v_draft.id, NULL::uuid;
    RETURN;
  END IF;

  IF v_draft.version <> p_expected_version THEN
    RETURN QUERY SELECT 'version_conflict'::text, v_draft.id, NULL::uuid;
    RETURN;
  END IF;

  UPDATE public.order_drafts
     SET status = 'converting',
         finalization_key = p_finalization_key
   WHERE order_drafts.id = p_draft_id
     AND order_drafts.status = 'active';

  RETURN QUERY SELECT 'claimed'::text, p_draft_id, NULL::uuid;
END;
$$;

COMMENT ON FUNCTION public.claim_order_draft_finalization(
  uuid,
  uuid,
  integer,
  uuid
) IS
  'Locks and claims an owned active allowlisted order draft for trusted service-role finalization. It does not alter draft JSON, move files, create orders, or increment content version.';

REVOKE ALL ON FUNCTION public.claim_order_draft_finalization(
  uuid,
  uuid,
  integer,
  uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_draft_finalization(
  uuid,
  uuid,
  integer,
  uuid
) TO service_role;

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
       OR v_draft.service_type IS DISTINCT FROM v_submission.service_type
       OR NOT (
         (
           v_draft.service_type = 'virtual-staging'
           AND v_draft.route = '/dashboard/orders/new/virtual-staging'
         )
         OR
         (
           v_draft.service_type = 'photo-editing'
           AND v_draft.route = '/dashboard/orders/new/photo-editing'
         )
       )
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

REVOKE EXECUTE ON FUNCTION public.commit_order_submission(
  UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, UUID, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_order_submission(
  UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, UUID, JSONB
) TO service_role;

COMMIT;
