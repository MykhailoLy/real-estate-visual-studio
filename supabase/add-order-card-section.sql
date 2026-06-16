-- ============================================================
-- SITE MEDIA — add 'order-card' section
-- ============================================================
-- Adds the new 'order-card' value to the site_media_items
-- section CHECK constraint so admins can upload one card image
-- per order service for the redesigned New Order hub at
-- /dashboard/orders/new.
--
-- Run this in the Supabase SQL Editor on the same project that
-- already has site-media.sql (and add-service-options-section.sql)
-- applied. Safe to re-run.
--
-- USAGE (Admin → Media → New):
--   Section:      Order card
--   Media type:   Image
--   Service slug: the order service slug, one of:
--                 image-enhancement, day-to-dusk, virtual-staging,
--                 item-removal-virtual-cleaning, floor-plans,
--                 virtual-renovation, 360-image-enhancement,
--                 360-virtual-staging, aerial-editing,
--                 development-site-plans
--   Alt text:     short description of the card image
--   Published:    Yes
--
-- The card title, description, price label and CTA remain
-- code-defined in src/lib/order-services.ts. Only the card
-- image/preview is admin-managed. When no published image exists
-- for a service, the hub renders a branded CSS fallback.
--
-- SCOPE: This migration ONLY alters the section CHECK constraint
-- on site_media_items. It does NOT touch orders / order_items /
-- portfolio_items, any storage bucket, RLS policies, grants, or
-- any other table.
-- ============================================================

-- -----------------------------------------------------------
-- Drop the existing CHECK constraint and re-add it with the
-- extended value list. PostgreSQL has no ALTER ... MODIFY
-- CONSTRAINT, so we drop + re-add. The constraint was created
-- inline in CREATE TABLE so Postgres auto-named it
-- site_media_items_section_check. The full list below preserves
-- every previously-allowed section (including 'service-options'
-- added by add-service-options-section.sql) and adds 'order-card'.
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
      'general',
      'order-card'
    )
  );
