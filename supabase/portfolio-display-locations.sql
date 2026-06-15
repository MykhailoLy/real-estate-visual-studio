-- ============================================================
-- PORTFOLIO DISPLAY LOCATIONS — PicchuSpot
-- ============================================================
-- Adds two independent public display-location flags to
-- public.portfolio_items so the admin can control, per item,
-- whether a published before/after pair appears:
--
--   show_in_gallery       → public Gallery (/gallery/*, /es/gallery/*)
--   show_on_service_page  → public pricing/service page examples
--
-- The existing `featured_home` flag continues to control the
-- homepage independently and is NOT touched by this migration.
--
-- Run this in the Supabase SQL Editor on the project that already
-- has schema.sql + portfolio.sql applied. Safe to re-run: every
-- statement is idempotent (ADD COLUMN IF NOT EXISTS, UPDATE ...
-- WHERE ... IS NULL, ALTER ... SET, CREATE INDEX IF NOT EXISTS).
--
-- SCOPE: This migration ONLY adds columns + indexes to
-- portfolio_items. It does NOT touch orders / order_items /
-- order_sequences, RLS policies, the `order-files` bucket, the
-- `portfolio` bucket, storage objects, or any function.
-- ============================================================

-- -----------------------------------------------------------
-- 1. ADD COLUMNS (nullable first, so existing rows get NULL and
--    we can backfill them deterministically below).
-- -----------------------------------------------------------
ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS show_in_gallery BOOLEAN;

ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS show_on_service_page BOOLEAN;

-- -----------------------------------------------------------
-- 2. BACKFILL EXISTING ROWS — preserve current production
--    behaviour: every existing item currently shows BOTH in the
--    Gallery and on its Service page, so backfill both to TRUE.
--    The `WHERE ... IS NULL` guard makes this a no-op on re-run.
-- -----------------------------------------------------------
UPDATE public.portfolio_items
  SET show_in_gallery = TRUE
  WHERE show_in_gallery IS NULL;

UPDATE public.portfolio_items
  SET show_on_service_page = TRUE
  WHERE show_on_service_page IS NULL;

-- -----------------------------------------------------------
-- 3. DEFAULTS FOR FUTURE INSERTS — new items default to
--    Gallery ON and Service Page OFF. (This intentionally
--    differs from the backfill above: existing rows are kept in
--    both destinations, while NEW items start gallery-only.)
-- -----------------------------------------------------------
ALTER TABLE public.portfolio_items
  ALTER COLUMN show_in_gallery SET DEFAULT TRUE;

ALTER TABLE public.portfolio_items
  ALTER COLUMN show_on_service_page SET DEFAULT FALSE;

-- -----------------------------------------------------------
-- 4. ENFORCE NOT NULL (safe now that every row is backfilled).
-- -----------------------------------------------------------
ALTER TABLE public.portfolio_items
  ALTER COLUMN show_in_gallery SET NOT NULL;

ALTER TABLE public.portfolio_items
  ALTER COLUMN show_on_service_page SET NOT NULL;

-- -----------------------------------------------------------
-- 5. INDEXES for the public read patterns. Each public reader
--    filters by (service_slug, published, <flag>) and orders by
--    sort_order, so a composite index covers the happy path.
-- -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_portfolio_items_gallery_read
  ON public.portfolio_items(service_slug, published, show_in_gallery, sort_order);

CREATE INDEX IF NOT EXISTS idx_portfolio_items_service_page_read
  ON public.portfolio_items(service_slug, published, show_on_service_page, sort_order);

-- -----------------------------------------------------------
-- NOTE ON RLS: the public read policy stays "published = TRUE".
-- Display-location filtering (show_in_gallery / show_on_service_page)
-- is applied in the application queries (src/lib/portfolio.ts), not
-- in RLS, so the admin (service-role) keeps full visibility.
-- -----------------------------------------------------------
