-- ============================================================
-- PicchuSpot security hardening: RLS auth initialization plan
-- ============================================================
-- WARNING:
-- - Review this script before running it.
-- - Intended for manual Supabase SQL Editor execution only.
-- - Do not run automatically from application code, CI, the CLI, or migrations.
-- - Stop and investigate if the preflight block fails.
-- - Record every verification result set after COMMIT.
--
-- Purpose:
-- - Optimizes selected RLS policies for the Supabase Performance Advisor
--   "Auth RLS Initialization Plan" warning.
-- - Replaces only direct auth.uid() and auth.email() calls with scalar
--   subquery wrappers:
--     auth.uid()   -> (select auth.uid())
--     auth.email() -> (select auth.email())
--
-- Scope:
-- - Preserves policy names, commands, roles, and permissive behavior.
-- - Preserves public-read policies unchanged.
-- - Does not alter tables, indexes, functions, grants, Storage policies,
--   buckets, auth settings, data, or application code.
-- ============================================================

BEGIN;

-- Fail closed before any policy mutation if the expected production
-- policies are missing or their current definitions do not match closely
-- enough to safely apply this performance-only change.
DO $$
DECLARE
  target record;
  actual record;
  target_table_oid regclass;
BEGIN
  FOR target IN
    SELECT *
    FROM (
      VALUES
        (
          'public.client_profiles',
          'client_profiles_insert_own',
          'a',
          ARRAY['public']::text[],
          NULL::text,
          '(user_id = auth.uid())'
        ),
        (
          'public.client_profiles',
          'client_profiles_select_own',
          'r',
          ARRAY['public']::text[],
          '(user_id = auth.uid())',
          NULL::text
        ),
        (
          'public.client_profiles',
          'client_profiles_update_own',
          'w',
          ARRAY['public']::text[],
          '(user_id = auth.uid())',
          '(user_id = auth.uid())'
        ),
        (
          'public.order_deliverables',
          'deliverables_client_select_own',
          'r',
          ARRAY['public']::text[],
          '(order_id IN ( SELECT orders.id FROM orders WHERE (orders.client_email = auth.email())))',
          NULL::text
        ),
        (
          'public.deliverable_reviews',
          'reviews_client_select_own',
          'r',
          ARRAY['public']::text[],
          '(order_id IN ( SELECT orders.id FROM orders WHERE (orders.client_email = auth.email())))',
          NULL::text
        ),
        (
          'public.deliverable_review_files',
          'review_files_client_select_own',
          'r',
          ARRAY['public']::text[],
          '(order_id IN ( SELECT orders.id FROM orders WHERE (orders.client_email = auth.email())))',
          NULL::text
        ),
        (
          'public.order_draft_files',
          'order_draft_files_select_own',
          'r',
          ARRAY['authenticated']::text[],
          '(EXISTS ( SELECT 1 FROM order_drafts WHERE ((order_drafts.id = order_draft_files.draft_id) AND (order_drafts.user_id = auth.uid()))))',
          NULL::text
        ),
        (
          'public.order_drafts',
          'order_drafts_select_own',
          'r',
          ARRAY['authenticated']::text[],
          '(user_id = auth.uid())',
          NULL::text
        ),
        (
          'public.order_items',
          'order_items_select_own',
          'r',
          ARRAY['authenticated']::text[],
          '(EXISTS ( SELECT 1 FROM orders WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid()))))',
          NULL::text
        ),
        (
          'public.orders',
          'orders_select_own',
          'r',
          ARRAY['authenticated']::text[],
          '(user_id = auth.uid())',
          NULL::text
        ),
        (
          'public.portfolio_items',
          'portfolio_items_public_read',
          'r',
          ARRAY['anon', 'authenticated']::text[],
          '(published = true)',
          NULL::text
        ),
        (
          'public.site_media_items',
          'site_media_items_public_read',
          'r',
          ARRAY['anon', 'authenticated']::text[],
          '(published = true)',
          NULL::text
        )
    ) AS expected(
      table_name,
      policy_name,
      command_code,
      role_names,
      using_expression,
      check_expression
    )
  LOOP
    target_table_oid := to_regclass(target.table_name);

    IF target_table_oid IS NULL THEN
      RAISE EXCEPTION
        'Preflight failed: expected table % was not found.',
        target.table_name;
    END IF;

    SELECT
      p.polcmd::text AS command_code,
      p.polpermissive AS is_permissive,
      CASE
        WHEN 0::oid = ANY(p.polroles)
          THEN ARRAY['public']::text[]
        ELSE ARRAY(
          SELECT r.rolname::text
          FROM pg_catalog.pg_roles AS r
          WHERE r.oid = ANY(p.polroles)
          ORDER BY r.rolname
        )
      END AS role_names,
      pg_get_expr(p.polqual, p.polrelid) AS using_expression,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
    INTO actual
    FROM pg_catalog.pg_policy AS p
    WHERE p.polrelid = target_table_oid
      AND p.polname = target.policy_name;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Preflight failed: expected policy %.% was not found.',
        target.table_name,
        target.policy_name;
    END IF;

    IF actual.command_code IS DISTINCT FROM target.command_code THEN
      RAISE EXCEPTION
        'Preflight failed: policy %.% has unexpected command %. Expected %.',
        target.table_name,
        target.policy_name,
        actual.command_code,
        target.command_code;
    END IF;

    IF actual.is_permissive IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION
        'Preflight failed: policy %.% is not permissive.',
        target.table_name,
        target.policy_name;
    END IF;

    IF actual.role_names IS DISTINCT FROM target.role_names THEN
      RAISE EXCEPTION
        'Preflight failed: policy %.% has unexpected roles %. Expected %.',
        target.table_name,
        target.policy_name,
        actual.role_names,
        target.role_names;
    END IF;

    IF btrim(regexp_replace(
      lower(coalesce(actual.using_expression, '<null>')),
      '[[:space:]]+',
      ' ',
      'g'
    )) IS DISTINCT FROM btrim(regexp_replace(
      lower(coalesce(target.using_expression, '<null>')),
      '[[:space:]]+',
      ' ',
      'g'
    )) THEN
      RAISE EXCEPTION
        'Preflight failed: policy %.% has unexpected USING expression: %.',
        target.table_name,
        target.policy_name,
        actual.using_expression;
    END IF;

    IF btrim(regexp_replace(
      lower(coalesce(actual.check_expression, '<null>')),
      '[[:space:]]+',
      ' ',
      'g'
    )) IS DISTINCT FROM btrim(regexp_replace(
      lower(coalesce(target.check_expression, '<null>')),
      '[[:space:]]+',
      ' ',
      'g'
    )) THEN
      RAISE EXCEPTION
        'Preflight failed: policy %.% has unexpected WITH CHECK expression: %.',
        target.table_name,
        target.policy_name,
        actual.check_expression;
    END IF;
  END LOOP;
END;
$$;

ALTER POLICY client_profiles_insert_own
ON public.client_profiles
WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY client_profiles_select_own
ON public.client_profiles
USING (user_id = (select auth.uid()));

ALTER POLICY client_profiles_update_own
ON public.client_profiles
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY deliverables_client_select_own
ON public.order_deliverables
USING (
  order_id IN (
    SELECT orders.id
    FROM public.orders AS orders
    WHERE orders.client_email = (select auth.email())
  )
);

ALTER POLICY reviews_client_select_own
ON public.deliverable_reviews
USING (
  order_id IN (
    SELECT orders.id
    FROM public.orders AS orders
    WHERE orders.client_email = (select auth.email())
  )
);

ALTER POLICY review_files_client_select_own
ON public.deliverable_review_files
USING (
  order_id IN (
    SELECT orders.id
    FROM public.orders AS orders
    WHERE orders.client_email = (select auth.email())
  )
);

ALTER POLICY order_draft_files_select_own
ON public.order_draft_files
USING (
  EXISTS (
    SELECT 1
    FROM public.order_drafts AS order_drafts
    WHERE order_drafts.id = order_draft_files.draft_id
      AND order_drafts.user_id = (select auth.uid())
  )
);

ALTER POLICY order_drafts_select_own
ON public.order_drafts
USING (user_id = (select auth.uid()));

ALTER POLICY order_items_select_own
ON public.order_items
USING (
  EXISTS (
    SELECT 1
    FROM public.orders AS orders
    WHERE orders.id = order_items.order_id
      AND orders.user_id = (select auth.uid())
  )
);

ALTER POLICY orders_select_own
ON public.orders
USING (user_id = (select auth.uid()));

COMMIT;

-- ============================================================
-- Read-only verification queries.
-- Every statement below is SELECT-only.
-- ============================================================

-- 1. Updated policies and their USING / WITH CHECK expressions.
WITH updated_policies(table_schema, table_name, policy_name) AS (
  VALUES
    ('public', 'client_profiles', 'client_profiles_insert_own'),
    ('public', 'client_profiles', 'client_profiles_select_own'),
    ('public', 'client_profiles', 'client_profiles_update_own'),
    ('public', 'order_deliverables', 'deliverables_client_select_own'),
    ('public', 'deliverable_reviews', 'reviews_client_select_own'),
    ('public', 'deliverable_review_files', 'review_files_client_select_own'),
    ('public', 'order_draft_files', 'order_draft_files_select_own'),
    ('public', 'order_drafts', 'order_drafts_select_own'),
    ('public', 'order_items', 'order_items_select_own'),
    ('public', 'orders', 'orders_select_own')
)
SELECT
  n.nspname AS table_schema,
  c.relname AS table_name,
  p.polname AS policy_name,
  p.polcmd AS command_code,
  p.polpermissive AS is_permissive,
  CASE
    WHEN 0::oid = ANY(p.polroles)
      THEN ARRAY['public']::text[]
    ELSE ARRAY(
      SELECT r.rolname::text
      FROM pg_catalog.pg_roles AS r
      WHERE r.oid = ANY(p.polroles)
      ORDER BY r.rolname
    )
  END AS role_names,
  pg_get_expr(p.polqual, p.polrelid) AS using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
FROM updated_policies AS tp
JOIN pg_catalog.pg_class AS c
  ON c.oid = (quote_ident(tp.table_schema) || '.' || quote_ident(tp.table_name))::regclass
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = c.relnamespace
JOIN pg_catalog.pg_policy AS p
  ON p.polrelid = c.oid
 AND p.polname = tp.policy_name
ORDER BY n.nspname, c.relname, p.polname;

-- 2. No direct unwrapped auth.uid() or auth.email() calls remain in
-- the relevant public RLS policies.
WITH relevant_policies(table_schema, table_name, policy_name) AS (
  VALUES
    ('public', 'client_profiles', 'client_profiles_insert_own'),
    ('public', 'client_profiles', 'client_profiles_select_own'),
    ('public', 'client_profiles', 'client_profiles_update_own'),
    ('public', 'order_deliverables', 'deliverables_client_select_own'),
    ('public', 'deliverable_reviews', 'reviews_client_select_own'),
    ('public', 'deliverable_review_files', 'review_files_client_select_own'),
    ('public', 'order_draft_files', 'order_draft_files_select_own'),
    ('public', 'order_drafts', 'order_drafts_select_own'),
    ('public', 'order_items', 'order_items_select_own'),
    ('public', 'orders', 'orders_select_own')
),
policy_text AS (
  SELECT
    rp.table_schema,
    rp.table_name,
    rp.policy_name,
    lower(regexp_replace(
      coalesce(pg_get_expr(p.polqual, p.polrelid), '')
        || ' '
        || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''),
      '[[:space:]]+',
      ' ',
      'g'
    )) AS expression_text
  FROM relevant_policies AS rp
  JOIN pg_catalog.pg_class AS c
    ON c.oid = (quote_ident(rp.table_schema) || '.' || quote_ident(rp.table_name))::regclass
  JOIN pg_catalog.pg_policy AS p
    ON p.polrelid = c.oid
   AND p.polname = rp.policy_name
)
SELECT
  count(*) = 0 AS no_direct_unwrapped_auth_calls_remaining,
  coalesce(
    array_agg(
      format('%I.%I:%s', table_schema, table_name, policy_name)
      ORDER BY table_schema, table_name, policy_name
    ),
    ARRAY[]::text[]
  ) AS policies_with_direct_unwrapped_auth_calls
FROM policy_text
WHERE expression_text ~ '=[[:space:]]*auth[.](uid|email)[[:space:]]*[(][[:space:]]*[)]'
   OR expression_text ~ 'auth[.](uid|email)[[:space:]]*[(][[:space:]]*[)][[:space:]]*=';

-- 3. Public read policies remain unchanged.
WITH public_read_policies(table_schema, table_name, policy_name) AS (
  VALUES
    ('public', 'portfolio_items', 'portfolio_items_public_read'),
    ('public', 'site_media_items', 'site_media_items_public_read')
),
policy_details AS (
  SELECT
    prp.table_schema,
    prp.table_name,
    prp.policy_name,
    p.polcmd::text AS command_code,
    p.polpermissive AS is_permissive,
    CASE
      WHEN 0::oid = ANY(p.polroles)
        THEN ARRAY['public']::text[]
      ELSE ARRAY(
        SELECT r.rolname::text
        FROM pg_catalog.pg_roles AS r
        WHERE r.oid = ANY(p.polroles)
        ORDER BY r.rolname
      )
    END AS role_names,
    pg_get_expr(p.polqual, p.polrelid) AS using_expression,
    pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
  FROM public_read_policies AS prp
  JOIN pg_catalog.pg_class AS c
    ON c.oid = (quote_ident(prp.table_schema) || '.' || quote_ident(prp.table_name))::regclass
  JOIN pg_catalog.pg_policy AS p
    ON p.polrelid = c.oid
   AND p.polname = prp.policy_name
)
SELECT
  table_schema,
  table_name,
  policy_name,
  command_code,
  is_permissive,
  role_names,
  using_expression,
  check_expression,
  command_code = 'r'
    AND is_permissive IS TRUE
    AND role_names IS NOT DISTINCT FROM ARRAY['anon', 'authenticated']::text[]
    AND btrim(regexp_replace(
      lower(coalesce(using_expression, '<null>')),
      '[[:space:]]+',
      ' ',
      'g'
    )) = '(published = true)'
    AND check_expression IS NULL AS remains_unchanged
FROM policy_details
ORDER BY table_schema, table_name, policy_name;

-- 4. Policy roles are still exactly the expected role sets.
WITH expected_roles(table_schema, table_name, policy_name, role_names) AS (
  VALUES
    ('public', 'client_profiles', 'client_profiles_insert_own', ARRAY['public']::text[]),
    ('public', 'client_profiles', 'client_profiles_select_own', ARRAY['public']::text[]),
    ('public', 'client_profiles', 'client_profiles_update_own', ARRAY['public']::text[]),
    ('public', 'order_deliverables', 'deliverables_client_select_own', ARRAY['public']::text[]),
    ('public', 'deliverable_reviews', 'reviews_client_select_own', ARRAY['public']::text[]),
    ('public', 'deliverable_review_files', 'review_files_client_select_own', ARRAY['public']::text[]),
    ('public', 'order_draft_files', 'order_draft_files_select_own', ARRAY['authenticated']::text[]),
    ('public', 'order_drafts', 'order_drafts_select_own', ARRAY['authenticated']::text[]),
    ('public', 'order_items', 'order_items_select_own', ARRAY['authenticated']::text[]),
    ('public', 'orders', 'orders_select_own', ARRAY['authenticated']::text[]),
    ('public', 'portfolio_items', 'portfolio_items_public_read', ARRAY['anon', 'authenticated']::text[]),
    ('public', 'site_media_items', 'site_media_items_public_read', ARRAY['anon', 'authenticated']::text[])
),
policy_roles AS (
  SELECT
    er.table_schema,
    er.table_name,
    er.policy_name,
    er.role_names AS expected_role_names,
    CASE
      WHEN 0::oid = ANY(p.polroles)
        THEN ARRAY['public']::text[]
      ELSE ARRAY(
        SELECT r.rolname::text
        FROM pg_catalog.pg_roles AS r
        WHERE r.oid = ANY(p.polroles)
        ORDER BY r.rolname
      )
    END AS actual_role_names
  FROM expected_roles AS er
  JOIN pg_catalog.pg_class AS c
    ON c.oid = (quote_ident(er.table_schema) || '.' || quote_ident(er.table_name))::regclass
  JOIN pg_catalog.pg_policy AS p
    ON p.polrelid = c.oid
   AND p.polname = er.policy_name
)
SELECT
  table_schema,
  table_name,
  policy_name,
  expected_role_names,
  actual_role_names,
  actual_role_names IS NOT DISTINCT FROM expected_role_names AS roles_match
FROM policy_roles
ORDER BY table_schema, table_name, policy_name;
