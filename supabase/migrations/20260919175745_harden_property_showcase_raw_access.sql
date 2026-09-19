-- MANUAL MIGRATION ONLY. Review PROPERTY_SHOWCASE_PRIVACY_RUNBOOK.md first.
-- Existing public pages and admin operations use the server service-role client.
-- Raw content includes private location fields; a published row is not a public DTO.
-- No property rows, role memberships, other tables or default privileges change.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.property_showcases ENABLE ROW LEVEL SECURITY;

-- PostgreSQL table-level REVOKE also removes these grantees' column grants.
-- PUBLIC is a separate privilege source from anon/authenticated.
REVOKE ALL PRIVILEGES ON TABLE public.property_showcases
  FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS property_showcases_public_read
  ON public.property_showcases;

-- Preserve existing privileges and ensure the CRUD used by the server remains.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.property_showcases
  TO service_role;

DO $guard$
DECLARE
  browser_role name;
  reachable_role record;
BEGIN
  FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated']::name[] LOOP
    -- Include membership paths even when INHERIT is disabled. Do not revoke
    -- shared parent-role grants or memberships as a side effect of this fix.
    FOR reachable_role IN
      SELECT oid, rolname FROM pg_catalog.pg_roles
      WHERE rolname = browser_role
         OR pg_catalog.pg_has_role(browser_role, oid, 'MEMBER')
    LOOP
      IF pg_catalog.has_table_privilege(
           reachable_role.oid, 'public.property_showcases',
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
         ) OR pg_catalog.has_any_column_privilege(
           reachable_role.oid, 'public.property_showcases',
           'SELECT,INSERT,UPDATE,REFERENCES'
         ) THEN
        RAISE EXCEPTION
          'property_showcases hardening aborted: browser role % retains access through %. Review effective grants; do not restore public reads.',
          browser_role, reachable_role.rolname;
      END IF;
    END LOOP;
  END LOOP;

  -- The existing server architecture requires service_role to bypass RLS.
  -- Abort on a different role model rather than adding a broad access policy.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'service_role' AND rolbypassrls
  ) THEN
    RAISE EXCEPTION 'Expected service_role BYPASSRLS; review server role configuration before applying';
  END IF;
END;
$guard$;

COMMIT;
