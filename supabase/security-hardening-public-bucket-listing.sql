-- ============================================================
-- PicchuSpot public bucket listing hardening
-- ============================================================
-- Review this file before running.
-- Manual Supabase SQL Editor execution only.
-- Do not run this file automatically.
-- Stop if any preflight check fails.
-- Record every verification query result.
-- Manually smoke-test known public object URLs after execution.
--
-- Purpose:
-- Remove only the broad browser SELECT policies that expose object
-- rows for the public `portfolio` and `site-media` buckets. Public
-- object URLs for those public buckets remain bucket-level behavior.
-- ============================================================

BEGIN;

DO $$
DECLARE
  objects_reg regclass := to_regclass('storage.objects');
  expected_roles text[] := ARRAY['anon', 'authenticated'];
  target_count integer;
  bucket_public boolean;
  target record;
  actual record;
BEGIN
  IF objects_reg IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: storage.objects was not found.';
  END IF;

  SELECT b.public
    INTO bucket_public
  FROM storage.buckets AS b
  WHERE b.id = 'portfolio';

  IF bucket_public IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Preflight failed: bucket portfolio must exist and be public.';
  END IF;

  SELECT b.public
    INTO bucket_public
  FROM storage.buckets AS b
  WHERE b.id = 'site-media';

  IF bucket_public IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Preflight failed: bucket site-media must exist and be public.';
  END IF;

  SELECT b.public
    INTO bucket_public
  FROM storage.buckets AS b
  WHERE b.id = 'order-files';

  IF bucket_public IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'Preflight failed: bucket order-files must exist and be private.';
  END IF;

  SELECT b.public
    INTO bucket_public
  FROM storage.buckets AS b
  WHERE b.id = 'deliverables';

  IF bucket_public IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'Preflight failed: bucket deliverables must exist and be private.';
  END IF;

  SELECT count(*)
    INTO target_count
  FROM pg_policy AS p
  WHERE p.polrelid = objects_reg
    AND p.polname IN (
      'portfolio_storage_public_read',
      'site_media_storage_public_read'
    );

  IF target_count = 0 THEN
    RETURN;
  END IF;

  IF target_count <> 2 THEN
    RAISE EXCEPTION
      'Preflight failed: expected both target policies to exist together; found %.',
      target_count;
  END IF;

  FOR target IN
    SELECT *
    FROM (
      VALUES
        ('portfolio_storage_public_read', 'portfolio'),
        ('site_media_storage_public_read', 'site-media')
    ) AS v(policy_name, bucket_id)
  LOOP
    SELECT
      p.polcmd,
      p.polwithcheck,
      pg_get_expr(p.polqual, p.polrelid) AS using_expression,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression,
      (
        SELECT array_agg(r.rolname ORDER BY r.rolname)
        FROM pg_roles AS r
        WHERE r.oid = ANY(p.polroles)
      ) AS role_names
    INTO actual
    FROM pg_policy AS p
    WHERE p.polrelid = objects_reg
      AND p.polname = target.policy_name;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Preflight failed: expected policy % on storage.objects.',
        target.policy_name;
    END IF;

    IF actual.polcmd <> 'r' THEN
      RAISE EXCEPTION
        'Preflight failed: policy % must be SELECT-only.',
        target.policy_name;
    END IF;

    IF actual.polwithcheck IS NOT NULL OR actual.check_expression IS NOT NULL THEN
      RAISE EXCEPTION
        'Preflight failed: policy % must not have a check expression.',
        target.policy_name;
    END IF;

    IF actual.using_expression IS DISTINCT FROM format(
      '(bucket_id = %L::text)',
      target.bucket_id
    ) THEN
      RAISE EXCEPTION
        'Preflight failed: policy % has unexpected USING expression: %.',
        target.policy_name,
        actual.using_expression;
    END IF;

    IF actual.role_names::text[] IS DISTINCT FROM expected_roles THEN
      RAISE EXCEPTION
        'Preflight failed: policy % has unexpected roles: %.',
        target.policy_name,
        actual.role_names;
    END IF;

    IF actual.using_expression ILIKE '%order-files%'
      OR actual.using_expression ILIKE '%deliverables%' THEN
      RAISE EXCEPTION
        'Preflight failed: policy % unexpectedly references a private bucket.',
        target.policy_name;
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS portfolio_storage_public_read ON storage.objects;
DROP POLICY IF EXISTS site_media_storage_public_read ON storage.objects;

COMMIT;

-- ============================================================
-- Verification queries
-- SELECT-only. Save every result set for review.
-- ============================================================

-- 1. Current public/private state for all four buckets.
SELECT
  b.id AS bucket_id,
  b.public AS is_public
FROM storage.buckets AS b
WHERE b.id IN ('portfolio', 'site-media', 'order-files', 'deliverables')
ORDER BY b.id;

-- 2. The two target policies should no longer exist.
SELECT
  p.polname AS target_policy_still_present
FROM pg_policy AS p
WHERE p.polrelid = to_regclass('storage.objects')
  AND p.polname IN (
    'portfolio_storage_public_read',
    'site_media_storage_public_read'
  )
ORDER BY p.polname;

-- 3. Every remaining policy on storage.objects.
SELECT
  p.polname AS policy_name,
  p.polcmd AS command_code,
  (
    SELECT array_agg(r.rolname ORDER BY r.rolname)
    FROM pg_roles AS r
    WHERE r.oid = ANY(p.polroles)
  ) AS role_names,
  pg_get_expr(p.polqual, p.polrelid) AS using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
FROM pg_policy AS p
WHERE p.polrelid = to_regclass('storage.objects')
ORDER BY p.polname;

-- 4. No remaining broad browser SELECT policy for bucket portfolio.
SELECT
  p.polname AS portfolio_broad_select_policy
FROM pg_policy AS p
WHERE p.polrelid = to_regclass('storage.objects')
  AND p.polcmd = 'r'
  AND (
    0 = ANY(p.polroles)
    OR EXISTS (
      SELECT 1
      FROM pg_roles AS r
      WHERE r.oid = ANY(p.polroles)
        AND r.rolname IN ('anon', 'authenticated')
    )
  )
  AND pg_get_expr(p.polqual, p.polrelid) = '(bucket_id = ''portfolio''::text)'
ORDER BY p.polname;

-- 5. No remaining broad browser SELECT policy for bucket site-media.
SELECT
  p.polname AS site_media_broad_select_policy
FROM pg_policy AS p
WHERE p.polrelid = to_regclass('storage.objects')
  AND p.polcmd = 'r'
  AND (
    0 = ANY(p.polroles)
    OR EXISTS (
      SELECT 1
      FROM pg_roles AS r
      WHERE r.oid = ANY(p.polroles)
        AND r.rolname IN ('anon', 'authenticated')
    )
  )
  AND pg_get_expr(p.polqual, p.polrelid) = '(bucket_id = ''site-media''::text)'
ORDER BY p.polname;

-- 6. No visible browser policy should mention order-files.
SELECT
  p.polname AS browser_policy_touching_order_files,
  p.polcmd AS command_code,
  pg_get_expr(p.polqual, p.polrelid) AS using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
FROM pg_policy AS p
WHERE p.polrelid = to_regclass('storage.objects')
  AND (
    0 = ANY(p.polroles)
    OR EXISTS (
      SELECT 1
      FROM pg_roles AS r
      WHERE r.oid = ANY(p.polroles)
        AND r.rolname IN ('anon', 'authenticated')
    )
  )
  AND (
    (
      p.polcmd IN ('r', 'w', 'd', '*')
      AND (
        p.polqual IS NULL
        OR pg_get_expr(p.polqual, p.polrelid) IN ('true', '(true)')
        OR pg_get_expr(p.polqual, p.polrelid) ILIKE '%order-files%'
      )
    )
    OR (
      p.polcmd IN ('a', '*')
      AND (
        p.polwithcheck IS NULL
        OR pg_get_expr(p.polwithcheck, p.polrelid) IN ('true', '(true)')
        OR pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%order-files%'
      )
    )
  )
ORDER BY p.polname;

-- 7. No visible browser policy should mention deliverables.
SELECT
  p.polname AS browser_policy_touching_deliverables,
  p.polcmd AS command_code,
  pg_get_expr(p.polqual, p.polrelid) AS using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
FROM pg_policy AS p
WHERE p.polrelid = to_regclass('storage.objects')
  AND (
    0 = ANY(p.polroles)
    OR EXISTS (
      SELECT 1
      FROM pg_roles AS r
      WHERE r.oid = ANY(p.polroles)
        AND r.rolname IN ('anon', 'authenticated')
    )
  )
  AND (
    (
      p.polcmd IN ('r', 'w', 'd', '*')
      AND (
        p.polqual IS NULL
        OR pg_get_expr(p.polqual, p.polrelid) IN ('true', '(true)')
        OR pg_get_expr(p.polqual, p.polrelid) ILIKE '%deliverables%'
      )
    )
    OR (
      p.polcmd IN ('a', '*')
      AND (
        p.polwithcheck IS NULL
        OR pg_get_expr(p.polwithcheck, p.polrelid) IN ('true', '(true)')
        OR pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%deliverables%'
      )
    )
  )
ORDER BY p.polname;

-- 8. Public table policies for published rows should remain present.
SELECT
  c.relname AS table_name,
  p.polname AS policy_name,
  p.polcmd AS command_code,
  (
    SELECT array_agg(r.rolname ORDER BY r.rolname)
    FROM pg_roles AS r
    WHERE r.oid = ANY(p.polroles)
  ) AS role_names,
  pg_get_expr(p.polqual, p.polrelid) AS using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
FROM pg_policy AS p
JOIN pg_class AS c
  ON c.oid = p.polrelid
JOIN pg_namespace AS n
  ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (
    (c.relname = 'portfolio_items' AND p.polname = 'portfolio_items_public_read')
    OR (c.relname = 'site_media_items' AND p.polname = 'site_media_items_public_read')
  )
ORDER BY c.relname, p.polname;
