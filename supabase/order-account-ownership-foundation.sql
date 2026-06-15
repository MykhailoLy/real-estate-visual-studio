-- ============================================================
-- ORDER ACCOUNT OWNERSHIP FOUNDATION — PicchuSpot
-- (PR 1 of the authenticated client-order migration)
-- ============================================================
-- Adds an ADDITIVE, backward-compatible authenticated-user
-- ownership link to public.orders:
--
--   orders.user_id  UUID NULL  REFERENCES auth.users(id)
--
-- This migration is intentionally NON-DESTRUCTIVE and idempotent:
--   - ADD COLUMN IF NOT EXISTS
--   - CREATE INDEX IF NOT EXISTS
--   - confirmed-email backfill guarded by `user_id IS NULL`
--   - ENABLE ROW LEVEL SECURITY (idempotent)
--   - DROP POLICY IF EXISTS + CREATE POLICY (idempotent)
--
-- SCOPE — what this migration does NOT touch:
--   - It does NOT remove, rename, rewrite, or make nullable any of
--     the existing snapshot columns (client_name, client_email,
--     client_phone, client_company). They are preserved for
--     historical accuracy and admin display.
--   - It does NOT modify order_sequences, generate_order_number(),
--     the update_updated_at trigger, Storage buckets/objects,
--     deliverables, reviews, rework tables, or admin policies.
--   - It does NOT add INSERT/UPDATE/DELETE policies. All writes
--     continue to flow through the existing server APIs using the
--     service-role client (which bypasses RLS).
--   - It does NOT add or change grants. The service-role grants
--     created by schema.sql remain the only table privileges, so
--     the current service-role-only architecture is unchanged.
--
-- HOW TO RUN: paste into the Supabase SQL Editor on the project
-- that already has schema.sql applied. Safe to re-run.
-- ============================================================

-- -----------------------------------------------------------
-- 1. ADD COLUMN (nullable + ON DELETE SET NULL)
-- -----------------------------------------------------------
-- Nullable so historical orders, guest orders, and any order
-- created before PR 2 remain valid. ON DELETE SET NULL keeps the
-- order (and its snapshot fields) intact if the auth user is ever
-- deleted.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

-- -----------------------------------------------------------
-- 2. INDEX
-- -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON public.orders(user_id);

-- -----------------------------------------------------------
-- 3. DIAGNOSTICS — INSPECT BEFORE BACKFILL (read-only)
-- -----------------------------------------------------------
-- The backfill UPDATE in step 4 only links an order to a user when
-- ALL of the following hold:
--   * orders.user_id IS NULL                       (never overwrite)
--   * auth.users.email_confirmed_at IS NOT NULL    (verified user)
--   * lower(orders.client_email) = lower(users.email)  (case-insensitive)
--
-- You can run these SELECTs FIRST (they mutate nothing) to inspect
-- exactly what the backfill will and will not touch. They are
-- included here so the result sets appear in the SQL Editor when the
-- script runs; they are safe to leave in place on re-runs.

-- (3a) Number of candidate orders that WILL be linked by the backfill.
SELECT
  'candidates_to_backfill' AS metric,
  COUNT(*) AS order_count
FROM public.orders o
JOIN auth.users u
  ON u.email_confirmed_at IS NOT NULL
 AND lower(o.client_email) = lower(u.email)
WHERE o.user_id IS NULL;

-- (3b) The exact (order -> user) matches the backfill will apply.
SELECT
  o.id            AS order_id,
  o.order_number  AS order_number,
  o.client_email  AS order_client_email,
  u.id            AS matched_user_id,
  u.email         AS matched_user_email
FROM public.orders o
JOIN auth.users u
  ON u.email_confirmed_at IS NOT NULL
 AND lower(o.client_email) = lower(u.email)
WHERE o.user_id IS NULL
ORDER BY o.order_number;

-- (3c) Orders that CANNOT be matched (no confirmed auth user for the
-- snapshot email). These remain user_id = NULL, intact, and visible
-- to admin (and to the dashboard via the controlled legacy fallback).
SELECT
  o.id            AS order_id,
  o.order_number  AS order_number,
  o.client_email  AS order_client_email
FROM public.orders o
WHERE o.user_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.email_confirmed_at IS NOT NULL
      AND lower(o.client_email) = lower(u.email)
  )
ORDER BY o.order_number;

-- -----------------------------------------------------------
-- 4. BACKFILL — safe confirmed-email matches only
-- -----------------------------------------------------------
-- auth.users.email is unique, so each order matches at most one
-- user. The `o.user_id IS NULL` guard makes this a no-op on re-run
-- and guarantees an existing non-null user_id is never overwritten.
UPDATE public.orders o
SET user_id = u.id
FROM auth.users u
WHERE o.user_id IS NULL
  AND u.email_confirmed_at IS NOT NULL
  AND lower(o.client_email) = lower(u.email);

-- -----------------------------------------------------------
-- 5. ROW LEVEL SECURITY (defensive)
-- -----------------------------------------------------------
-- Enable RLS on both tables. The service-role client bypasses RLS,
-- so all existing server APIs (order creation, dashboard reads,
-- admin) are UNAFFECTED. These policies only matter if a non
-- service-role (authenticated) client ever queries these tables.
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Own-row SELECT only. No INSERT/UPDATE/DELETE policies are defined
-- on purpose — writes must continue through the service-role APIs.
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "order_items_select_own" ON public.order_items;
CREATE POLICY "order_items_select_own"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------
-- NOTE: grants are intentionally unchanged. schema.sql grants the
-- relevant privileges to service_role only; anon/authenticated have
-- no direct table privileges, so the policies above are a
-- forward-looking safety net rather than an access change.
-- -----------------------------------------------------------
