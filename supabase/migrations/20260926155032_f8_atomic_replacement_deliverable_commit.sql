-- F8 MANUAL MIGRATION ONLY. Do not apply automatically.
-- Add one service-role RPC; retain attach_replacement_with_email for old bundles.
-- Storage existence/size is verified by the authenticated admin route first.
-- No table, index, policy, bucket, backfill or existing-function changes.
BEGIN;

CREATE OR REPLACE FUNCTION public.commit_rework_replacement_upload(
  p_review_id uuid,
  p_replacement_deliverable_id uuid,
  p_storage_path text,
  p_filename text,
  p_file_size bigint,
  p_mime_type text
)
RETURNS TABLE (result_code text, deliverable jsonb)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_review public.deliverable_reviews%ROWTYPE;
  v_deliverable public.order_deliverables%ROWTYPE;
  v_prefix text;
  v_result text;
BEGIN
  SELECT * INTO v_review FROM public.deliverable_reviews
    WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::jsonb;
    RETURN;
  END IF;

  IF p_replacement_deliverable_id IS NULL OR p_replacement_deliverable_id = v_review.deliverable_id
     OR p_file_size IS NULL OR p_file_size NOT BETWEEN 1 AND 209715200
     OR p_filename IS NULL OR length(p_filename) NOT BETWEEN 1 AND 255
     OR p_mime_type IS NULL OR length(p_mime_type) NOT BETWEEN 1 AND 100 THEN
    RETURN QUERY SELECT 'invalid_candidate'::text, NULL::jsonb;
    RETURN;
  END IF;
  v_prefix := v_review.order_number || '/rework/' || v_review.id::text || '/' || p_replacement_deliverable_id::text || '-';
  IF p_storage_path IS NULL OR left(p_storage_path, length(v_prefix)) <> v_prefix
     OR substring(p_storage_path FROM length(v_prefix) + 1) !~ '^[a-zA-Z0-9._-]{1,100}$' THEN
    RETURN QUERY SELECT 'invalid_candidate'::text, NULL::jsonb;
    RETURN;
  END IF;

  -- Reconcile a committed response loss before applying the active-state guard.
  IF v_review.status = 'rework_delivered' AND v_review.replacement_deliverable_id = p_replacement_deliverable_id THEN
    SELECT * INTO v_deliverable FROM public.order_deliverables AS d
      WHERE d.id = p_replacement_deliverable_id
        AND d.order_id = v_review.order_id AND d.order_number = v_review.order_number
        AND d.item_index IS NOT DISTINCT FROM v_review.item_index
        AND d.storage_path = p_storage_path AND d.filename = p_filename
        AND d.file_size = p_file_size AND d.mime_type = p_mime_type;
    IF NOT FOUND THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::jsonb;
      RETURN;
    END IF;
    v_result := 'already_committed';
  ELSE
    IF v_review.replacement_deliverable_id IS NOT NULL THEN
      RETURN QUERY SELECT 'conflict'::text, NULL::jsonb;
      RETURN;
    END IF;
    IF v_review.status NOT IN ('rework_requested', 'rework_in_progress') THEN
      RETURN QUERY SELECT 'invalid_state'::text, NULL::jsonb;
      RETURN;
    END IF;
    -- Derive the assignment from the review and reject inconsistent historical
    -- parent data rather than registering a deliverable against another item.
    IF NOT EXISTS (
      SELECT 1 FROM public.orders AS o
      JOIN public.order_deliverables AS original ON original.id = v_review.deliverable_id
      WHERE o.id = v_review.order_id AND o.order_number = v_review.order_number
        AND original.order_id = o.id AND original.order_number = o.order_number
        AND original.item_index IS NOT DISTINCT FROM v_review.item_index
        AND (v_review.item_index IS NULL OR (v_review.item_index >= 0 AND v_review.item_index < o.item_count))
    ) THEN
      RETURN QUERY SELECT 'invalid_assignment'::text, NULL::jsonb;
      RETURN;
    END IF;

    INSERT INTO public.order_deliverables (
      id, order_id, order_number, item_index, storage_path, filename, file_size, mime_type
    ) VALUES (
      p_replacement_deliverable_id, v_review.order_id, v_review.order_number,
      v_review.item_index, p_storage_path, p_filename, p_file_size, p_mime_type
    ) RETURNING * INTO v_deliverable;

    UPDATE public.deliverable_reviews SET
      replacement_deliverable_id = p_replacement_deliverable_id, status = 'rework_delivered'
      WHERE id = p_review_id;

    INSERT INTO public.order_email_deliveries (
      order_id, delivery_kind, idempotency_key, idempotency_expires_at
    ) VALUES (
      v_review.order_id, 'admin_replacement_ready:' || p_review_id::text,
      'review-' || p_review_id::text || '-replacement-' || p_replacement_deliverable_id::text || '-ready-v1',
      pg_catalog.now() + interval '24 hours'
    ) ON CONFLICT (order_id, delivery_kind) DO NOTHING;
    v_result := 'committed';
  END IF;

  RETURN QUERY SELECT v_result, jsonb_build_object(
    'id', v_deliverable.id, 'order_id', v_deliverable.order_id,
    'order_number', v_deliverable.order_number, 'item_index', v_deliverable.item_index,
    'filename', v_deliverable.filename, 'file_size', v_deliverable.file_size,
    'mime_type', v_deliverable.mime_type, 'uploaded_at', v_deliverable.uploaded_at
  );
EXCEPTION WHEN unique_violation THEN
  -- The subtransaction rolls back all writes, including an inserted candidate.
  RETURN QUERY SELECT 'conflict'::text, NULL::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.commit_rework_replacement_upload(uuid, uuid, text, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_rework_replacement_upload(uuid, uuid, text, text, bigint, text) TO service_role;

COMMIT;
