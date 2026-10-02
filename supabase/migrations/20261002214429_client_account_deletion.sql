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
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reconciling')),
  attempts integer NOT NULL DEFAULT 0,
  retry_after timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  auth_deleted_at timestamptz,
  last_reconciled_at timestamptz,
  cleanup_cursor text,
  CHECK (earliest_delete_at >= requested_at + interval '2 hours'),
  CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL))
);
CREATE INDEX IF NOT EXISTS account_deletion_due_idx
  ON public.account_deletion_requests(status, retry_after, earliest_delete_at);
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.account_deletion_requests TO service_role;

-- Captured atomically with lockout, before temporary metadata or Auth FKs can
-- disappear. Exact rework objects only; never an entire commercial review prefix.
CREATE TABLE IF NOT EXISTS public.account_deletion_cleanup_targets (
  user_id uuid REFERENCES public.account_deletion_requests(user_id) ON DELETE RESTRICT,
  order_id uuid, -- No metadata FK: abandoned rework metadata may already be gone.
  kind text NOT NULL CHECK (kind IN ('rework_file', 'submission_prefix')),
  target text NOT NULL,
  PRIMARY KEY (kind, target),
  CHECK (
    (kind = 'rework_file' AND order_id IS NOT NULL AND target ~ '^rework/[0-9a-f-]{36}/[^/\\]+$') OR
    (kind = 'submission_prefix' AND user_id IS NOT NULL AND target ~ '^(VS|VR|FP|PE|ORD)-[0-9]+$')
  )
);
CREATE INDEX IF NOT EXISTS account_deletion_targets_user_idx
  ON public.account_deletion_cleanup_targets(user_id, target);
ALTER TABLE public.account_deletion_cleanup_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_cleanup_targets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_deletion_cleanup_targets TO service_role;

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

-- Serialize the non-UUID temporary namespaces with deletion's account lock.
-- An already-admitted server request must not create/commit a temporary reference
-- after capture, or renew/create a submission lease after lockout. Existing
-- commercial files and normal admin review processing are unchanged.
CREATE OR REPLACE FUNCTION account_deletion_private.guard_rework_file()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid; v_deleted timestamptz;
BEGIN
  SELECT user_id, account_deleted_at INTO v_user, v_deleted
    FROM public.orders WHERE id = NEW.order_id;
  IF v_user IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 352));
    IF EXISTS (SELECT 1 FROM public.account_deletion_requests WHERE user_id = v_user) THEN
      RAISE EXCEPTION 'Client account is unavailable';
    END IF;
  END IF;
  -- Lock even a legacy order with NULL user_id. Deletion binds/tombstones that
  -- row before target capture, so a concurrent insert either commits first and
  -- is captured, or observes the tombstone and is rejected.
  SELECT account_deleted_at INTO v_deleted FROM public.orders WHERE id = NEW.order_id FOR UPDATE;
  IF v_deleted IS NOT NULL THEN RAISE EXCEPTION 'Client account is unavailable'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION account_deletion_private.guard_rework_file() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS account_deletion_rework_guard ON public.deliverable_review_files;
CREATE TRIGGER account_deletion_rework_guard BEFORE INSERT OR UPDATE ON public.deliverable_review_files
FOR EACH ROW EXECUTE FUNCTION account_deletion_private.guard_rework_file();

CREATE OR REPLACE FUNCTION account_deletion_private.guard_submission_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Clearing a lease and Auth's ON DELETE SET NULL remain allowed. Fresh/reclaimed
  -- leases are denied even for a handler whose server session predates deletion.
  IF NEW.user_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.lease_expires_at IS NOT NULL) THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.user_id::text, 352));
    IF EXISTS (SELECT 1 FROM public.account_deletion_requests WHERE user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Client account is unavailable';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION account_deletion_private.guard_submission_claim() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS account_deletion_submission_guard ON public.order_submissions;
CREATE TRIGGER account_deletion_submission_guard BEFORE INSERT OR UPDATE ON public.order_submissions
FOR EACH ROW EXECUTE FUNCTION account_deletion_private.guard_submission_claim();

-- Existing rework retries delete abandoned metadata before best-effort Storage
-- cleanup. Preserve pending paths even BEFORE an account requests deletion.
-- Stable order_id carries ownership until the request binds the target to its
-- durable UUID. No token/email/Auth FK; uploaded references are never captured.
CREATE OR REPLACE FUNCTION account_deletion_private.retain_retired_rework_target()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid;
BEGIN
  IF OLD.upload_status = 'pending' THEN
    -- Serialize with request's order tombstone, including NULL-owner legacy orders.
    SELECT user_id INTO v_user FROM public.orders WHERE id = OLD.order_id FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM public.account_deletion_requests WHERE user_id = v_user) THEN
      v_user := NULL;
    END IF;
    INSERT INTO public.account_deletion_cleanup_targets(user_id,order_id,kind,target)
      VALUES (v_user,OLD.order_id,'rework_file',OLD.storage_path) ON CONFLICT DO NOTHING;
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION account_deletion_private.retain_retired_rework_target() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS account_deletion_retain_rework ON public.deliverable_review_files;
CREATE TRIGGER account_deletion_retain_rework BEFORE DELETE ON public.deliverable_review_files
FOR EACH ROW EXECUTE FUNCTION account_deletion_private.retain_retired_rework_target();

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
  UPDATE public.account_deletion_cleanup_targets t SET user_id = p_user_id
    FROM public.orders o WHERE t.order_id = o.id AND o.user_id = p_user_id AND t.user_id IS NULL;
  INSERT INTO public.account_deletion_cleanup_targets(user_id, order_id, kind, target)
    SELECT p_user_id, f.order_id, 'rework_file', f.storage_path
    FROM public.deliverable_review_files f JOIN public.orders o ON o.id = f.order_id
    WHERE o.user_id = p_user_id AND f.upload_status = 'pending'
    ON CONFLICT DO NOTHING;
  INSERT INTO public.account_deletion_cleanup_targets(user_id, kind, target)
    SELECT p_user_id, 'submission_prefix', s.reserved_order_number
    FROM public.order_submissions s
    WHERE s.user_id = p_user_id AND s.status = 'processing'
      AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.order_number = s.reserved_order_number)
    ON CONFLICT DO NOTHING;
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
    WHERE earliest_delete_at <= now() AND retry_after <= now()
      AND (lease_expires_at IS NULL OR lease_expires_at <= now())
    -- Give identity deletion a one-hour preference, but let overdue recurring
    -- scans age ahead. Strict pending-first would let one permanent Auth failure
    -- monopolize every Cron tick and leave late Storage objects forever.
    ORDER BY greatest(earliest_delete_at, retry_after)
      + CASE WHEN status = 'pending' THEN interval '0' ELSE interval '1 hour' END,
      requested_at, user_id
    LIMIT 1 FOR UPDATE SKIP LOCKED
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
