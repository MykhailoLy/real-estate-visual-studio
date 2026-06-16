-- ============================================================
-- ADD ORDER JOB TITLE — PicchuSpot
-- (Image Enhancement types + shared Job Title foundation PR)
-- ============================================================
-- Adds an ADDITIVE, backward-compatible order-level Job Title to
-- public.orders:
--
--   orders.job_title  TEXT NULL
--
-- A Job Title is an order-level label the client gives the whole
-- order (e.g. "123 Main Street — Exterior Photos"). It is NOT item
-- metadata and is stored once per order, never per item.
--
-- This migration is intentionally NON-DESTRUCTIVE and idempotent:
--   - ADD COLUMN IF NOT EXISTS  (so re-runs are safe)
--   - the CHECK constraint is dropped + recreated inside a DO block
--     so re-running never errors on an already-present constraint
--
-- HISTORICAL DATA:
--   - Existing orders keep job_title = NULL. We DO NOT backfill any
--     fabricated titles — the client/admin/email layers fall back to
--     the generated "<Service> — <Order #>" label for NULL rows.
--
-- VALIDATION RULES (mirrored in the API zod schema):
--   - NULL                          → allowed (historical orders)
--   - "  " (whitespace only)        → rejected (trimmed length 0)
--   - 1–2 trimmed characters        → rejected
--   - 3–120 trimmed characters      → allowed
--   - > 120 characters              → rejected
--   New orders are required to send a valid Job Title through the API;
--   the column itself stays nullable purely so historical rows remain
--   valid.
--
-- SCOPE — what this migration does NOT touch:
--   - It does NOT alter existing RLS policies.
--   - It does NOT alter user ownership (orders.user_id) or any
--     snapshot columns.
--   - It does NOT modify order_sequences, generate_order_number(),
--     the update_updated_at trigger, Storage buckets/objects, or
--     any grants.
--
-- HOW TO RUN: paste into the Supabase SQL Editor on the project that
-- already has schema.sql applied. Safe to re-run.
--
-- ⚠️  DEPLOYMENT NOTE: the application code in this PR reads and writes
--     orders.job_title. RUN THIS MIGRATION MANUALLY in Supabase BEFORE
--     testing the Vercel Preview / before merging.
-- ============================================================

-- -----------------------------------------------------------
-- 1. ADD COLUMN (nullable)
-- -----------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS job_title TEXT NULL;

-- -----------------------------------------------------------
-- 2. CHECK CONSTRAINT — allow NULL, otherwise require a trimmed
--    length of 3–120 characters.
-- -----------------------------------------------------------
-- Dropped + recreated in a DO block so the migration is idempotent
-- and can be safely re-run without "constraint already exists" errors.
DO $$
BEGIN
  ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_job_title_length_chk;

  ALTER TABLE public.orders
    ADD CONSTRAINT orders_job_title_length_chk
    CHECK (
      job_title IS NULL
      OR char_length(btrim(job_title)) BETWEEN 3 AND 120
    );
END
$$;
