-- ============================================================
-- MIGRATION: add_order_draft_file_upload_foundation
--
-- Adds the server-mediated draft-file upload foundation for the
-- existing private order-files bucket.
--
-- Draft files remain separate from production order files. This
-- migration does not create orders, move files into order-number
-- paths, send email, or alter pricing.
--
-- Run manually in the Supabase SQL Editor after review.
-- Do NOT execute automatically through Supabase CLI.
-- ============================================================

BEGIN;

-- The original slot uniqueness treated both pending and uploaded
-- rows as active. That prevents a replacement candidate from being
-- uploaded while the existing completed file remains usable.
DROP INDEX IF EXISTS public.order_draft_files_one_active_kind_per_item;

-- Only one completed uploaded file may be visible per item slot.
-- Pending candidates can coexist until completion verifies Storage
-- and atomically retires the previous uploaded row.
CREATE UNIQUE INDEX IF NOT EXISTS order_draft_files_one_uploaded_kind_per_item
  ON public.order_draft_files (draft_id, item_client_id, kind)
  WHERE deleted_at IS NULL
    AND upload_status = 'uploaded';

-- Supports trusted server lookup/cleanup of replacement candidates.
CREATE INDEX IF NOT EXISTS idx_order_draft_files_pending_slot
  ON public.order_draft_files (
    draft_id,
    item_client_id,
    kind,
    upload_status
  )
  WHERE deleted_at IS NULL;

DROP FUNCTION IF EXISTS public.prepare_order_draft_file_upload(
  uuid,
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  text
);
DROP FUNCTION IF EXISTS public.complete_order_draft_file_upload(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.soft_delete_order_draft_file(uuid, uuid, uuid);

-- ------------------------------------------------------------
-- Atomic prepare RPC
-- ------------------------------------------------------------
-- Contract:
-- - Called only by trusted service-role server code.
-- - p_user_id and p_expected_version come from verified server
--   state, never from browser input.
-- - The function locks the parent draft before deriving item_index
--   from draft JSON, retiring old pending/failed candidates, and
--   inserting the new pending metadata row.
-- - Uploaded rows are left untouched during prepare.
CREATE OR REPLACE FUNCTION public.prepare_order_draft_file_upload(
  p_user_id uuid,
  p_draft_id uuid,
  p_expected_version integer,
  p_file_id uuid,
  p_item_client_id uuid,
  p_kind text,
  p_storage_path text,
  p_original_filename text,
  p_file_size bigint,
  p_mime_type text
)
RETURNS TABLE (
  result_code text,
  prepared_file_id uuid,
  item_index integer,
  retired_storage_paths text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_draft public.order_drafts%ROWTYPE;
  v_item_index integer;
  v_retired_paths text[];
BEGIN
  SELECT *
    INTO v_draft
    FROM public.order_drafts
   WHERE id = p_draft_id
   FOR UPDATE;

  IF NOT FOUND OR v_draft.user_id <> p_user_id THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::integer, ARRAY[]::text[];
    RETURN;
  END IF;

  IF v_draft.status <> 'active'
     OR v_draft.deleted_at IS NOT NULL
     OR v_draft.expires_at <= now() THEN
    RETURN QUERY SELECT 'invalid_status'::text, NULL::uuid, NULL::integer, ARRAY[]::text[];
    RETURN;
  END IF;

  IF v_draft.version <> p_expected_version THEN
    RETURN QUERY SELECT 'version_conflict'::text, NULL::uuid, NULL::integer, ARRAY[]::text[];
    RETURN;
  END IF;

  IF jsonb_typeof(v_draft.state->'items') IS DISTINCT FROM 'array' THEN
    RETURN QUERY SELECT 'item_not_found'::text, NULL::uuid, NULL::integer, ARRAY[]::text[];
    RETURN;
  END IF;

  SELECT (item.ordinality - 1)::integer
    INTO v_item_index
    FROM jsonb_array_elements(v_draft.state->'items') WITH ORDINALITY AS item(value, ordinality)
   WHERE item.value->>'clientItemId' = p_item_client_id::text
   LIMIT 1;

  IF v_item_index IS NULL THEN
    RETURN QUERY SELECT 'item_not_found'::text, NULL::uuid, NULL::integer, ARRAY[]::text[];
    RETURN;
  END IF;

  -- Lock live pending/failed rows in the slot before retiring them.
  PERFORM 1
    FROM public.order_draft_files
   WHERE draft_id = p_draft_id
     AND item_client_id = p_item_client_id
     AND kind = p_kind
     AND deleted_at IS NULL
     AND upload_status IN ('pending', 'failed')
   FOR UPDATE;

  SELECT COALESCE(array_agg(storage_path), ARRAY[]::text[])
    INTO v_retired_paths
    FROM public.order_draft_files
   WHERE draft_id = p_draft_id
     AND item_client_id = p_item_client_id
     AND kind = p_kind
     AND deleted_at IS NULL
     AND upload_status IN ('pending', 'failed');

  UPDATE public.order_draft_files
     SET upload_status = 'deleted',
         deleted_at = now()
   WHERE draft_id = p_draft_id
     AND item_client_id = p_item_client_id
     AND kind = p_kind
     AND deleted_at IS NULL
     AND upload_status IN ('pending', 'failed');

  INSERT INTO public.order_draft_files (
    id,
    draft_id,
    item_client_id,
    item_index,
    kind,
    bucket,
    storage_path,
    original_filename,
    file_size,
    mime_type,
    content_hash,
    upload_status,
    deleted_at,
    moved_at
  )
  VALUES (
    p_file_id,
    p_draft_id,
    p_item_client_id,
    v_item_index,
    p_kind,
    'order-files',
    p_storage_path,
    p_original_filename,
    p_file_size,
    p_mime_type,
    NULL,
    'pending',
    NULL,
    NULL
  );

  RETURN QUERY SELECT 'prepared'::text, p_file_id, v_item_index, v_retired_paths;
END;
$$;

COMMENT ON FUNCTION public.prepare_order_draft_file_upload(
  uuid,
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  text
) IS
  'Atomically validates an active owned draft, derives item_index from locked draft JSON, retires pending/failed candidates, and inserts one pending draft file metadata row. Execute only from trusted service-role server code.';

REVOKE ALL ON FUNCTION public.prepare_order_draft_file_upload(
  uuid,
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_order_draft_file_upload(
  uuid,
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  text
) TO service_role;

-- ------------------------------------------------------------
-- Atomic completion RPC
-- ------------------------------------------------------------
-- Contract:
-- - Called only by trusted service-role server code.
-- - p_user_id must come from the verified server session, never
--   from browser input.
-- - The function locks the parent draft and slot rows so two
--   completions for the same slot cannot leave multiple uploaded
--   rows.
-- - Metadata rows are soft-deleted only; Storage cleanup is handled
--   afterward by trusted server code using returned storage paths.
CREATE OR REPLACE FUNCTION public.complete_order_draft_file_upload(
  p_user_id uuid,
  p_draft_id uuid,
  p_file_id uuid
)
RETURNS TABLE (
  result_code text,
  completed_file_id uuid,
  retired_storage_paths text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_draft public.order_drafts%ROWTYPE;
  v_target public.order_draft_files%ROWTYPE;
  v_retired_paths text[];
BEGIN
  SELECT *
    INTO v_draft
    FROM public.order_drafts
   WHERE id = p_draft_id
   FOR UPDATE;

  IF NOT FOUND OR v_draft.user_id <> p_user_id THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, ARRAY[]::text[];
    RETURN;
  END IF;

  IF v_draft.status <> 'active'
     OR v_draft.deleted_at IS NOT NULL
     OR v_draft.expires_at <= now() THEN
    RETURN QUERY SELECT 'invalid_status'::text, NULL::uuid, ARRAY[]::text[];
    RETURN;
  END IF;

  SELECT *
    INTO v_target
    FROM public.order_draft_files
   WHERE id = p_file_id
     AND draft_id = p_draft_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, ARRAY[]::text[];
    RETURN;
  END IF;

  IF v_target.upload_status <> 'pending'
     OR v_target.deleted_at IS NOT NULL THEN
    RETURN QUERY SELECT 'invalid_file_status'::text, NULL::uuid, ARRAY[]::text[];
    RETURN;
  END IF;

  -- Lock every live row in the target slot before swapping state.
  PERFORM 1
    FROM public.order_draft_files
   WHERE draft_id = p_draft_id
     AND item_client_id = v_target.item_client_id
     AND kind = v_target.kind
     AND deleted_at IS NULL
   FOR UPDATE;

  SELECT COALESCE(array_agg(storage_path), ARRAY[]::text[])
    INTO v_retired_paths
    FROM public.order_draft_files
   WHERE draft_id = p_draft_id
     AND item_client_id = v_target.item_client_id
     AND kind = v_target.kind
     AND id <> p_file_id
     AND deleted_at IS NULL
     AND upload_status = 'uploaded';

  UPDATE public.order_draft_files
     SET upload_status = 'deleted',
         deleted_at = now()
   WHERE draft_id = p_draft_id
     AND item_client_id = v_target.item_client_id
     AND kind = v_target.kind
     AND id <> p_file_id
     AND deleted_at IS NULL
     AND upload_status = 'uploaded';

  UPDATE public.order_draft_files
     SET upload_status = 'uploaded'
   WHERE id = p_file_id
     AND draft_id = p_draft_id
     AND upload_status = 'pending'
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid_file_status'::text, NULL::uuid, ARRAY[]::text[];
    RETURN;
  END IF;

  RETURN QUERY SELECT 'completed'::text, p_file_id, v_retired_paths;
END;
$$;

COMMENT ON FUNCTION public.complete_order_draft_file_upload(uuid, uuid, uuid) IS
  'Atomically marks one verified pending draft file uploaded and soft-deletes the previous uploaded row in the same draft item slot. Execute only from trusted service-role server code with p_user_id from the verified session.';

REVOKE ALL ON FUNCTION public.complete_order_draft_file_upload(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_order_draft_file_upload(uuid, uuid, uuid)
  TO service_role;

-- ------------------------------------------------------------
-- Atomic soft-delete RPC
-- ------------------------------------------------------------
-- Contract:
-- - Called only by trusted service-role server code.
-- - Metadata is soft-deleted only after an active owned draft and a
--   live managed draft-file row are locked and verified.
-- - Moved files are rejected so finalized/production file state is
--   not changed through draft-file APIs.
CREATE OR REPLACE FUNCTION public.soft_delete_order_draft_file(
  p_user_id uuid,
  p_draft_id uuid,
  p_file_id uuid
)
RETURNS TABLE (
  result_code text,
  deleted_file_id uuid,
  storage_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_draft public.order_drafts%ROWTYPE;
  v_target public.order_draft_files%ROWTYPE;
BEGIN
  SELECT *
    INTO v_draft
    FROM public.order_drafts
   WHERE id = p_draft_id
   FOR UPDATE;

  IF NOT FOUND OR v_draft.user_id <> p_user_id THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  IF v_draft.status <> 'active'
     OR v_draft.deleted_at IS NOT NULL
     OR v_draft.expires_at <= now() THEN
    RETURN QUERY SELECT 'invalid_status'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  SELECT *
    INTO v_target
    FROM public.order_draft_files
   WHERE id = p_file_id
     AND draft_id = p_draft_id
   FOR UPDATE;

  IF NOT FOUND OR v_target.deleted_at IS NOT NULL THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  IF v_target.upload_status NOT IN ('pending', 'uploaded', 'failed') THEN
    RETURN QUERY SELECT 'invalid_file_status'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  UPDATE public.order_draft_files
     SET upload_status = 'deleted',
         deleted_at = now()
   WHERE id = p_file_id
     AND draft_id = p_draft_id
     AND deleted_at IS NULL
     AND upload_status IN ('pending', 'uploaded', 'failed');

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'deleted'::text, p_file_id, v_target.storage_path;
END;
$$;

COMMENT ON FUNCTION public.soft_delete_order_draft_file(uuid, uuid, uuid) IS
  'Atomically verifies an active owned draft and soft-deletes one managed draft-file metadata row. Execute only from trusted service-role server code.';

REVOKE ALL ON FUNCTION public.soft_delete_order_draft_file(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_order_draft_file(uuid, uuid, uuid)
  TO service_role;

COMMIT;
