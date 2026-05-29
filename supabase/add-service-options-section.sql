-- ============================================================
-- SITE MEDIA — add 'service-options' section
-- ============================================================
-- Adds the new 'service-options' value to the site_media_items
-- section CHECK constraint so admins can upload images for
-- individual service option cards (e.g. the Floor Plans "Plan
-- options" grid at /pricing/floor-plans).
--
-- Run this in the Supabase SQL Editor on the same project that
-- already has site-media.sql applied. Safe to re-run.
--
-- USAGE:
--   Section:    Service options
--   Service slug: floor-plans  (or any future service slug)
--   Media type: Image
--   Sort order: 1 = card 1, 2 = card 2, … 9 = card 9
--   Published:  Yes
--
-- Mapping for Floor Plans (/pricing/floor-plans):
--   sort_order = 1 → 2D Black & White Plan
--   sort_order = 2 → 2D Color Plan
--   sort_order = 3 → 2D Furnished Plan
--   sort_order = 4 → 3D Floor Plan
--   sort_order = 5 → Site / Development Plan
--   sort_order = 6 → Interactive-Ready Plan
--   sort_order = 7 → 2D Plan With Dimensions
--   sort_order = 8 → Marketing Floor Plan
--   sort_order = 9 → Multi-Level Floor Plan
--
-- The card title, description, and hover behaviour remain
-- code-defined. Only the image/preview area is admin-managed.
-- ============================================================

-- -----------------------------------------------------------
-- 1. Drop the old CHECK constraint and replace it with one
--    that includes 'service-options'.
--
-- PostgreSQL does not support ALTER TABLE … MODIFY CONSTRAINT,
-- so the safest approach is:
--   a. Drop the named constraint (if it has no name, list it
--      with \d site_media_items and replace the name below).
--   b. Re-add the constraint with the extended value list.
--
-- The constraint was created inline in the CREATE TABLE
-- statement in site-media.sql so Postgres auto-names it
-- site_media_items_section_check. Adjust the name if yours
-- differs.
-- -----------------------------------------------------------

ALTER TABLE site_media_items
  DROP CONSTRAINT IF EXISTS site_media_items_section_check;

ALTER TABLE site_media_items
  ADD CONSTRAINT site_media_items_section_check
  CHECK (
    section IN (
      'homepage-slider',
      'about-collage',
      'service-hero',
      'service-options',
      '360-tour',
      'general'
    )
  );
