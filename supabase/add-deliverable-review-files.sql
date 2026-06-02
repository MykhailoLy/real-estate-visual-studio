-- ============================================================
-- MIGRATION: add_deliverable_review_files
-- Phase 5H.4: reference images/files attached to rework requests
--
-- Creates deliverable_review_files — one row per reference file a
-- client uploads alongside a rework request.
--
-- Files are stored in the private `order-files` bucket under the
-- path prefix:  rework/<reviewId>/<timestamp>-<safe-filename>
--
-- SECURITY CONTRACT:
-- • ALL writes go through the server API (service role key).
-- • Authenticated clients have NO direct INSERT access.
-- • storage_path is NEVER returned to the browser in any API
--   response — signed URLs are generated server-side only.
-- • Ownership is verified server-side before issuing a signed
--   upload URL: review must belong to the requesting client.
-- • Consistent with the order_deliverables and
--   deliverable_reviews patterns.
--
-- Run in the Supabase SQL Editor after merging this file.
-- Does NOT touch orders, order_items, order_deliverables,
-- deliverable_reviews, existing buckets, admin auth, env vars,
-- or any existing table/policy.
-- ============================================================

-- -----------------------------------------------------------
-- TABLE
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS deliverable_review_files (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The rework review this reference file is attached to.
  -- Cascade-delete removes file rows when a review is deleted.
  review_id       UUID        NOT NULL
    REFERENCES deliverable_reviews(id) ON DELETE CASCADE,

  -- Denormalised for fast listing without extra JOINs.
  order_id        UUID        NOT NULL
    REFERENCES orders(id) ON DELETE CASCADE,

  -- Denormalised — correlates the file to an image card without
  -- an extra join through deliverable_reviews.
  deliverable_id  UUID        NOT NULL
    REFERENCES order_deliverables(id) ON DELETE CASCADE,

  -- Mirrors deliverable_reviews.item_index for the same reason.
  item_index      INTEGER,

  -- Path inside the `order-files` bucket.
  -- Format: rework/<reviewId>/<timestamp>-<safe-filename>
  -- Constructed server-side only; NEVER returned to the browser.
  storage_path    TEXT        NOT NULL,

  -- Display filename (sanitized server-side, shown to admin only).
  filename        TEXT        NOT NULL,

  -- File size in bytes (used for display and validation only).
  file_size       INTEGER     NOT NULL,

  -- MIME type as validated by the server against an allowlist.
  mime_type       TEXT        NOT NULL,

  -- Always 'client' for rework reference files.
  -- Reserved for future team-member identifiers.
  uploaded_by     TEXT        NOT NULL DEFAULT 'client',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------

-- Primary lookup: all reference files for a review.
CREATE INDEX IF NOT EXISTS idx_review_files_review_id
  ON deliverable_review_files (review_id);

-- Admin page lookup: all reference files for an order.
CREATE INDEX IF NOT EXISTS idx_review_files_order_id
  ON deliverable_review_files (order_id);

-- Per-deliverable lookup for the image card view.
CREATE INDEX IF NOT EXISTS idx_review_files_deliverable_id
  ON deliverable_review_files (deliverable_id);

-- -----------------------------------------------------------
-- RLS
-- -----------------------------------------------------------
-- Enabled but NO authenticated INSERT / UPDATE / DELETE access.
-- All writes go through server API routes (service role bypasses RLS).
ALTER TABLE deliverable_review_files ENABLE ROW LEVEL SECURITY;

-- Clients may SELECT their own reference files (read-only).
-- Ownership chain: deliverable_review_files.order_id →
--   orders.id WHERE orders.client_email = auth.email()
DROP POLICY IF EXISTS "review_files_client_select_own"
  ON deliverable_review_files;
CREATE POLICY "review_files_client_select_own"
  ON deliverable_review_files
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE client_email = auth.email()
    )
  );

-- No authenticated INSERT, UPDATE, or DELETE policy.
-- Clients cannot write directly to this table.

-- -----------------------------------------------------------
-- GRANTS — service_role only for writes.
-- -----------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.deliverable_review_files TO service_role;
