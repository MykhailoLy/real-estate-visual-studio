-- ============================================================
-- PORTFOLIO MEDIA — PicchuSpot
-- ============================================================
-- Adds portfolio_items table, portfolio storage bucket, and the
-- read/write grants needed for the admin portfolio system.
--
-- Run this in the Supabase SQL Editor on the same project that
-- already has schema.sql applied. Safe to re-run: every statement
-- uses IF NOT EXISTS / ON CONFLICT / OR REPLACE.
--
-- IMPORTANT: This migration ONLY touches portfolio_* objects and
-- a brand-new `portfolio` storage bucket. It does NOT modify the
-- existing orders / order_items / order_sequences schema or the
-- existing private `order-files` bucket.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------
-- PORTFOLIO ITEMS
-- -----------------------------------------------------------
-- Each row represents one before/after pair the admin uploads
-- through /admin/portfolio. service_slug is one of the canonical
-- slugs the public site filters on (see src/lib/portfolio.ts).
--
-- before_image_path / after_image_path are object paths *within*
-- the `portfolio` bucket, e.g. "image-enhancement/2026-05-26-…jpg".
-- We store paths instead of full URLs so we can rotate the bucket
-- name or move to signed URLs later without a data migration.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_slug TEXT NOT NULL CHECK (
    service_slug IN (
      'image-enhancement',
      'day-to-dusk',
      'virtual-staging',
      'item-removal-virtual-cleaning',
      'floor-plans',
      'virtual-renovation',
      '360-image-enhancement',
      '360-virtual-staging',
      'aerial-editing',
      'development-site-plans'
    )
  ),
  title TEXT NOT NULL,
  description TEXT,
  before_image_path TEXT NOT NULL,
  after_image_path TEXT NOT NULL,
  before_alt TEXT,
  after_alt TEXT,
  -- Optional public-gallery filter category (e.g. virtual-staging
  -- style, renovation category, floor-plan type). Nullable; values
  -- are validated in the app layer (src/lib/gallery.ts).
  gallery_filter TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  featured_home BOOLEAN NOT NULL DEFAULT FALSE,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at. Reuses the function defined in schema.sql
-- (update_updated_at). If schema.sql hasn't been applied yet, the
-- trigger creation below will fail — but in that case the project
-- has no orders system either, so applying schema.sql first is the
-- intended order.
DROP TRIGGER IF EXISTS portfolio_items_updated_at ON portfolio_items;
CREATE TRIGGER portfolio_items_updated_at
  BEFORE UPDATE ON portfolio_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------
-- The public site reads by (service_slug, published, sort_order)
-- and (featured_home, published) — both happy paths get an index.
CREATE INDEX IF NOT EXISTS idx_portfolio_items_service_slug
  ON portfolio_items(service_slug);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_published
  ON portfolio_items(published);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_featured_home
  ON portfolio_items(featured_home);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_sort_order
  ON portfolio_items(service_slug, sort_order);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_gallery_filter
  ON portfolio_items(service_slug, gallery_filter);

-- -----------------------------------------------------------
-- ROW-LEVEL SECURITY
-- -----------------------------------------------------------
-- Read access: anyone can read PUBLISHED portfolio items. We
-- expose them on the marketing site, so this is appropriate.
-- Write access: nobody from the anon/authenticated keys. The
-- /api/admin/portfolio routes use the service-role key, which
-- bypasses RLS, so no INSERT/UPDATE/DELETE policies are needed.
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portfolio_items_public_read" ON portfolio_items;
CREATE POLICY "portfolio_items_public_read"
  ON portfolio_items
  FOR SELECT
  TO anon, authenticated
  USING (published = TRUE);

-- -----------------------------------------------------------
-- GRANTS
-- -----------------------------------------------------------
-- The service_role grant lets the admin server routes do all CRUD.
-- The anon SELECT grant is what RLS narrows down to "published only".
GRANT SELECT ON public.portfolio_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_items TO service_role;

-- -----------------------------------------------------------
-- STORAGE BUCKET — `portfolio`
-- -----------------------------------------------------------
-- Public-read bucket for marketing portfolio images. We deliberately
-- keep the existing `order-files` bucket private and untouched: this
-- migration only creates a NEW bucket called `portfolio`.
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio', 'portfolio', TRUE)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

-- Storage policies for the `portfolio` bucket. Public SELECT (the
-- bucket is already public-read, but explicit policies make the
-- intent obvious in the dashboard). Writes go through the service
-- role on the server, so no anon/authenticated write policies.
DROP POLICY IF EXISTS "portfolio_storage_public_read" ON storage.objects;
CREATE POLICY "portfolio_storage_public_read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'portfolio');
