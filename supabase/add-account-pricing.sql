-- Apply manually before deploying Partner Pricing. Do not backfill customer data.
-- Missing row means an ordinary account; only trusted server code manages rows.
BEGIN;

CREATE TABLE IF NOT EXISTS public.account_pricing (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_client BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.account_pricing ENABLE ROW LEVEL SECURITY;

-- No client policies. Explicit grants also deny direct authenticated writes.
REVOKE ALL ON TABLE public.account_pricing
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.account_pricing TO service_role;

COMMIT;
