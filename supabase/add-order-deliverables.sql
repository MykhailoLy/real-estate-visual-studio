-- ============================================================
-- MIGRATION: add_order_deliverables
-- Phase 5B: client deliverables / files download system
--
-- Creates order_deliverables — one row per finished file the
-- admin uploads for an order.  The deliverables themselves live
-- in the private `deliverables` Supabase Storage bucket; this
-- table stores only the metadata needed to list and serve them.
--
-- Does NOT touch orders, order_items, order-files bucket, or
-- any existing table/policy.
-- ============================================================

-- -----------------------------------------------------------
-- TABLE
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_deliverables (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FK to orders — cascade delete so deliverable rows are
  -- cleaned up when an order is deleted.
  order_id     UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Denormalised for display/listing without an extra JOIN.
  order_number TEXT        NOT NULL,

  -- NULL = order-level file (e.g. a zip bundle spanning all items).
  -- Non-null = file for a specific item_index within the order.
  item_index   INTEGER,

  -- Path inside the `deliverables` bucket.
  -- Constructed server-side only; never accepted from client input.
  -- Format: <orderNumber>/<timestamp>-<safe-filename>
  storage_path TEXT        NOT NULL,

  -- Display filename shown to the client (sanitized server-side).
  filename     TEXT        NOT NULL,

  -- File size in bytes (used for display only).
  file_size    INTEGER     NOT NULL,

  -- MIME type as reported by the admin browser + server validation.
  mime_type    TEXT        NOT NULL,

  -- Who uploaded it.  Defaults to 'admin'; reserved for future
  -- team-member identifiers.
  uploaded_by  TEXT        NOT NULL DEFAULT 'admin',

  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Optional expiry for time-limited deliverables.
  -- NULL = no expiry (normal case for Phase 5B).
  expires_at   TIMESTAMPTZ
);

-- -----------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_deliverables_order_id
  ON order_deliverables (order_id);

CREATE INDEX IF NOT EXISTS idx_order_deliverables_order_number
  ON order_deliverables (order_number);

CREATE INDEX IF NOT EXISTS idx_order_deliverables_uploaded_at
  ON order_deliverables (uploaded_at DESC);

-- -----------------------------------------------------------
-- RLS
-- -----------------------------------------------------------
ALTER TABLE order_deliverables ENABLE ROW LEVEL SECURITY;

-- Authenticated clients may SELECT deliverable rows for their
-- own orders only (matched via orders.client_email = auth.email()).
--
-- Ownership is still email-based in Phase 5B, consistent with
-- the Phase 5A `orders` table design (no user_id FK yet).
-- TODO Phase 5C: switch to user_id FK + simpler RLS policy.
DROP POLICY IF EXISTS "deliverables_client_select_own" ON order_deliverables;
CREATE POLICY "deliverables_client_select_own"
  ON order_deliverables
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE client_email = auth.email()
    )
  );

-- No client INSERT / UPDATE / DELETE — admin uses service role
-- through server-only API routes (bypasses RLS entirely).


-- -----------------------------------------------------------
-- GRANTS FOR SERVICE_ROLE
--
-- Admin API routes use the service role key (bypasses RLS) to
-- INSERT and SELECT deliverables.  Explicit grants ensure the
-- service role has the required privileges even if the default
-- Supabase grants are modified in future migrations.
-- -----------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_deliverables TO service_role;
