-- ============================================================
-- SITE MEDIA — PicchuSpot
-- ============================================================
-- Adds the site_media_items table, a public `site-media` storage
-- bucket, and the read/write grants needed for the new
-- /admin/media surface.
--
-- Run this in the Supabase SQL Editor on the same project that
-- already has schema.sql + portfolio.sql applied. Safe to re-run:
-- every statement uses IF NOT EXISTS / ON CONFLICT / OR REPLACE.
--
-- IMPORTANT: This migration ONLY creates new objects — a new
-- `site_media_items` table and a new `site-media` storage bucket.
-- It does NOT modify the existing `orders` / `order_items` /
-- `portfolio_items` schema, the private `order-files` bucket, or
-- the public `portfolio` bucket. The new storage bucket is
-- separate so we can rotate / purge marketing media without ever
-- touching customer-uploaded order files.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------
-- SITE MEDIA ITEMS
-- -----------------------------------------------------------
-- Each row is one piece of admin-managed marketing media —
-- e.g. a homepage slider before/after pair, an About collage
-- tile, a 360 tour embed, or a future service-hero image.
--
-- Why not just reuse portfolio_items?
--   - portfolio_items is service-scoped (CHECK on service_slug)
--     and only models a before/after pair. site_media_items is
--     section-scoped, supports multiple media shapes, and never
--     constrains service_slug to a closed list.
--   - Keeping them separate lets us evolve schema for one
--     without risk of breaking the other.
--
-- Path columns are object paths INSIDE the `site-media` bucket
-- (e.g. "homepage-slider/<ts>-<rand>-before-foo.jpg"). We store
-- paths instead of full URLs so the bucket can be renamed or
-- moved to signed delivery later without a data migration.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Where on the site this item is intended to render.
  -- 'general' is a catch-all for items not yet wired into a
  -- specific section.
  section TEXT NOT NULL CHECK (
    section IN (
      'homepage-slider',
      'about-collage',
      'service-hero',
      '360-tour',
      'general'
    )
  ),

  -- Shape of the media itself. The /admin/media UI uses this
  -- to decide which path columns are required.
  --   before-after  : before_image_path + after_image_path
  --   image         : image_path
  --   panorama-360  : panorama_image_path (poster optional)
  --   embed         : embed_url (poster optional)
  --   video         : poster_image_path (embed_url optional)
  media_type TEXT NOT NULL CHECK (
    media_type IN (
      'before-after',
      'image',
      'panorama-360',
      'embed',
      'video'
    )
  ),

  title       TEXT,
  description TEXT,

  -- Free text. When set AND the value matches a portfolio
  -- service slug, the admin routes will also revalidate the
  -- matching pricing page. We deliberately do NOT add a CHECK
  -- here so the admin can attach service-hero items to slugs
  -- the public service pages don't render yet.
  service_slug TEXT,

  -- Object paths inside the `site-media` bucket. All optional;
  -- which ones are populated depends on media_type.
  before_image_path   TEXT,
  after_image_path    TEXT,
  image_path          TEXT,
  poster_image_path   TEXT,
  panorama_image_path TEXT,

  -- External embed URL (Kuula, Matterport, YouTube, etc.).
  embed_url TEXT,

  alt_text   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published  BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reuses the update_updated_at() function defined in schema.sql.
DROP TRIGGER IF EXISTS site_media_items_updated_at ON site_media_items;
CREATE TRIGGER site_media_items_updated_at
  BEFORE UPDATE ON site_media_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------
-- The public site reads by (section, published, sort_order).
-- The admin grid reads by (section, sort_order, created_at).
CREATE INDEX IF NOT EXISTS idx_site_media_items_section
  ON site_media_items(section);
CREATE INDEX IF NOT EXISTS idx_site_media_items_published
  ON site_media_items(published);
CREATE INDEX IF NOT EXISTS idx_site_media_items_section_sort
  ON site_media_items(section, sort_order);
CREATE INDEX IF NOT EXISTS idx_site_media_items_service_slug
  ON site_media_items(service_slug)
  WHERE service_slug IS NOT NULL;

-- -----------------------------------------------------------
-- ROW-LEVEL SECURITY
-- -----------------------------------------------------------
-- Read access: anyone can read PUBLISHED rows (the public site
-- needs them).
-- Write access: nobody from anon / authenticated. The admin
-- routes use the service-role key, which bypasses RLS, so no
-- INSERT/UPDATE/DELETE policies are needed.
ALTER TABLE site_media_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_media_items_public_read" ON site_media_items;
CREATE POLICY "site_media_items_public_read"
  ON site_media_items
  FOR SELECT
  TO anon, authenticated
  USING (published = TRUE);

-- -----------------------------------------------------------
-- GRANTS
-- -----------------------------------------------------------
GRANT SELECT ON public.site_media_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_media_items TO service_role;

-- -----------------------------------------------------------
-- STORAGE BUCKET — `site-media`
-- -----------------------------------------------------------
-- Public-read bucket for admin-managed marketing imagery. Kept
-- distinct from the existing `portfolio` bucket so each surface
-- can be cleared or rotated independently. The private
-- `order-files` bucket is NOT touched by this migration.
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-media', 'site-media', TRUE)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

-- Public SELECT policy. Writes go through the service role on
-- the server, so no anon/authenticated write policies.
DROP POLICY IF EXISTS "site_media_storage_public_read" ON storage.objects;
CREATE POLICY "site_media_storage_public_read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'site-media');
