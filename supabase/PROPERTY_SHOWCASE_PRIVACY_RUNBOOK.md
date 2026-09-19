# Property Showcase raw-record privacy: manual rollout

Status: local patch only. **Production remains exposed until this migration is
applied and effective permissions are verified.** No production SQL, configuration
or data was changed while preparing the patch.

Migration: `migrations/20260919175745_harden_property_showcase_raw_access.sql`.
Base reviewed: `6a806514cc38ba4e3e89bac11fe1e12576dad026`.

## Scope and compatibility

The permission boundary is the complete `public.property_showcases` document, not
the `published` flag. Published documents can still contain private exact-location
fields. Browser roles must not read this table, including individual columns.
Public output remains the existing server loader plus privacy serializer.

| Consumer | Existing database role / boundary |
| --- | --- |
| `src/features/property-showcase/server.ts` public loader | `createServerClient()` from `src/lib/supabase.ts`, service role, filters `published=true` |
| `/property/[slug]` and metadata | Above loader; page serializes before `PropertyShowcaseView` client props; metadata uses privacy-aware address presentation |
| Public Open Graph, materials and flyer routes | Above loader; existing privacy-aware social/material rendering |
| Admin list, media, preview, analytics and API CRUD | Server admin authentication followed by service-role reads/writes |
| `property-leads-server.ts`, `property-analytics-server.ts` | Service-role published-property lookup; raw document not returned by these endpoints |
| `scripts/supabase-public-media-backfill-adapter.ts` | Service-role client supplied by the maintenance command |
| `src/app/sitemap.ts` | No Property Showcase database consumer |
| Repository SQL | Timestamp trigger and leads/analytics foreign keys; no view or content-returning RPC found |

No runtime application, API, authentication, storage, order, payment, pricing,
email or environment configuration changes are needed. Exact/approximate/hidden
presentation and authorized admin access to full records remain unchanged.
The foundation initializer is corrected only to stop future initialization/replay
from reintroducing the obsolete public SELECT policy/grants. Use the forward
migration for existing databases; do not replay historical scripts.

## Preflight (read-only, before separately approved production execution)

1. Confirm the target project and deployed revision; verify every current table
   consumer still uses the service-role server client. Do not reveal key values.
   Obtain a maintenance window if DDL lock contention is possible.
2. Confirm the table, owner, RLS and expected roles. Record row count and a
   server-side digest if needed; never export actual location content to logs.

   ```sql
   SELECT c.oid::regclass AS relation, pg_get_userbyid(c.relowner) AS owner,
          c.relrowsecurity, c.relforcerowsecurity
   FROM pg_class c WHERE c.oid = 'public.property_showcases'::regclass;
   SELECT rolname, rolsuper, rolbypassrls
   FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');
   SELECT count(*) AS row_count FROM public.property_showcases;
   SELECT policyname, roles, cmd, permissive FROM pg_policies
   WHERE schemaname='public' AND tablename='property_showcases';
   ```

3. Inspect **effective** table/column access, including PUBLIC and parent roles.
   The following query is also a post-application check: after success every
   browser/reachable-role row must have both access columns false.

   ```sql
   SELECT b.rolname AS browser_role, r.rolname AS reachable_role,
     has_table_privilege(r.oid, 'public.property_showcases',
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS table_access,
     has_any_column_privilege(r.oid, 'public.property_showcases',
       'SELECT,INSERT,UPDATE,REFERENCES') AS column_access
   FROM pg_roles b CROSS JOIN pg_roles r
   WHERE b.rolname IN ('anon','authenticated')
     AND (b.oid=r.oid OR pg_has_role(b.oid,r.oid,'MEMBER'))
   ORDER BY 1,2;
   ```

   Unexpected parent grants, browser ownership/privileged membership, grant chains
   or a service role without BYPASSRLS require review. The migration aborts instead
   of rewriting shared memberships, using CASCADE, or silently accepting access.
   Do not treat an aborted transaction as remediation; prior exposure remains.

4. Check live alternate access paths, not just repository files. This recursively
   enumerates dependent views/materialized views without reading their data:

   ```sql
   WITH RECURSIVE dependent_relations(oid) AS (
     SELECT 'public.property_showcases'::regclass::oid
     UNION
     SELECT rw.ev_class
     FROM dependent_relations parent
     JOIN pg_depend d ON d.refobjid=parent.oid
       AND d.refclassid='pg_class'::regclass
       AND d.classid='pg_rewrite'::regclass
     JOIN pg_rewrite rw ON rw.oid=d.objid
     JOIN pg_class c ON c.oid=rw.ev_class AND c.relkind IN ('v','m')
   )
   SELECT oid::regclass AS dependent_relation FROM dependent_relations
   WHERE oid <> 'public.property_showcases'::regclass;

   SELECT p.oid::regprocedure AS candidate_routine, p.prosecdef,
     has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
     has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname NOT IN ('pg_catalog','information_schema')
     AND CASE WHEN p.prokind IN ('f','p') THEN pg_get_functiondef(p.oid)
              ELSE '' END ILIKE '%property_showcases%';
   ```

   Inspect any exposed views, definer functions, dynamic SQL, cached copies or
   custom API readers. The routine search is a triage aid, not exhaustive proof.
   Stop for scoped review if any alternate browser-readable copy exists; this
   table-only migration does not silently modify other objects.

## Apply manually, only after explicit approval

Execute the **single named migration file**, as the table owner/approved database
administrator, with stop-on-error behavior. Do not run `db push`, replay all SQL,
change default privileges or edit role memberships. Its transaction uses a 5-second
lock timeout and 30-second statement timeout, enables RLS, revokes PUBLIC/anon/
authenticated privileges (including column grants), removes the obsolete policy,
preserves service-role access and ensures required CRUD grants. It changes no rows.

An error means **ROLLBACK and stop**. Review the reported object/role before any
new attempt. Record successful application through the project's manual migration
process; do not mark applied merely because SQL was submitted.

## Post-application checks

1. Rerun the effective-grant query above: every browser-role result is false.
   RLS must remain enabled and `property_showcases_public_read` must be absent.
   Verify service-role SELECT/INSERT/UPDATE/DELETE individually:

   ```sql
   SELECT privilege,
     has_table_privilege('service_role','public.property_showcases',privilege) AS allowed
   FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) AS privilege;
   ```

2. Test actual role execution, not just catalogs. Run separately for `anon` and
   `authenticated` with a tool that always rolls back after the expected error:

   ```sql
   BEGIN READ ONLY;
   SET LOCAL ROLE anon; -- repeat separately with authenticated
   SELECT content FROM public.property_showcases LIMIT 0;
   ROLLBACK;
   ```

   Expect SQLSTATE **42501**. `LIMIT 0` avoids revealing fields even if permissions
   are unexpectedly still open. Repeat for `SELECT *` and `SELECT slug`. Always
   ROLLBACK/reset after an error before further checks.

3. In a read-only transaction under `service_role`, a published-row count must
   succeed. Check public pages, metadata/OG and existing admin list/preview with
   authorized access. Do not perform production create/edit/delete merely as a
   smoke test; real CRUD was exercised against synthetic local fixtures.
4. Make a bounded direct Data API GET selecting `content` with `limit=0`, first
   anonymous and then with an existing ordinary user's token. Use secure tooling;
   do not paste/log credentials. Expect permission denial (42501), no record data.
   Verify known public pages still succeed through Next.js.
5. For synthetic staging exact/approximate/hidden fixtures, inspect HTML, embedded
   client props/RSC and metadata. Restricted exact fields must be absent even with
   missing/partial optional fields; exact mode must retain its intended public
   fields. Previously public content cannot be recalled from third-party caches.

## Recovery: preserve the privacy boundary

- If application is rejected/rolled back, the previous exposure remains. Escalate
  unexpected inherited/column grants or incompatible service-role configuration
  for a narrowly reviewed forward correction; do not claim closure.
- If public pages fail after successful application, diagnose the server client,
  its role and required CRUD grants. Keep browser access revoked and RLS enabled.
  Repair the server-only path or, with separate approval, temporarily take affected
  showcases offline. Never restore the public policy, grant raw SELECT back to
  browser roles, move the service key to the browser, or disable RLS as rollback.
- No property content changed, so no content rollback is needed. Do not restore a
  permissions snapshot wholesale: it contains the vulnerable grants.

## Local validation and limitations

The executable database regression uses in-memory PostgreSQL (PGlite), synthetic
roles and fixtures. It accepts **no database URL**, cannot reach production and
does not rely on SQL string matching to prove denial. Install its test-only engine
outside the repository; no application dependency/lockfile changes are necessary:

```powershell
$privacyTestDeps = Join-Path $env:TEMP ('picchuspot-privacy-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $privacyTestDeps
npm.cmd install --prefix $privacyTestDeps --no-save --ignore-scripts --package-lock=false @electric-sql/pglite@0.5.8
$env:PROPERTY_PRIVACY_PGLITE_ENTRY = Join-Path $privacyTestDeps 'node_modules/@electric-sql/pglite/dist/index.js'
node --test supabase/tests/property-showcase-privacy.test.mjs
npm.cmd run test:property-showcase
npm.cmd run typecheck:test
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run lint
npm.cmd run build
```

Database coverage: original leak reproduced; actual 42501 denials for both roles;
PUBLIC/column grants; INHERIT and NOINHERIT membership rejection; server reads and
CRUD; RLS retained; unchanged rows; idempotence; fresh initialization and replay;
incompatible service-role rejection. PGlite 0.5.8 runs PostgreSQL 18.3; this is not
the complete hosted Supabase/PostgREST stack or the production PostgreSQL 17 build.
Docker's local engine was unavailable. A PostgreSQL 17 PGlite attempt lacked the
foundation's pgcrypto extension and was not counted as successful validation.

Completed checks: 7/7 executable database tests, 324/324 Property Showcase tests,
application and test TypeScript checks, lint (zero errors, nine existing warnings),
and production build (passed; existing `preferredRegion` deprecation warning).

Additional local production-build verification used a temporary loopback-only
HTTP adapter to the isolated database, synthetic credentials and the **unchanged**
Next server loader. Eighteen HTML/RSC responses covered all three privacy modes
with full, partial and absent optional fields; three draft/missing/invalid-record
requests failed closed with 404. Private synthetic markers were absent from
restricted HTML, client props/RSC and metadata; exact-mode props remained intact.
This does not replace the direct hosted Data API role checks above. No production
test writes, production SQL, real addresses, credentials or signed URLs were used.

References: [Supabase grants versus RLS](https://supabase.com/docs/guides/api/securing-your-api),
[PostgreSQL REVOKE, column grants and inherited privileges](https://www.postgresql.org/docs/17/sql-revoke.html).

Next approval: approve the patch, then **separately authorize an operator to apply
this exact migration manually to the confirmed production project after preflight
and verify effective permissions and public/admin reads**. Commit, push, PR,
merge and deployment require their own authorization; none was performed here.
