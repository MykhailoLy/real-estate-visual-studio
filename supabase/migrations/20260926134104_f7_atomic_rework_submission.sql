-- F7 — MANUAL MIGRATION ONLY. Deploy functions before the application.
-- Function-only, idempotent; no table, policy, index, bucket or data changes.
-- Ownership is checked by the authenticated server route. service_role already
-- has table rights; SECURITY INVOKER preserves that boundary without escalation.
BEGIN;

CREATE OR REPLACE FUNCTION public.prepare_rework_reference_file_upload(
  p_review_id uuid,
  p_file_id uuid,
  p_storage_path text,
  p_filename text,
  p_file_size bigint,
  p_mime_type text
)
RETURNS TABLE(result_code text, file_id uuid, created_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_review public.deliverable_reviews%ROWTYPE;
BEGIN
  SELECT * INTO v_review FROM public.deliverable_reviews
  WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  -- Strict new-flow mode: never fall back to an active legacy review.
  IF v_review.status <> 'pending_review' THEN
    RETURN QUERY SELECT 'invalid_state'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  -- Must match REWORK_REFERENCES_MAX_FILES. The parent lock serializes slots.
  IF (SELECT count(*) FROM public.deliverable_review_files WHERE review_id = p_review_id) >= 5 THEN
    RETURN QUERY SELECT 'file_limit'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  RETURN QUERY
    INSERT INTO public.deliverable_review_files AS f
      (id, review_id, order_id, deliverable_id, item_index, storage_path,
       filename, file_size, mime_type, uploaded_by, upload_status)
    VALUES
      (p_file_id, v_review.id, v_review.order_id, v_review.deliverable_id,
       v_review.item_index, p_storage_path, p_filename, p_file_size,
       p_mime_type, 'client', 'pending')
    RETURNING 'prepared'::text, f.id, f.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_rework_review_submission(
  p_review_id uuid,
  p_expected_file_count integer
)
RETURNS TABLE(result_code text, review_id uuid, status text, comment text, created_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_review public.deliverable_reviews%ROWTYPE;
  v_total bigint;
  v_uploaded bigint;
  v_pending bigint;
  v_constraint text;
BEGIN
  -- Same row and lock as strict attachment preparation.
  SELECT * INTO v_review FROM public.deliverable_reviews
  WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND THEN
    result_code := 'not_found'; RETURN NEXT; RETURN;
  END IF;
  IF v_review.status <> 'pending_review' THEN
    result_code := 'invalid_state'; RETURN NEXT; RETURN;
  END IF;
  IF p_expected_file_count IS NULL OR p_expected_file_count NOT BETWEEN 1 AND 5 THEN
    result_code := 'invalid_count'; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE f.upload_status = 'uploaded'),
    count(*) FILTER (WHERE f.upload_status = 'pending')
  INTO v_total, v_uploaded, v_pending
  FROM public.deliverable_review_files AS f WHERE f.review_id = p_review_id;
  IF v_total <> p_expected_file_count OR v_uploaded <> p_expected_file_count OR v_pending <> 0 THEN
    result_code := 'files_incomplete'; RETURN NEXT; RETURN;
  END IF;

  BEGIN
    -- Existing partial unique index remains the final active-rework guard.
    UPDATE public.deliverable_reviews AS r SET status = 'rework_requested'
    WHERE r.id = p_review_id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'deliverable_reviews_one_active_rework' THEN RAISE; END IF;
    result_code := 'active_rework'; RETURN NEXT; RETURN;
  END;
  RETURN QUERY SELECT 'finalized'::text, v_review.id, 'rework_requested'::text,
    v_review.comment, v_review.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_rework_reference_file_upload(uuid, uuid, text, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_rework_reference_file_upload(uuid, uuid, text, text, bigint, text) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_rework_review_submission(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_rework_review_submission(uuid, integer) TO service_role;

COMMIT;
