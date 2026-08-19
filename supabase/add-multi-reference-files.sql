-- ============================================================
-- PicchuSpot: additive multi-reference file persistence
-- ============================================================
-- Manual migration. Do not run automatically from the application.
--
-- This migration is deliberately additive:
--   * legacy order_draft_files(kind = 'reference') rows remain valid;
--   * legacy order_items.reference_image_path remains valid;
--   * the existing order-files bucket and all existing constraints remain;
--   * current production code can continue to run before the application
--     release that understands these tables.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.order_draft_item_reference_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL
    REFERENCES public.order_drafts(id) ON DELETE CASCADE,
  item_client_id UUID NOT NULL,
  item_index INTEGER NULL,
  reference_id UUID NOT NULL,
  position SMALLINT NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'order-files',
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'uploaded',
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT order_draft_item_reference_files_position_allowed
    CHECK (position BETWEEN 0 AND 9),
  CONSTRAINT order_draft_item_reference_files_item_index_nonnegative
    CHECK (item_index IS NULL OR item_index >= 0),
  CONSTRAINT order_draft_item_reference_files_file_size_positive
    CHECK (file_size > 0),
  CONSTRAINT order_draft_item_reference_files_bucket_is_order_files
    CHECK (bucket = 'order-files'),
  CONSTRAINT order_draft_item_reference_files_status_allowed
    CHECK (upload_status IN ('pending', 'uploaded', 'failed', 'deleted')),
  CONSTRAINT order_draft_item_reference_files_identity_unique
    UNIQUE (draft_id, item_client_id, reference_id),
  CONSTRAINT order_draft_item_reference_files_storage_path_unique
    UNIQUE (storage_path)
);

CREATE UNIQUE INDEX IF NOT EXISTS order_draft_item_reference_files_live_position_unique
  ON public.order_draft_item_reference_files (draft_id, item_client_id, position)
  WHERE deleted_at IS NULL
    AND upload_status IN ('pending', 'uploaded');

CREATE INDEX IF NOT EXISTS idx_order_draft_item_reference_files_item
  ON public.order_draft_item_reference_files (
    draft_id,
    item_client_id,
    position,
    created_at
  )
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.order_item_reference_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL
    REFERENCES public.order_items(id) ON DELETE CASCADE,
  reference_id UUID NOT NULL,
  position SMALLINT NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'order-files',
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT order_item_reference_files_position_allowed
    CHECK (position BETWEEN 0 AND 9),
  CONSTRAINT order_item_reference_files_file_size_positive
    CHECK (file_size > 0),
  CONSTRAINT order_item_reference_files_bucket_is_order_files
    CHECK (bucket = 'order-files'),
  CONSTRAINT order_item_reference_files_identity_unique
    UNIQUE (order_item_id, reference_id),
  CONSTRAINT order_item_reference_files_position_unique
    UNIQUE (order_item_id, position),
  CONSTRAINT order_item_reference_files_storage_path_unique
    UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS idx_order_item_reference_files_order_item
  ON public.order_item_reference_files (order_item_id, position, created_at);

COMMENT ON TABLE public.order_draft_item_reference_files IS
  'Ordered, private, per-photo reference files for saved order drafts. Legacy order_draft_files reference rows remain as the position-zero rollback mirror.';

COMMENT ON TABLE public.order_item_reference_files IS
  'Ordered, private, per-photo reference files for finalized order items. Legacy order_items.reference_image_path remains as the position-zero rollback mirror.';

DROP TRIGGER IF EXISTS order_draft_item_reference_files_updated_at
  ON public.order_draft_item_reference_files;
CREATE TRIGGER order_draft_item_reference_files_updated_at
  BEFORE UPDATE ON public.order_draft_item_reference_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Backfill one active legacy draft reference as position zero. The legacy row
-- id is reused as the stable reference identity so reruns are deterministic.
INSERT INTO public.order_draft_item_reference_files (
  id,
  draft_id,
  item_client_id,
  item_index,
  reference_id,
  position,
  bucket,
  storage_path,
  original_filename,
  file_size,
  mime_type,
  upload_status,
  deleted_at,
  created_at,
  updated_at
)
SELECT
  files.id,
  files.draft_id,
  files.item_client_id,
  files.item_index,
  files.id,
  0,
  files.bucket,
  files.storage_path,
  files.original_filename,
  files.file_size,
  files.mime_type,
  files.upload_status,
  files.deleted_at,
  files.created_at,
  files.updated_at
FROM public.order_draft_files AS files
WHERE files.kind = 'reference'
  AND files.deleted_at IS NULL
  AND files.upload_status = 'uploaded'
ON CONFLICT DO NOTHING;

-- Backfill the legacy finalized reference path as position zero. Historical
-- metadata is recovered from details.uploaded_files.reference when available.
INSERT INTO public.order_item_reference_files (
  order_item_id,
  reference_id,
  position,
  bucket,
  storage_path,
  original_filename,
  file_size,
  mime_type,
  created_at
)
SELECT
  items.id,
  gen_random_uuid(),
  0,
  'order-files',
  items.reference_image_path,
  COALESCE(
    NULLIF(items.details #>> '{uploaded_files,reference,originalFilename}', ''),
    NULLIF(regexp_replace(items.reference_image_path, '^.*/', ''), ''),
    'reference'
  ),
  CASE
    WHEN items.details #>> '{uploaded_files,reference,size}' ~ '^[1-9][0-9]*$'
      THEN (items.details #>> '{uploaded_files,reference,size}')::BIGINT
    ELSE 1
  END,
  COALESCE(
    NULLIF(items.details #>> '{uploaded_files,reference,mimeType}', ''),
    'application/octet-stream'
  ),
  items.created_at
FROM public.order_items AS items
WHERE items.reference_image_path IS NOT NULL
  AND btrim(items.reference_image_path) <> ''
ON CONFLICT DO NOTHING;

ALTER TABLE public.order_draft_item_reference_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_reference_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_draft_item_reference_files_select_own
  ON public.order_draft_item_reference_files;
CREATE POLICY order_draft_item_reference_files_select_own
  ON public.order_draft_item_reference_files
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_drafts
      WHERE order_drafts.id = order_draft_item_reference_files.draft_id
        AND order_drafts.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS order_item_reference_files_select_own
  ON public.order_item_reference_files;
CREATE POLICY order_item_reference_files_select_own
  ON public.order_item_reference_files
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_items
      JOIN public.orders ON orders.id = order_items.order_id
      WHERE order_items.id = order_item_reference_files.order_item_id
        AND orders.user_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON public.order_draft_item_reference_files FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.order_item_reference_files FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.order_draft_item_reference_files TO authenticated;
GRANT SELECT ON public.order_item_reference_files TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.order_draft_item_reference_files TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.order_item_reference_files TO service_role;

COMMIT;
