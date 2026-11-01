-- Apply manually after schema.sql and add-order-drafts.sql. No existing
-- table, policy or order-submission function is altered.
BEGIN;

CREATE TABLE IF NOT EXISTS public.guest_order_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  service_type text NOT NULL DEFAULT 'virtual-staging' CHECK (service_type = 'virtual-staging'),
  route text NOT NULL DEFAULT '/dashboard/orders/new/virtual-staging' CHECK (route = '/dashboard/orders/new/virtual-staging'),
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  state_schema_version integer NOT NULL DEFAULT 1 CHECK (state_schema_version = 1),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','EUR','CAD')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  claimed_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_draft_id uuid REFERENCES public.order_drafts(id) ON DELETE CASCADE,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  CONSTRAINT guest_order_drafts_claim_consistent CHECK (num_nonnulls(claimed_by, claimed_draft_id, claimed_at) IN (0,3))
);
CREATE UNIQUE INDEX IF NOT EXISTS guest_order_drafts_claimed_draft_unique
  ON public.guest_order_drafts(claimed_draft_id) WHERE claimed_draft_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS guest_order_drafts_expires_at_idx ON public.guest_order_drafts(expires_at);

DROP TRIGGER IF EXISTS guest_order_drafts_updated_at ON public.guest_order_drafts;
CREATE TRIGGER guest_order_drafts_updated_at BEFORE UPDATE ON public.guest_order_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.guest_order_drafts ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
REVOKE ALL ON public.guest_order_drafts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_order_drafts TO service_role;

-- Match JS string limits (UTF-16 code units, including surrogate pairs).
CREATE OR REPLACE FUNCTION public.guest_draft_text_ok(value jsonb, max_length integer)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = pg_catalog AS $$
  SELECT coalesce(jsonb_typeof(value) = 'string'
    AND length(s) + length(regexp_replace(s, U&'[^\+010000-\+10FFFF]', '', 'g')) <= max_length
    AND s !~* '(\m(data|blob|file):|\m(order-files|deliverables|drafts|pending|rework|storage/v1/object|(VS|VR|FP|PE|ORD)-[0-9]+)/|[?&](token|signature|sig|x-(amz|goog)-signature)=)'
    AND NOT (length(trim(s)) > 4096 AND length(trim(s)) % 4 = 0 AND trim(s) ~ '^[A-Za-z0-9+/]+={0,2}$'), false)
  FROM (SELECT value #>> '{}' AS s) t;
$$;

CREATE OR REPLACE FUNCTION public.is_valid_guest_virtual_staging_state(s jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE
  item jsonb;
  config jsonb;
  addon jsonb;
  seen_ids text[] := '{}';
  seen_addons text[];
  item_id text;
BEGIN
  IF jsonb_typeof(s) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF s - ARRAY['schemaVersion','jobTitle','currentStep','defaultFurnitureStyle','items','metadata','termsUi'] <> '{}'
     OR s->'schemaVersion' IS DISTINCT FROM '1'::jsonb
     OR s->>'currentStep' IS DISTINCT FROM 'virtual-staging-form'
     OR s->'metadata' IS DISTINCT FROM '{"service":"virtual-staging"}'::jsonb
     OR s->'termsUi' IS DISTINCT FROM '{"accepted":false,"earlyPerformanceRequested":false,"allowPortfolio":false}'::jsonb
     OR NOT public.guest_draft_text_ok(s->'jobTitle',120)
     OR NOT public.guest_draft_text_ok(s->'defaultFurnitureStyle',200)
     OR jsonb_typeof(s->'items') IS DISTINCT FROM 'array'
  THEN RETURN false; END IF;
  IF jsonb_array_length(s->'items') NOT BETWEEN 1 AND 50 THEN RETURN false; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(s->'items') LOOP
    IF jsonb_typeof(item) <> 'object' THEN RETURN false; END IF;
    config := item->'state';
    item_id := lower(item->>'clientItemId');
    IF item - ARRAY['clientItemId','state'] <> '{}' OR item_id IS NULL
       OR item_id !~ '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$'
       OR item_id = ANY(seen_ids) OR jsonb_typeof(config) IS DISTINCT FROM 'object'
    THEN RETURN false; END IF;
    seen_ids := array_append(seen_ids,item_id);
    IF config - ARRAY['roomName','furnitureStyle','additionalInfo','selectedAddons'] <> '{}'
       OR NOT public.guest_draft_text_ok(config->'roomName',200)
       OR NOT public.guest_draft_text_ok(config->'furnitureStyle',200)
       OR NOT public.guest_draft_text_ok(config->'additionalInfo',5000)
       OR jsonb_typeof(config->'selectedAddons') IS DISTINCT FROM 'array'
    THEN RETURN false; END IF;
    seen_addons := '{}';
    FOR addon IN SELECT value FROM jsonb_array_elements(config->'selectedAddons') LOOP
      IF jsonb_typeof(addon) <> 'string' OR addon #>> '{}' NOT IN
        ('image-enhancement','day-to-dusk','item-removal','shadow-removal','turn-on-lights','colour-change')
        OR (addon #>> '{}') = ANY(seen_addons)
      THEN RETURN false; END IF;
      seen_addons := array_append(seen_addons, addon #>> '{}');
    END LOOP;
  END LOOP;
  RETURN true;
END;
$$;

-- A single conditional UPDATE is also serialized against claim's FOR UPDATE.
-- Use the database clock for both the expiry predicate and its extension.
CREATE OR REPLACE FUNCTION public.save_guest_order_draft(
  p_token_hash text, p_expected_draft_id uuid, p_expected_version integer, p_state jsonb, p_currency text
) RETURNS SETOF public.guest_order_drafts LANGUAGE sql SECURITY INVOKER SET search_path = pg_catalog AS $$
  UPDATE public.guest_order_drafts SET state = p_state, currency = p_currency,
    version = version + 1, expires_at = clock_timestamp() + interval '30 days'
  WHERE token_hash = p_token_hash AND id = p_expected_draft_id AND version = p_expected_version
    AND claimed_by IS NULL AND expires_at > clock_timestamp()
  RETURNING *;
$$;

CREATE OR REPLACE FUNCTION public.claim_guest_order_draft(
  p_user_id uuid, p_token_hash text, p_expected_draft_id uuid, p_expected_version integer
) RETURNS TABLE(result_code text, draft_id uuid, draft_version integer, draft_status text, guest_expires_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE
  guest public.guest_order_drafts%ROWTYPE;
  draft public.order_drafts%ROWTYPE;
  claimed_time timestamptz;
BEGIN
  SELECT * INTO guest FROM public.guest_order_drafts WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR p_user_id IS NULL THEN result_code := 'not_found';
  ELSIF guest.claimed_by IS NOT NULL AND guest.claimed_by <> p_user_id THEN result_code := 'not_found';
  ELSIF guest.id IS DISTINCT FROM p_expected_draft_id THEN result_code := 'context_mismatch';
  ELSIF guest.claimed_by IS NOT NULL THEN
    SELECT * INTO draft FROM public.order_drafts WHERE id = guest.claimed_draft_id AND user_id = p_user_id;
    IF FOUND THEN
      result_code := 'already_claimed';
      guest_expires_at := guest.expires_at;
    ELSE result_code := 'not_found';
    END IF;
  ELSIF guest.expires_at <= clock_timestamp() THEN result_code := 'expired';
  ELSIF guest.service_type <> 'virtual-staging' THEN result_code := 'invalid_service';
  ELSIF guest.route <> '/dashboard/orders/new/virtual-staging' THEN result_code := 'invalid_route';
  ELSIF guest.state_schema_version <> 1 OR NOT public.is_valid_guest_virtual_staging_state(guest.state)
    THEN result_code := 'invalid_state';
  ELSIF guest.version IS DISTINCT FROM p_expected_version THEN result_code := 'version_conflict';
  ELSE
    claimed_time := clock_timestamp();
    INSERT INTO public.order_drafts (
      user_id, service_type, sub_service, route, title, current_step, state, state_schema_version,
      pricing_preview, pricing_version_seen, currency, region, status, version, finalization_key,
      converted_order_id, created_at, updated_at, last_autosaved_at, expires_at, converted_at, deleted_at
    ) VALUES (
      p_user_id, guest.service_type, NULL, guest.route, nullif(btrim(guest.state->>'jobTitle'), ''),
      guest.state->>'currentStep', guest.state, guest.state_schema_version, NULL, NULL, guest.currency,
      CASE guest.currency WHEN 'CAD' THEN 'CA' WHEN 'EUR' THEN 'EU' ELSE 'US' END, 'active', 1, NULL,
      NULL, claimed_time, claimed_time, claimed_time, claimed_time + interval '30 days', NULL, NULL
    ) RETURNING * INTO STRICT draft;
    -- STRICT also aborts the INSERT if a BEFORE UPDATE trigger suppresses the update.
    UPDATE public.guest_order_drafts SET claimed_by = p_user_id, claimed_draft_id = draft.id,
      claimed_at = claimed_time, expires_at = claimed_time + interval '30 days'
    WHERE id = guest.id AND claimed_by IS NULL RETURNING expires_at INTO STRICT guest_expires_at;
    result_code := 'claimed';
  END IF;
  draft_id := draft.id;
  draft_version := draft.version;
  draft_status := draft.status;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.guest_draft_text_ok(jsonb,integer),
  public.is_valid_guest_virtual_staging_state(jsonb),
  public.save_guest_order_draft(text,uuid,integer,jsonb,text),
  public.claim_guest_order_draft(uuid,text,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_draft_text_ok(jsonb,integer),
  public.is_valid_guest_virtual_staging_state(jsonb),
  public.save_guest_order_draft(text,uuid,integer,jsonb,text),
  public.claim_guest_order_draft(uuid,text,uuid,integer) TO service_role;
COMMIT;
