-- Manual rollout only. Run before application deployment; never automatic.
BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS account_deleted_at timestamptz;
COMMENT ON COLUMN public.orders.account_deleted_at IS
  'Durable account-deletion tombstone. Never eligible for legacy email ownership.';

-- Deliberately no FK to Auth: retries must survive a successful Auth delete
-- followed by a lost response or failed completion write. No email is stored.
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  user_id uuid PRIMARY KEY,
  requested_at timestamptz NOT NULL DEFAULT now(),
  earliest_delete_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours 15 minutes'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  attempts integer NOT NULL DEFAULT 0,
  retry_after timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  completed_at timestamptz,
  CHECK (earliest_delete_at >= requested_at + interval '2 hours'),
  CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL))
);
CREATE INDEX IF NOT EXISTS account_deletion_pending_idx
  ON public.account_deletion_requests(retry_after, earliest_delete_at)
  WHERE status = 'pending';
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.account_deletion_requests TO service_role;

CREATE SCHEMA IF NOT EXISTS account_deletion_private;
-- This helper reveals only whether the caller may use their own account.
CREATE OR REPLACE FUNCTION account_deletion_private.client_account_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.account_deletion_requests WHERE user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION account_deletion_private.client_account_active() FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA account_deletion_private TO authenticated;
GRANT EXECUTE ON FUNCTION account_deletion_private.client_account_active() TO authenticated;

-- Existing grants and permissive ownership policies remain intact. Restrictive
-- policies also block direct REST access with an otherwise still-valid JWT.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['client_profiles','orders','order_drafts'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS account_deletion_lockout ON public.%I', t);
    EXECUTE format('CREATE POLICY account_deletion_lockout ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT account_deletion_private.client_account_active())) WITH CHECK ((SELECT account_deletion_private.client_account_active()))', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION account_deletion_private.guard_deleted_order_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.account_deleted_at IS NOT NULL THEN
    IF NEW.account_deleted_at IS DISTINCT FROM OLD.account_deleted_at
       OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Deleted account order ownership is immutable';
    END IF;
  END IF;
  IF NEW.user_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.user_id::text, 352));
    IF EXISTS (SELECT 1 FROM public.account_deletion_requests WHERE user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Client account is unavailable';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION account_deletion_private.guard_deleted_order_ownership() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_deleted_order_ownership ON public.orders;
CREATE TRIGGER guard_deleted_order_ownership BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION account_deletion_private.guard_deleted_order_ownership();

CREATE OR REPLACE FUNCTION public.request_client_account_deletion(p_user_id uuid, p_confirmation_email text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_email text; v_confirmed timestamptz; v_anonymous boolean; v_requested timestamptz;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 352));
  SELECT email, email_confirmed_at, is_anonymous INTO v_email, v_confirmed, v_anonymous
    FROM auth.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_email IS NULL OR v_email = '' OR v_anonymous
     OR v_email IS DISTINCT FROM p_confirmation_email THEN
    RAISE EXCEPTION 'Account identity could not be confirmed';
  END IF;
  SELECT requested_at INTO v_requested FROM public.account_deletion_requests WHERE user_id = p_user_id;
  IF FOUND THEN RETURN v_requested; END IF;
  -- Bind eligible legacy history before persisting the lockout. This preserves
  -- its identity through cleanup (including pending rework), without changing
  -- any commercial snapshot. The ownership trigger shares this account lock.
  IF v_confirmed IS NOT NULL THEN
    UPDATE public.orders SET user_id = p_user_id
     WHERE user_id IS NULL AND account_deleted_at IS NULL
       AND lower(btrim(client_email)) = lower(btrim(v_email));
  END IF;
  INSERT INTO public.account_deletion_requests(user_id) VALUES (p_user_id);
  SELECT requested_at INTO STRICT v_requested FROM public.account_deletion_requests WHERE user_id = p_user_id;
  -- Retain snapshots and strong ownership until the Auth FK safely SET NULLs.
  -- Only verified-email legacy orders are eligible; unconfirmed invitees cannot
  -- tombstone a pre-existing customer's legacy history.
  UPDATE public.orders SET account_deleted_at = v_requested
   WHERE account_deleted_at IS NULL AND user_id = p_user_id;
  RETURN v_requested;
END $$;
REVOKE ALL ON FUNCTION public.request_client_account_deletion(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_client_account_deletion(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_client_account_deletion(p_token uuid)
RETURNS SETOF public.account_deletion_requests LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  UPDATE public.account_deletion_requests SET lease_token = p_token,
    lease_expires_at = now() + interval '10 minutes', attempts = attempts + 1
  WHERE user_id = (
    SELECT user_id FROM public.account_deletion_requests
    WHERE status = 'pending' AND earliest_delete_at <= now() AND retry_after <= now()
      AND (lease_expires_at IS NULL OR lease_expires_at <= now())
    ORDER BY retry_after, requested_at LIMIT 1 FOR UPDATE SKIP LOCKED
  ) RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_client_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_client_account_deletion(uuid) TO service_role;

-- Storage metadata is inspected, never deleted/rewritten with SQL. Unexpected
-- owned commercial objects require an explicit retention decision, not a purge.
CREATE OR REPLACE FUNCTION public.check_client_account_deletion(p_user_id uuid, p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.account_deletion_requests WHERE user_id = p_user_id
      AND status = 'pending' AND lease_token = p_token AND lease_expires_at > now()
      AND earliest_delete_at <= now()) THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.order_submissions WHERE user_id = p_user_id
      AND status = 'processing' AND lease_expires_at > now()) THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE user_id = p_user_id AND account_deleted_at IS NULL)
      THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE owner_id = p_user_id::text OR owner = p_user_id)
      THEN RETURN false; END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.check_client_account_deletion(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_client_account_deletion(uuid,uuid) TO service_role;

-- Preserve all existing review validation, also deny deleted accounts/history.
CREATE OR REPLACE FUNCTION public.create_client_order_review(
  p_order_id UUID,
  p_user_id UUID,
  p_user_email TEXT,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL
)
RETURNS TABLE (
  outcome TEXT,
  review_id UUID,
  order_id UUID,
  user_id UUID,
  rating SMALLINT,
  comment TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order_user_id UUID;
  v_order_client_email TEXT;
  v_order_status TEXT;
  v_review public.client_order_reviews%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR NULLIF(pg_catalog.btrim(p_user_email), '') IS NULL THEN
    outcome := 'not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT orders.user_id, orders.client_email, orders.status
    INTO v_order_user_id, v_order_client_email, v_order_status
  FROM public.orders AS orders
  WHERE orders.id = p_order_id
    AND orders.account_deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.account_deletion_requests AS deletion WHERE deletion.user_id = p_user_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    outcome := 'not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  IF (
    v_order_user_id IS NOT NULL
    AND v_order_user_id IS DISTINCT FROM p_user_id
  ) OR (
    v_order_user_id IS NULL
    AND pg_catalog.lower(pg_catalog.btrim(v_order_client_email))
      IS DISTINCT FROM pg_catalog.lower(pg_catalog.btrim(p_user_email))
  ) THEN
    outcome := 'not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_order_status IS DISTINCT FROM 'delivered' THEN
    outcome := 'not_delivered';
    RETURN NEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_order_reviews AS reviews
    WHERE reviews.order_id = p_order_id
  ) THEN
    outcome := 'duplicate';
    RETURN NEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.deliverable_reviews AS deliverable_review
    WHERE deliverable_review.order_id = p_order_id
      AND deliverable_review.status IN (
        'rework_requested',
        'rework_in_progress'
      )
  ) THEN
    outcome := 'active_rework';
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.order_deliverables AS deliverable
    WHERE deliverable.order_id = p_order_id
      AND deliverable.file_size > 0
      AND NULLIF(pg_catalog.btrim(deliverable.storage_path), '') IS NOT NULL
      AND (
        deliverable.expires_at IS NULL
        OR deliverable.expires_at > pg_catalog.now()
      )
  ) THEN
    outcome := 'no_deliverables';
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.client_order_reviews (
    order_id,
    user_id,
    rating,
    comment
  )
  VALUES (
    p_order_id,
    p_user_id,
    p_rating,
    NULLIF(pg_catalog.btrim(p_comment), '')
  )
  ON CONFLICT ON CONSTRAINT client_order_reviews_order_id_key DO NOTHING
  RETURNING * INTO v_review;

  IF NOT FOUND THEN
    outcome := 'duplicate';
    RETURN NEXT;
    RETURN;
  END IF;

  outcome := 'created';
  review_id := v_review.id;
  order_id := v_review.order_id;
  user_id := v_review.user_id;
  rating := v_review.rating;
  comment := v_review.comment;
  created_at := v_review.created_at;
  RETURN NEXT;
END;
$$;


COMMIT;
