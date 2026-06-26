-- ============================================================
-- MIGRATION: add_order_drafts
-- Step 1: authenticated order-drafts foundation
--
-- Creates draft-only tables for authenticated order builders.
-- Drafts are separate from production orders: no order number is
-- generated, no payment is created, and no production order is
-- written until a later server-mediated final submission step.
--
-- Pricing preview data is non-authoritative. Canonical pricing
-- must be recalculated by trusted server code at final submission.
--
-- Files will later use the existing private `order-files` bucket
-- with paths shaped as:
--   drafts/{user_id}/{draft_id}/{file_id}/{sanitized_filename}
--
-- SECURITY CONTRACT:
-- - Authenticated users may read only their own drafts/files.
-- - No direct authenticated INSERT, UPDATE, or DELETE is allowed.
-- - All mutations will be added later through server-mediated
--   routes using the service-role client.
--
-- Run manually in the Supabase SQL Editor after review.
-- Do NOT execute automatically through Supabase CLI.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------
-- TABLE: order_drafts
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  sub_service TEXT NULL,
  route TEXT NOT NULL,
  title TEXT NULL,
  current_step TEXT NOT NULL DEFAULT 'configure',
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  state_schema_version INTEGER NOT NULL DEFAULT 1,
  pricing_preview JSONB NULL,
  pricing_version_seen TEXT NULL,
  currency TEXT NOT NULL,
  region TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  finalization_key UUID NULL,
  converted_order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_autosaved_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  converted_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,

  CONSTRAINT order_drafts_state_is_object
    CHECK (jsonb_typeof(state) = 'object'),
  CONSTRAINT order_drafts_pricing_preview_is_object
    CHECK (
      pricing_preview IS NULL
      OR jsonb_typeof(pricing_preview) = 'object'
    ),
  CONSTRAINT order_drafts_state_schema_version_positive
    CHECK (state_schema_version >= 1),
  CONSTRAINT order_drafts_version_positive
    CHECK (version >= 1),
  CONSTRAINT order_drafts_status_allowed
    CHECK (
      status IN (
        'active',
        'converting',
        'converted',
        'deleted',
        'expired'
      )
    )
);

COMMENT ON TABLE public.order_drafts IS
  'Authenticated draft orders, kept separate from production orders until server-mediated final submission.';

COMMENT ON COLUMN public.order_drafts.pricing_preview IS
  'Non-authoritative pricing preview. Canonical pricing is recalculated by trusted server code at final submission.';

COMMENT ON COLUMN public.order_drafts.converted_order_id IS
  'Production order created from this draft after trusted server finalization, when applicable.';

-- -----------------------------------------------------------
-- TABLE: order_draft_files
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_draft_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.order_drafts(id) ON DELETE CASCADE,
  item_client_id UUID NOT NULL,
  item_index INTEGER NULL,
  kind TEXT NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'order-files',
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  content_hash TEXT NULL,
  upload_status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  moved_at TIMESTAMPTZ NULL,

  CONSTRAINT order_draft_files_file_size_positive
    CHECK (file_size > 0),
  CONSTRAINT order_draft_files_kind_allowed
    CHECK (kind IN ('original', 'reference')),
  CONSTRAINT order_draft_files_upload_status_allowed
    CHECK (
      upload_status IN (
        'pending',
        'uploaded',
        'failed',
        'deleted',
        'moved'
      )
    ),
  CONSTRAINT order_draft_files_bucket_is_order_files
    CHECK (bucket = 'order-files')
);

COMMENT ON TABLE public.order_draft_files IS
  'Draft file metadata for the existing private order-files bucket. Ownership is inherited from the parent order_drafts row.';

COMMENT ON COLUMN public.order_draft_files.storage_path IS
  'Future server-generated path inside order-files: drafts/{user_id}/{draft_id}/{file_id}/{sanitized_filename}.';

-- -----------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_drafts_user_status_updated
  ON public.order_drafts (user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_drafts_user_expires
  ON public.order_drafts (user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_order_draft_files_draft_created
  ON public.order_draft_files (draft_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS order_drafts_finalization_key_unique
  ON public.order_drafts (finalization_key)
  WHERE finalization_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS order_drafts_converted_order_id_unique
  ON public.order_drafts (converted_order_id)
  WHERE converted_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS order_draft_files_storage_path_unique
  ON public.order_draft_files (storage_path);

CREATE UNIQUE INDEX IF NOT EXISTS order_draft_files_one_active_kind_per_item
  ON public.order_draft_files (draft_id, item_client_id, kind)
  WHERE deleted_at IS NULL
    AND upload_status NOT IN ('deleted', 'moved');

-- -----------------------------------------------------------
-- UPDATED_AT TRIGGERS
-- -----------------------------------------------------------
-- Reuses update_updated_at() from schema.sql. Do not replace that
-- shared helper with incompatible behavior.
DROP TRIGGER IF EXISTS order_drafts_updated_at ON public.order_drafts;
CREATE TRIGGER order_drafts_updated_at
  BEFORE UPDATE ON public.order_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS order_draft_files_updated_at ON public.order_draft_files;
CREATE TRIGGER order_draft_files_updated_at
  BEFORE UPDATE ON public.order_draft_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- -----------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------
ALTER TABLE public.order_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_draft_files ENABLE ROW LEVEL SECURITY;

-- Own-row SELECT only. No authenticated INSERT, UPDATE, or DELETE
-- policies are defined on purpose; writes must go through later
-- server-mediated routes.
DROP POLICY IF EXISTS "order_drafts_select_own"
  ON public.order_drafts;
CREATE POLICY "order_drafts_select_own"
  ON public.order_drafts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- File ownership is inherited from the parent draft.
DROP POLICY IF EXISTS "order_draft_files_select_own"
  ON public.order_draft_files;
CREATE POLICY "order_draft_files_select_own"
  ON public.order_draft_files
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_drafts
      WHERE order_drafts.id = order_draft_files.draft_id
        AND order_drafts.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------
-- GRANTS
-- -----------------------------------------------------------
-- Anonymous users have no table access. Authenticated users get
-- SELECT only, narrowed by RLS. No broad mutation grants are given
-- to browser roles. The service role keeps full server-side access
-- and bypasses RLS for trusted API routes.
GRANT USAGE ON SCHEMA public TO service_role;

REVOKE ALL ON public.order_drafts FROM anon, authenticated;
REVOKE ALL ON public.order_draft_files FROM anon, authenticated;

GRANT SELECT ON public.order_drafts TO authenticated;
GRANT SELECT ON public.order_draft_files TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_drafts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_draft_files TO service_role;

-- -----------------------------------------------------------
-- Manual rollback, only before any production draft data must be
-- retained:
-- DROP TABLE IF EXISTS public.order_draft_files;
-- DROP TABLE IF EXISTS public.order_drafts;
-- -----------------------------------------------------------
