-- ============================================================
-- PATCH: fix_order_draft_finalization_complete_ambiguity
--
-- One-time repair for databases where add-order-draft-finalization.sql
-- was already applied before complete_order_draft_finalization fully
-- qualified draft-file column references.
--
-- This patch only replaces the RPC definition and reapplies function
-- privileges. It does not alter or read any live order, draft, file, or
-- storage rows, and it intentionally does not call the function.
--
-- Run manually in the Supabase SQL Editor after review.
-- Do NOT execute automatically through Supabase CLI.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.complete_order_draft_finalization(
  p_user_id uuid,
  p_draft_id uuid,
  p_finalization_key uuid,
  p_order_id uuid,
  p_moved_files jsonb
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
  v_order public.orders%ROWTYPE;
  v_entry jsonb;
  v_file_id uuid;
  v_final_path text;
  v_moved_ids uuid[] := ARRAY[]::uuid[];
  v_moved_paths text[] := ARRAY[]::text[];
  v_live_file_ids uuid[] := ARRAY[]::uuid[];
  v_live_file_count integer;
  v_updated_file_count integer;
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

  SELECT orders.*
    INTO v_order
    FROM public.orders AS orders
   WHERE orders.id = p_order_id
   FOR UPDATE;

  IF NOT FOUND
     OR v_order.user_id IS DISTINCT FROM p_user_id
     OR v_order.source_draft_id IS DISTINCT FROM p_draft_id THEN
    RETURN QUERY SELECT 'not_found'::text, v_draft.id, NULL::uuid;
    RETURN;
  END IF;

  IF v_draft.status = 'converted' THEN
    IF v_draft.converted_order_id IS NOT DISTINCT FROM p_order_id THEN
      RETURN QUERY SELECT 'completed'::text, v_draft.id, p_order_id;
      RETURN;
    END IF;

    RETURN QUERY SELECT 'invalid_status'::text, v_draft.id, v_draft.converted_order_id;
    RETURN;
  END IF;

  IF v_draft.status <> 'converting'
     OR v_draft.finalization_key IS DISTINCT FROM p_finalization_key
     OR v_draft.finalization_key IS NULL THEN
    RETURN QUERY SELECT 'finalization_conflict'::text, v_draft.id, NULL::uuid;
    RETURN;
  END IF;

  IF jsonb_typeof(p_moved_files) IS DISTINCT FROM 'array' THEN
    RETURN QUERY SELECT 'invalid_moved_files'::text, v_draft.id, NULL::uuid;
    RETURN;
  END IF;

  FOR v_entry IN
    SELECT moved_entry.value
      FROM jsonb_array_elements(p_moved_files) AS moved_entry(value)
  LOOP
    IF jsonb_typeof(v_entry) IS DISTINCT FROM 'object'
       OR NOT (v_entry ? 'fileId')
       OR NOT (v_entry ? 'finalPath')
       OR (v_entry->>'fileId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR btrim(v_entry->>'finalPath') = ''
       OR btrim(v_entry->>'finalPath') !~ '^[A-Za-z0-9-]+/[0-9]+-(original|reference)\.[A-Za-z0-9]+$' THEN
      RETURN QUERY SELECT 'invalid_moved_files'::text, v_draft.id, NULL::uuid;
      RETURN;
    END IF;

    v_file_id := (v_entry->>'fileId')::uuid;
    v_final_path := btrim(v_entry->>'finalPath');

    IF v_file_id = ANY(v_moved_ids) THEN
      RETURN QUERY SELECT 'duplicate_moved_files'::text, v_draft.id, NULL::uuid;
      RETURN;
    END IF;

    IF v_final_path = ANY(v_moved_paths) THEN
      RETURN QUERY SELECT 'duplicate_moved_files'::text, v_draft.id, NULL::uuid;
      RETURN;
    END IF;

    v_moved_ids := array_append(v_moved_ids, v_file_id);
    v_moved_paths := array_append(v_moved_paths, v_final_path);
  END LOOP;

  SELECT COALESCE(array_agg(live_files.id), ARRAY[]::uuid[]), count(*)::integer
    INTO v_live_file_ids, v_live_file_count
    FROM (
      SELECT files.id
        FROM public.order_draft_files AS files
       WHERE files.draft_id = p_draft_id
         AND files.upload_status = 'uploaded'
         AND files.deleted_at IS NULL
       FOR UPDATE
    ) AS live_files;

  IF v_live_file_count = 0
     OR v_live_file_count <> COALESCE(array_length(v_moved_ids, 1), 0) THEN
    RETURN QUERY SELECT 'invalid_moved_files'::text, v_draft.id, NULL::uuid;
    RETURN;
  END IF;

  IF NOT (v_moved_ids <@ v_live_file_ids) THEN
    RETURN QUERY SELECT 'invalid_moved_files'::text, v_draft.id, NULL::uuid;
    RETURN;
  END IF;

  WITH moved AS (
    SELECT moved.file_id, moved.final_path
      FROM unnest(v_moved_ids, v_moved_paths) AS moved(file_id, final_path)
  )
  UPDATE public.order_draft_files AS files
     SET upload_status = 'moved',
         storage_path = moved.final_path,
         moved_at = now()
    FROM moved
   WHERE files.id = moved.file_id
     AND files.draft_id = p_draft_id
     AND files.upload_status = 'uploaded'
     AND files.deleted_at IS NULL;

  GET DIAGNOSTICS v_updated_file_count = ROW_COUNT;
  IF v_updated_file_count <> v_live_file_count THEN
    RAISE EXCEPTION 'draft finalization file update count mismatch';
  END IF;

  UPDATE public.order_drafts
     SET status = 'converted',
         converted_order_id = p_order_id,
         converted_at = now(),
         finalization_key = NULL,
         expires_at = GREATEST(expires_at, now() + interval '90 days')
   WHERE order_drafts.id = p_draft_id
     AND order_drafts.status = 'converting'
     AND order_drafts.finalization_key IS NOT DISTINCT FROM p_finalization_key;

  GET DIAGNOSTICS v_updated_draft_count = ROW_COUNT;
  IF v_updated_draft_count <> 1 THEN
    RAISE EXCEPTION 'draft finalization draft update count mismatch';
  END IF;

  RETURN QUERY SELECT 'completed'::text, p_draft_id, p_order_id;
END;
$$;

COMMENT ON FUNCTION public.complete_order_draft_finalization(
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb
) IS
  'Atomically verifies the owned claimed draft, the source-draft production order, and trusted moved-file payload, then marks live uploaded draft files moved and converts the draft. Storage manipulation is intentionally handled outside SQL.';

REVOKE ALL ON FUNCTION public.complete_order_draft_finalization(
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_order_draft_finalization(
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb
) TO service_role;

COMMIT;
