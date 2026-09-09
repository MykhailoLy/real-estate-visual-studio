-- ============================================================
-- PicchuSpot F-001: durable rework reference upload lifecycle
-- ============================================================
-- MANUAL MIGRATION ONLY. Review and approve before execution.
-- Do not run automatically from the application or Supabase CLI.
--
-- Rollout compatibility:
--   * historical rows are classified as uploaded;
--   * the pre-Phase-2 writer omits upload_status, so the uploaded
--     default preserves its current behavior during the rollout gap;
--   * Phase 2 must explicitly insert pending and set uploaded only
--     after server-side Storage verification.
--
-- This migration does not change reads, writers, RLS, grants,
-- Storage objects, bucket policies, or cleanup behavior.
-- ============================================================

BEGIN;

ALTER TABLE public.deliverable_review_files
  ADD COLUMN IF NOT EXISTS upload_status TEXT;

-- Fail closed if a partial/manual predecessor introduced a value
-- outside the lifecycle contract.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.deliverable_review_files
    WHERE upload_status IS NOT NULL
      AND upload_status NOT IN ('pending', 'uploaded')
  ) THEN
    RAISE EXCEPTION
      'deliverable_review_files.upload_status contains unsupported values';
  END IF;
END
$$;

-- Existing rows predate durable lifecycle tracking. The current
-- application already treats them as completed files, so preserve
-- that behavior and the previously verified historical files.
UPDATE public.deliverable_review_files
SET upload_status = 'uploaded'
WHERE upload_status IS NULL;

-- Compatibility bridge for the currently deployed writer. Phase 2
-- must provide pending explicitly when it creates a new upload slot.
ALTER TABLE public.deliverable_review_files
  ALTER COLUMN upload_status SET DEFAULT 'uploaded',
  ALTER COLUMN upload_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.deliverable_review_files'::pg_catalog.regclass
      AND conname = 'deliverable_review_files_upload_status_allowed'
  ) THEN
    ALTER TABLE public.deliverable_review_files
      ADD CONSTRAINT deliverable_review_files_upload_status_allowed
      CHECK (upload_status IN ('pending', 'uploaded')) NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.deliverable_review_files
  VALIDATE CONSTRAINT deliverable_review_files_upload_status_allowed;

COMMENT ON COLUMN public.deliverable_review_files.upload_status IS
  'Rework reference upload lifecycle. The uploaded default preserves pre-Phase-2 writers; Phase 2 must explicitly create pending rows and mark them uploaded only after server-side Storage verification.';

COMMIT;
