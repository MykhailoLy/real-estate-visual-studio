-- ============================================================
-- MIGRATION: add_order_draft_finalization
--
-- Adds the durable production-order idempotency boundary for draft
-- conversion and service-role-only RPCs used by trusted server
-- code to claim, complete, release, or recover a Virtual Staging draft
-- finalization.
--
-- Run manually in the Supabase SQL Editor after review.
-- Do NOT execute automatically through Supabase CLI.
-- ============================================================

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source_draft_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'orders_source_draft_id_fkey'
       AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_source_draft_id_fkey
      FOREIGN KEY (source_draft_id)
      REFERENCES public.order_drafts(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

COMMENT ON COLUMN public.orders.source_draft_id IS
  'Trusted server-set source draft for orders created by finalizing an authenticated order_draft. Nullable and never browser-writable.';

CREATE UNIQUE INDEX IF NOT EXISTS orders_source_draft_id_unique
  ON public.orders (source_draft_id)
  WHERE source_draft_id IS NOT NULL;

COMMENT ON INDEX public.orders_source_draft_id_unique IS
  'Guarantees a draft can create at most one production order. This partial unique index also supports source_draft_id lookup plans.';

DROP FUNCTION IF EXISTS public.claim_order_draft_finalization(
  uuid,
  uuid,
  integer,
  uuid
);
DROP FUNCTION IF EXISTS public.complete_order_draft_finalization(
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb
);
DROP FUNCTION IF EXISTS public.release_order_draft_finalization(
  uuid,
  uuid,
  uuid
);
DROP FUNCTION IF EXISTS public.recover_stale_order_draft_finalization(
  uuid,
  uuid
);

-- ------------------------------------------------------------
-- Claim finalization
-- ------------------------------------------------------------
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
  SELECT *
    INTO v_draft
    FROM public.order_drafts
   WHERE id = p_draft_id
   FOR UPDATE;

  IF NOT FOUND OR v_draft.user_id IS DISTINCT FROM p_user_id THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF v_draft.service_type <> 'virtual-staging'
     OR v_draft.route <> '/dashboard/orders/new/virtual-staging' THEN
    RETURN QUERY SELECT 'invalid_status'::text, v_draft.id, NULL::uuid;
    RETURN;
  END IF;

  SELECT orders.id
    INTO v_any_source_order_id
    FROM public.orders
   WHERE orders.source_draft_id IS NOT DISTINCT FROM p_draft_id
   LIMIT 1;

  SELECT orders.id
    INTO v_owned_source_order_id
    FROM public.orders
   WHERE orders.source_draft_id IS NOT DISTINCT FROM p_draft_id
     AND orders.user_id IS NOT DISTINCT FROM p_user_id
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
       WHERE id = p_draft_id
         AND status = 'active';
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
       WHERE id = p_draft_id
         AND status = 'converting'
         AND NOT EXISTS (
           SELECT 1
             FROM public.orders
            WHERE orders.source_draft_id IS NOT DISTINCT FROM p_draft_id
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
   WHERE id = p_draft_id
     AND status = 'active';

  RETURN QUERY SELECT 'claimed'::text, p_draft_id, NULL::uuid;
END;
$$;

COMMENT ON FUNCTION public.claim_order_draft_finalization(
  uuid,
  uuid,
  integer,
  uuid
) IS
  'Locks and claims an owned active Virtual Staging draft for trusted service-role finalization. It does not alter draft JSON, move files, create orders, or increment content version.';

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

-- ------------------------------------------------------------
-- Release finalization
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_order_draft_finalization(
  p_user_id uuid,
  p_draft_id uuid,
  p_finalization_key uuid
)
RETURNS TABLE (
  result_code text,
  draft_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_draft public.order_drafts%ROWTYPE;
  v_existing_source_order_id uuid;
BEGIN
  SELECT *
    INTO v_draft
    FROM public.order_drafts
   WHERE id = p_draft_id
   FOR UPDATE;

  IF NOT FOUND OR v_draft.user_id IS DISTINCT FROM p_user_id THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT orders.id
    INTO v_existing_source_order_id
    FROM public.orders
   WHERE orders.source_draft_id IS NOT DISTINCT FROM p_draft_id
   LIMIT 1;

  IF v_existing_source_order_id IS NOT NULL THEN
    RETURN QUERY SELECT 'order_exists'::text, v_draft.id;
    RETURN;
  END IF;

  IF v_draft.status = 'converted' THEN
    RETURN QUERY SELECT 'already_converted'::text, v_draft.id;
    RETURN;
  END IF;

  IF v_draft.status = 'active' THEN
    RETURN QUERY SELECT 'released'::text, v_draft.id;
    RETURN;
  END IF;

  IF v_draft.status <> 'converting' THEN
    RETURN QUERY SELECT 'invalid_status'::text, v_draft.id;
    RETURN;
  END IF;

  IF v_draft.finalization_key IS DISTINCT FROM p_finalization_key
     OR v_draft.finalization_key IS NULL THEN
    RETURN QUERY SELECT 'finalization_conflict'::text, v_draft.id;
    RETURN;
  END IF;

  UPDATE public.order_drafts
     SET status = 'active',
         finalization_key = NULL
   WHERE id = p_draft_id
     AND status = 'converting'
     AND finalization_key IS NOT DISTINCT FROM p_finalization_key;

  RETURN QUERY SELECT 'released'::text, p_draft_id;
END;
$$;

COMMENT ON FUNCTION public.release_order_draft_finalization(
  uuid,
  uuid,
  uuid
) IS
  'Releases a matching converting draft claim back to active when no production order exists. Uploaded draft-file rows remain intact.';

REVOKE ALL ON FUNCTION public.release_order_draft_finalization(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_order_draft_finalization(uuid, uuid, uuid)
  TO service_role;

-- ------------------------------------------------------------
-- Recover stale finalization claims
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recover_stale_order_draft_finalization(
  p_user_id uuid,
  p_draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
  result_code text,
  recovered_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_stale_claim_cutoff timestamptz := now() - interval '15 minutes';
  v_recovered_count integer := 0;
BEGIN
  -- Trusted draft GET/list code calls this before active-only reads. It only
  -- recovers abandoned pre-order claims. It never releases or takes over a
  -- converting draft once a production order exists for source_draft_id.
  WITH stale AS (
    SELECT drafts.id
      FROM public.order_drafts AS drafts
     WHERE drafts.user_id IS NOT DISTINCT FROM p_user_id
       AND (p_draft_id IS NULL OR drafts.id IS NOT DISTINCT FROM p_draft_id)
       AND drafts.status = 'converting'
       AND drafts.deleted_at IS NULL
       AND drafts.expires_at > now()
       AND drafts.updated_at <= v_stale_claim_cutoff
       AND NOT EXISTS (
         SELECT 1
           FROM public.orders
          WHERE orders.source_draft_id IS NOT DISTINCT FROM drafts.id
       )
     FOR UPDATE
  )
  UPDATE public.order_drafts AS drafts
     SET status = 'active',
         finalization_key = NULL
    FROM stale
   WHERE drafts.id = stale.id;

  GET DIAGNOSTICS v_recovered_count = ROW_COUNT;
  RETURN QUERY SELECT 'recovered'::text, v_recovered_count;
END;
$$;

COMMENT ON FUNCTION public.recover_stale_order_draft_finalization(
  uuid,
  uuid
) IS
  'Best-effort service-role-only recovery for abandoned converting drafts. A converting claim older than 15 minutes and with no source-draft production order is returned to active so draft GET/list can resume it.';

REVOKE ALL ON FUNCTION public.recover_stale_order_draft_finalization(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stale_order_draft_finalization(uuid, uuid)
  TO service_role;

-- ------------------------------------------------------------
-- Complete finalization
-- ------------------------------------------------------------
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
  SELECT *
    INTO v_draft
    FROM public.order_drafts
   WHERE id = p_draft_id
   FOR UPDATE;

  IF NOT FOUND OR v_draft.user_id IS DISTINCT FROM p_user_id THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT *
    INTO v_order
    FROM public.orders
   WHERE id = p_order_id
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
    SELECT value FROM jsonb_array_elements(p_moved_files)
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

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]), count(*)::integer
    INTO v_live_file_ids, v_live_file_count
    FROM (
      SELECT id
        FROM public.order_draft_files
       WHERE draft_id = p_draft_id
         AND upload_status = 'uploaded'
         AND deleted_at IS NULL
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
    SELECT *
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

  -- finalization_key is cleared after conversion. Durable idempotency is
  -- enforced by orders.source_draft_id and order_drafts.converted_order_id.
  UPDATE public.order_drafts
     SET status = 'converted',
         converted_order_id = p_order_id,
         converted_at = now(),
         finalization_key = NULL,
         expires_at = GREATEST(expires_at, now() + interval '90 days')
   WHERE id = p_draft_id
     AND status = 'converting'
     AND finalization_key IS NOT DISTINCT FROM p_finalization_key;

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
