-- Phase 1 canonical pricing snapshot.
--
-- Run this migration manually BEFORE deploying application code that writes
-- orders.pricing_snapshot. Existing orders remain NULL and continue using
-- estimated_total_cents + currency without being repriced.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB NULL;

COMMENT ON COLUMN public.orders.pricing_snapshot IS
  'Versioned immutable transactional pricing snapshot. NULL for legacy orders.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_pricing_snapshot_is_object'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_pricing_snapshot_is_object
      CHECK (
        pricing_snapshot IS NULL
        OR jsonb_typeof(pricing_snapshot) = 'object'
      );
  END IF;
END
$$;

-- Manual rollback, only if no new snapshots need to be retained:
-- ALTER TABLE public.orders
--   DROP CONSTRAINT IF EXISTS orders_pricing_snapshot_is_object;
-- ALTER TABLE public.orders
--   DROP COLUMN IF EXISTS pricing_snapshot;
