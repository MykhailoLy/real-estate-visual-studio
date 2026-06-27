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

  IF NOT FOUND
     OR v_draft.user_id <> p_user_id
     OR v_draft.status <> 'active'
     OR v_draft.deleted_at IS NOT NULL
     OR v_draft.expires_at <= now() THEN
    RAISE EXCEPTION 'order draft not found or not active'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT *
    INTO v_target
    FROM public.order_draft_files
   WHERE id = p_file_id
     AND draft_id = p_draft_id
   FOR UPDATE;

  IF NOT FOUND
     OR v_target.upload_status <> 'pending'
     OR v_target.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'pending draft file not found'
      USING ERRCODE = 'P0002';
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
    RAISE EXCEPTION 'pending draft file was not completed'
      USING ERRCODE = 'P0002';
  END IF;

  completed_file_id := p_file_id;
  retired_storage_paths := v_retired_paths;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.complete_order_draft_file_upload(uuid, uuid, uuid) IS
  'Atomically marks one verified pending draft file uploaded and soft-deletes the previous uploaded row in the same draft item slot. Execute only from trusted service-role server code with p_user_id from the verified session.';

REVOKE ALL ON FUNCTION public.complete_order_draft_file_upload(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_order_draft_file_upload(uuid, uuid, uuid)
  TO service_role;
