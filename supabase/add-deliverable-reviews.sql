-- ============================================================
-- MIGRATION: add_deliverable_reviews
-- Phase 5D.1: client approval and per-image rework request flow
--
-- Creates deliverable_reviews — one row per review cycle for a
-- delivered file. Clients approve or request rework via server
-- API route only:
--   POST /api/client/deliverables/[deliverableId]/review
--
-- ALL writes go through the server (service role key).
-- Authenticated clients have NO direct INSERT access.
-- Consistent with the order_deliverables pattern.
--
-- Does NOT touch orders, order_items, order_deliverables,
-- order-files bucket, deliverables bucket, admin auth,
-- env vars, or any existing table/policy.
-- ============================================================

-- -----------------------------------------------------------
-- TABLE
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS deliverable_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The deliverable being reviewed.
  deliverable_id UUID NOT NULL
    REFERENCES order_deliverables(id) ON DELETE CASCADE,

  -- Denormalised for fast listing without extra JOINs.
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  item_index   INTEGER,           -- mirrors order_deliverables.item_index

  -- Client who submitted. Set server-side from verified SSR session only.
  client_email TEXT NOT NULL,

  -- Review lifecycle status.
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN (
      'pending_review',
      'approved',
      'rework_requested',
      'rework_in_progress',
      'rework_delivered',
      'resolved'
    )),

  -- Client comment (required for rework_requested; null for approved).
  comment TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Set by admin (Phase 5D.2) when a replacement file is uploaded.
  replacement_deliverable_id UUID
    REFERENCES order_deliverables(id) ON DELETE SET NULL
);

-- -----------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_deliverable_reviews_deliverable_id
  ON deliverable_reviews (deliverable_id);

CREATE INDEX IF NOT EXISTS idx_deliverable_reviews_order_id
  ON deliverable_reviews (order_id);

CREATE INDEX IF NOT EXISTS idx_deliverable_reviews_client_email
  ON deliverable_reviews (client_email);

CREATE INDEX IF NOT EXISTS idx_deliverable_reviews_status
  ON deliverable_reviews (status);

CREATE INDEX IF NOT EXISTS idx_deliverable_reviews_created_at
  ON deliverable_reviews (created_at DESC);

-- Only one active rework per deliverable at a time.
-- DB-level atomic guard against concurrent duplicate submissions.
CREATE UNIQUE INDEX IF NOT EXISTS deliverable_reviews_one_active_rework
  ON deliverable_reviews (deliverable_id)
  WHERE status IN ('rework_requested', 'rework_in_progress');

-- -----------------------------------------------------------
-- UPDATED_AT TRIGGER (reuses existing function from schema.sql)
-- -----------------------------------------------------------
DROP TRIGGER IF EXISTS deliverable_reviews_updated_at ON deliverable_reviews;
CREATE TRIGGER deliverable_reviews_updated_at
  BEFORE UPDATE ON deliverable_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------
-- RLS — enabled but NO authenticated write access.
-- All writes go through server API (service role bypasses RLS).
-- -----------------------------------------------------------
ALTER TABLE deliverable_reviews ENABLE ROW LEVEL SECURITY;

-- Clients may SELECT their own reviews (read-only, defence-in-depth).
DROP POLICY IF EXISTS "reviews_client_select_own" ON deliverable_reviews;
CREATE POLICY "reviews_client_select_own"
  ON deliverable_reviews
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE client_email = auth.email()
    )
  );

-- No authenticated INSERT, UPDATE, or DELETE policy.

-- -----------------------------------------------------------
-- GRANTS — service_role only for writes.
-- -----------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverable_reviews TO service_role;
