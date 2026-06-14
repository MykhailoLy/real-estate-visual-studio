-- ============================================================
-- PORTFOLIO GALLERY FILTER — PicchuSpot
-- ============================================================
-- Adds a single nullable `gallery_filter` column to
-- portfolio_items so the public gallery detail pages can offer a
-- category filter (Virtual Staging style, Virtual Renovation
-- category, Floor Plan type). Values are validated in the
-- application layer (see src/lib/gallery.ts); the column itself
-- is a free-form nullable TEXT so adding new categories later
-- needs no further migration.
--
-- Run this in the Supabase SQL Editor on the project that already
-- has portfolio.sql applied. Safe to re-run: the statement uses
-- IF NOT EXISTS.
--
-- SCOPE: This migration ONLY adds a column to portfolio_items.
-- It does NOT touch orders / order_items / order_sequences, the
-- order-files storage bucket, the portfolio storage bucket, or
-- any RLS policy.
-- ============================================================

ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS gallery_filter TEXT;

-- Optional helper index: the public gallery filters client-side
-- over already-fetched rows, so this is only a minor convenience
-- for admin/reporting queries that group by category. Kept narrow
-- and idempotent.
CREATE INDEX IF NOT EXISTS idx_portfolio_items_gallery_filter
  ON public.portfolio_items(service_slug, gallery_filter);
