-- ============================================================
-- MIGRATION: add_deliverable_reviews
-- Phase 5D.1: client approval and per-image rework request flow
--
-- Creates deliverable_reviews — one row per review cycle for a
-- delivered file. Clients can approve or request rework. Each
-- rework cycle is a separate row, preserving full history.
--
-- Does NOT touch orders, order_items, order_deliverables,
-- order-files bucket, admin auth, env vars, or any existing
-- table/policy.
-- ============================================================

-- -----------------------------------------------------------
-- TABLE
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS deliverable_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The deliverable being reviewed.
  -- Cascade delete: review rows are cleaned up with the file.
  deliverable_id UUID NOT NULL
    REFERENCES order_deliverables(id) ON DELETE CASCADE,

  -- Denormalised for fast listing without extra JOINs.
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  item_index   INTEGER,            -- mirrors order_deliverables.item_index

  -- Client who submitted this review.
  -- Set server-side from the verified SSR session — never from client input.
  client_email TEXT NOT NULL,

  -- Review status. See state machine in PHASE5D-AUDIT.md §3b.
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

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Set by admin (Phase 5D.2) when a replacement file is uploaded.
  -- Points to the new order_deliverables row for the revised file.
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

-- Only one active rework open per deliverable at a time.
-- "Active" means rework_requested or rework_in_progress.
-- This partial unique index is the DB-level guard against
-- duplicate rework submissions (the API also checks first).
CREATE UNIQUE INDEX IF NOT EXISTS deliverable_reviews_one_active_rework
  ON deliverable_reviews (deliverable_id)
  WHERE status IN ('rework_requested', 'rework_in_progress');

-- -----------------------------------------------------------
-- UPDATED_AT TRIGGER
-- Reuses the update_updated_at() function created in schema.sql.
-- -----------------------------------------------------------
DROP TRIGGER IF EXISTS deliverable_reviews_updated_at ON deliverable_reviews;
CREATE TRIGGER deliverable_reviews_updated_at
  BEFORE UPDATE ON deliverable_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------
-- RLS
-- -----------------------------------------------------------
ALTER TABLE deliverable_reviews ENABLE ROW LEVEL SECURITY;

-- Clients may SELECT their own reviews (via order ownership).
DROP POLICY IF EXISTS "reviews_client_select_own" ON deliverable_reviews;
CREATE POLICY "reviews_client_select_own"
  ON deliverable_reviews
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE client_email = auth.email()
    )
  );

-- Clients may INSERT a review only for their own deliverables,
-- and only when client_email matches their verified session email.
-- Additional business-logic guards (terminal state, one-active-rework)
-- are enforced in the API route before the INSERT reaches here.
DROP POLICY IF EXISTS "reviews_client_insert_own" ON deliverable_reviews;
CREATE POLICY "reviews_client_insert_own"
  ON deliverable_reviews
  FOR INSERT
  WITH CHECK (
    client_email = auth.email()
    AND order_id IN (
      SELECT id FROM orders WHERE client_email = auth.email()
    )
  );

-- No client UPDATE or DELETE policy.
-- Admin uses the service role key (bypasses RLS) via server API routes.

-- -----------------------------------------------------------
-- GRANTS
-- -----------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT ON public.deliverable_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverable_reviews TO service_role;
