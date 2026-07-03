-- ============================================================
-- PicchuSpot security hardening: function and table grants
-- ============================================================
-- WARNING:
-- - Review this script before running it.
-- - Intended for manual Supabase SQL Editor execution only.
-- - Do not run automatically from application code, CI, or the CLI.
-- - Take note of every verification result set after COMMIT.
-- - Stop and investigate if the preflight block fails.
--
-- Scope:
-- - Fixes mutable search_path on selected existing functions.
-- - Removes direct browser-role EXECUTE from selected functions.
-- - Preserves service_role EXECUTE needed by trusted server flows.
-- - Removes only TRUNCATE, TRIGGER, and REFERENCES from browser roles
--   on selected public tables.
--
-- This script intentionally does not alter data, RLS policies, Storage
-- policies, table structures, triggers, event triggers, function bodies,
-- schemas, default privileges, or service_role table grants.
-- ============================================================

BEGIN;

-- Fail closed before any privilege or function-configuration changes.
DO $$
DECLARE
  v_missing_objects text[];
BEGIN
  SELECT array_agg(required_object ORDER BY required_object)
  INTO v_missing_objects
  FROM (
    VALUES
      ('function public.rls_auto_enable()',
        to_regprocedure('public.rls_auto_enable()') IS NOT NULL),
      ('function public.generate_order_number(text)',
        to_regprocedure('public.generate_order_number(text)') IS NOT NULL),
      ('function public.update_client_profile_updated_at()',
        to_regprocedure('public.update_client_profile_updated_at()') IS NOT NULL),
      ('function public.update_updated_at()',
        to_regprocedure('public.update_updated_at()') IS NOT NULL),
      ('table public.orders',
        to_regclass('public.orders') IS NOT NULL),
      ('table public.order_items',
        to_regclass('public.order_items') IS NOT NULL),
      ('table public.order_sequences',
        to_regclass('public.order_sequences') IS NOT NULL),
      ('table public.client_profiles',
        to_regclass('public.client_profiles') IS NOT NULL),
      ('table public.order_deliverables',
        to_regclass('public.order_deliverables') IS NOT NULL),
      ('table public.deliverable_reviews',
        to_regclass('public.deliverable_reviews') IS NOT NULL),
      ('table public.deliverable_review_files',
        to_regclass('public.deliverable_review_files') IS NOT NULL),
      ('table public.order_drafts',
        to_regclass('public.order_drafts') IS NOT NULL),
      ('table public.order_draft_files',
        to_regclass('public.order_draft_files') IS NOT NULL),
      ('table public.portfolio_items',
        to_regclass('public.portfolio_items') IS NOT NULL),
      ('table public.site_media_items',
        to_regclass('public.site_media_items') IS NOT NULL)
  ) AS expected(required_object, object_exists)
  WHERE NOT object_exists;

  IF v_missing_objects IS NOT NULL THEN
    RAISE EXCEPTION
      'PicchuSpot hardening preflight failed. Missing expected production objects: %',
      array_to_string(v_missing_objects, ', ');
  END IF;
END;
$$;

-- Fix mutable function search paths without changing bodies, arguments,
-- return types, owners, volatility, or SECURITY DEFINER/INVOKER status.
ALTER FUNCTION public.generate_order_number(text)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.update_client_profile_updated_at()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.update_updated_at()
  SET search_path = pg_catalog, public;

-- Remove direct browser execution of selected functions. Function owners
-- keep owner privileges, and trigger execution continues through existing
-- trigger wiring.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_order_number(text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_client_profile_updated_at()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_updated_at()
  FROM PUBLIC, anon, authenticated;

-- Preserve trusted server-side execution for the application service-role
-- flows. rls_auto_enable() is intentionally not granted to service_role.
GRANT EXECUTE ON FUNCTION public.generate_order_number(text)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.update_client_profile_updated_at()
  TO service_role;

GRANT EXECUTE ON FUNCTION public.update_updated_at()
  TO service_role;

-- Remove only unnecessary table privileges from browser roles. Do not use
-- blanket revocation and do not touch SELECT, INSERT, UPDATE, DELETE, owners, or
-- service_role/postgres/supabase_admin/authenticator/dashboard_user grants.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE
  public.orders,
  public.order_items,
  public.order_sequences,
  public.client_profiles,
  public.order_deliverables,
  public.deliverable_reviews,
  public.deliverable_review_files,
  public.order_drafts,
  public.order_draft_files,
  public.portfolio_items,
  public.site_media_items
FROM anon, authenticated;

COMMIT;

-- ============================================================
-- Read-only verification queries.
-- Every statement below is SELECT-only.
-- ============================================================

-- 1. Function owner, SECURITY DEFINER status, arguments, and proconfig.
SELECT
  n.nspname AS function_schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,
  p.proconfig
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = p.pronamespace
WHERE p.oid IN (
  'public.rls_auto_enable()'::regprocedure,
  'public.generate_order_number(text)'::regprocedure,
  'public.update_client_profile_updated_at()'::regprocedure,
  'public.update_updated_at()'::regprocedure
)
ORDER BY n.nspname, p.proname, arguments;

-- 2. Function EXECUTE visibility for browser roles and service_role.
WITH target_functions(function_oid) AS (
  VALUES
    ('public.rls_auto_enable()'::regprocedure),
    ('public.generate_order_number(text)'::regprocedure),
    ('public.update_client_profile_updated_at()'::regprocedure),
    ('public.update_updated_at()'::regprocedure)
),
target_roles(role_name) AS (
  VALUES
    ('anon'),
    ('authenticated'),
    ('service_role')
)
SELECT
  tf.function_oid::regprocedure AS function_signature,
  tr.role_name AS grantee,
  pg_catalog.has_function_privilege(
    tr.role_name::name,
    tf.function_oid,
    'EXECUTE'
  ) AS can_execute
FROM target_functions AS tf
CROSS JOIN target_roles AS tr
ORDER BY tf.function_oid::text, tr.role_name;

-- 3. Remaining effective table privileges for anon/authenticated.
WITH target_tables(table_schema, table_name) AS (
  VALUES
    ('public', 'orders'),
    ('public', 'order_items'),
    ('public', 'order_sequences'),
    ('public', 'client_profiles'),
    ('public', 'order_deliverables'),
    ('public', 'deliverable_reviews'),
    ('public', 'deliverable_review_files'),
    ('public', 'order_drafts'),
    ('public', 'order_draft_files'),
    ('public', 'portfolio_items'),
    ('public', 'site_media_items')
),
target_roles(role_name) AS (
  VALUES
    ('anon'),
    ('authenticated')
),
target_privileges(privilege_type) AS (
  VALUES
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('DELETE'),
    ('TRUNCATE'),
    ('REFERENCES'),
    ('TRIGGER')
)
SELECT
  tt.table_schema,
  tt.table_name,
  tr.role_name AS grantee,
  tp.privilege_type
FROM target_tables AS tt
CROSS JOIN target_roles AS tr
CROSS JOIN target_privileges AS tp
WHERE pg_catalog.has_table_privilege(
  tr.role_name::name,
  (pg_catalog.quote_ident(tt.table_schema)
    || '.'
    || pg_catalog.quote_ident(tt.table_name))::regclass,
  tp.privilege_type
)
ORDER BY tt.table_schema, tt.table_name, tr.role_name, tp.privilege_type;

-- 4. Focused proof that TRUNCATE, TRIGGER, and REFERENCES are absent.
WITH target_tables(table_schema, table_name) AS (
  VALUES
    ('public', 'orders'),
    ('public', 'order_items'),
    ('public', 'order_sequences'),
    ('public', 'client_profiles'),
    ('public', 'order_deliverables'),
    ('public', 'deliverable_reviews'),
    ('public', 'deliverable_review_files'),
    ('public', 'order_drafts'),
    ('public', 'order_draft_files'),
    ('public', 'portfolio_items'),
    ('public', 'site_media_items')
),
target_roles(role_name) AS (
  VALUES
    ('anon'),
    ('authenticated')
),
revoked_privileges(privilege_type) AS (
  VALUES
    ('TRUNCATE'),
    ('TRIGGER'),
    ('REFERENCES')
)
SELECT
  tt.table_schema,
  tt.table_name,
  tr.role_name AS grantee,
  rp.privilege_type,
  pg_catalog.has_table_privilege(
    tr.role_name::name,
    (pg_catalog.quote_ident(tt.table_schema)
      || '.'
      || pg_catalog.quote_ident(tt.table_name))::regclass,
    rp.privilege_type
  ) AS still_has_privilege
FROM target_tables AS tt
CROSS JOIN target_roles AS tr
CROSS JOIN revoked_privileges AS rp
ORDER BY tt.table_schema, tt.table_name, tr.role_name, rp.privilege_type;

-- 5. Required browser-facing grants that should remain present.
WITH required_privileges(grantee, table_schema, table_name, privilege_type) AS (
  VALUES
    ('authenticated', 'public', 'client_profiles', 'SELECT'),
    ('authenticated', 'public', 'client_profiles', 'INSERT'),
    ('authenticated', 'public', 'client_profiles', 'UPDATE'),
    ('authenticated', 'public', 'order_drafts', 'SELECT'),
    ('authenticated', 'public', 'order_draft_files', 'SELECT'),
    ('anon', 'public', 'portfolio_items', 'SELECT'),
    ('authenticated', 'public', 'portfolio_items', 'SELECT'),
    ('anon', 'public', 'site_media_items', 'SELECT'),
    ('authenticated', 'public', 'site_media_items', 'SELECT')
)
SELECT
  rp.table_schema,
  rp.table_name,
  rp.grantee,
  rp.privilege_type,
  pg_catalog.has_table_privilege(
    rp.grantee::name,
    (pg_catalog.quote_ident(rp.table_schema)
      || '.'
      || pg_catalog.quote_ident(rp.table_name))::regclass,
    rp.privilege_type
  ) AS remains_present
FROM required_privileges AS rp
ORDER BY rp.table_schema, rp.table_name, rp.grantee, rp.privilege_type;

-- 6. Existing RLS-enabled state for the listed tables.
WITH target_tables(table_schema, table_name) AS (
  VALUES
    ('public', 'orders'),
    ('public', 'order_items'),
    ('public', 'order_sequences'),
    ('public', 'client_profiles'),
    ('public', 'order_deliverables'),
    ('public', 'deliverable_reviews'),
    ('public', 'deliverable_review_files'),
    ('public', 'order_drafts'),
    ('public', 'order_draft_files'),
    ('public', 'portfolio_items'),
    ('public', 'site_media_items')
)
SELECT
  n.nspname AS table_schema,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM target_tables AS tt
JOIN pg_catalog.pg_class AS c
  ON c.oid = (
    pg_catalog.quote_ident(tt.table_schema)
      || '.'
      || pg_catalog.quote_ident(tt.table_name)
  )::regclass
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = c.relnamespace
ORDER BY n.nspname, c.relname;

-- 7. Existing event trigger using rls_auto_enable() remains enabled.
SELECT
  et.evtname AS event_trigger_name,
  et.evtevent AS event_name,
  et.evtenabled AS enabled_state,
  et.evtenabled = 'O' AS enabled_for_origin_and_local,
  pg_catalog.pg_get_userbyid(et.evtowner) AS owner,
  et.evtfoid::regprocedure AS function_signature
FROM pg_catalog.pg_event_trigger AS et
WHERE et.evtfoid = 'public.rls_auto_enable()'::regprocedure
ORDER BY et.evtname;
