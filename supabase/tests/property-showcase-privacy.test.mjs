// In-memory PostgreSQL only; never accepts a database URL or production secrets.
// Install PGlite outside the repository; see PROPERTY_SHOWCASE_PRIVACY_RUNBOOK.md.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const entry = process.env.PROPERTY_PRIVACY_PGLITE_ENTRY;
assert.ok(entry && isAbsolute(entry), "Set PROPERTY_PRIVACY_PGLITE_ENTRY to the local PGlite dist/index.js file");
const { PGlite } = await import(pathToFileURL(entry).href);
const { pgcrypto } = await import(new URL("./contrib/pgcrypto.js", pathToFileURL(entry)).href);
const foundation = readFileSync(new URL("../add-property-showcase-foundation.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../migrations/20260919175745_harden_property_showcase_raw_access.sql", import.meta.url), "utf8");
const roles = ["anon", "authenticated"];

async function database(t) {
  const db = new PGlite({ extensions: { pgcrypto } });
  t.after(() => db.close());
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  `);
  await db.exec(foundation);
  await db.exec(`
    INSERT INTO public.property_showcases (slug, content, published, published_at)
    VALUES ('synthetic-private', '{"slug":"synthetic-private","location":{"privacyMode":"hidden","streetAddress":"SYNTHETIC-PRIVATE-MARKER"}}', true, now()),
           ('synthetic-draft', '{"slug":"synthetic-draft"}', false, null);
  `);
  return db;
}

async function asRole(db, role, query) {
  assert.ok(roles.includes(role) || role === "service_role");
  await db.exec(`SET ROLE ${role}`);
  try {
    return await db.query(query);
  } finally {
    await db.exec("RESET ROLE");
  }
}

async function assertDenied(db) {
  for (const role of roles) {
    for (const query of [
      "SELECT * FROM public.property_showcases",
      "SELECT content FROM public.property_showcases WHERE published",
      "SELECT content->'location' FROM public.property_showcases",
      "SELECT slug FROM public.property_showcases",
    ]) {
      await assert.rejects(asRole(db, role, query), { code: "42501" });
    }
  }
  const result = await db.query(`
    SELECT rolname,
      has_table_privilege(oid, 'public.property_showcases', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS table_access,
      has_any_column_privilege(oid, 'public.property_showcases', 'SELECT,INSERT,UPDATE,REFERENCES') AS column_access
    FROM pg_roles WHERE rolname IN ('anon', 'authenticated') ORDER BY rolname
  `);
  assert.equal(result.rows.length, 2);
  assert.ok(result.rows.every((row) => !row.table_access && !row.column_access));
}

test("legacy published raw reads reproduce, then fail with 42501; server CRUD and data survive", async (t) => {
  const db = await database(t);
  // Reproduce the audited permission model, not just its SQL spelling.
  await db.exec(`
    GRANT SELECT ON public.property_showcases TO anon, authenticated;
    CREATE POLICY property_showcases_public_read ON public.property_showcases
      FOR SELECT TO anon, authenticated USING (published = true);
  `);
  for (const role of roles) {
    const result = await asRole(db, role, "SELECT content->'location' IS NOT NULL AS exposed FROM public.property_showcases");
    assert.deepEqual(result.rows, [{ exposed: true }]);
  }
  const before = await db.query("SELECT * FROM public.property_showcases ORDER BY slug");
  await db.exec(migration);
  await db.exec(migration); // Idempotence.
  await assertDenied(db);
  assert.deepEqual((await db.query("SELECT * FROM public.property_showcases ORDER BY slug")).rows, before.rows);
  assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.property_showcases'::regclass")).rows[0].relrowsecurity, true);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='public' AND tablename='property_showcases'")).rows[0].n, 0);
  assert.equal((await asRole(db, "service_role", "SELECT * FROM public.property_showcases")).rows.length, 2);
  assert.equal((await asRole(db, "service_role", "SELECT content FROM public.property_showcases WHERE published")).rows.length, 1);
  await asRole(db, "service_role", `INSERT INTO public.property_showcases (slug,content) VALUES ('server-write','{"slug":"server-write"}') RETURNING id`);
  assert.equal((await asRole(db, "service_role", "UPDATE public.property_showcases SET published=true,published_at=now() WHERE slug='server-write' RETURNING id")).rows.length, 1);
  assert.equal((await asRole(db, "service_role", "DELETE FROM public.property_showcases WHERE slug='server-write' RETURNING id")).rows.length, 1);
});

for (const grant of [
  "GRANT SELECT ON public.property_showcases TO PUBLIC",
  "GRANT SELECT (content) ON public.property_showcases TO PUBLIC, anon, authenticated",
]) {
  test(`revokes alternate access source: ${grant}`, async (t) => {
    const db = await database(t);
    await db.exec(`${grant}; CREATE POLICY property_showcases_public_read ON public.property_showcases FOR SELECT TO PUBLIC USING (published);`);
    for (const role of roles) {
      assert.equal((await asRole(db, role, "SELECT content FROM public.property_showcases")).rows.length, 1);
    }
    await db.exec(migration);
    await assertDenied(db);
  });
}

for (const inheritance of ["INHERIT", "NOINHERIT"]) {
  test(`unexpected ${inheritance} parent-role column grant aborts instead of silently claiming closure`, async (t) => {
    const db = await database(t);
    await db.exec(`
      CREATE ROLE legacy_property_reader;
      GRANT legacy_property_reader TO authenticated WITH INHERIT ${inheritance === "INHERIT" ? "TRUE" : "FALSE"};
      GRANT SELECT (content) ON public.property_showcases TO legacy_property_reader;
      CREATE POLICY property_showcases_public_read ON public.property_showcases FOR SELECT TO PUBLIC USING (published);
    `);
    assert.equal((await db.query("SELECT has_column_privilege('authenticated','public.property_showcases','content','SELECT') AS inherited")).rows[0].inherited, inheritance === "INHERIT");
    await assert.rejects(db.exec(migration), /hardening aborted: browser role authenticated retains access through (authenticated|legacy_property_reader)/);
    await db.exec("ROLLBACK");
    // No global memberships or shared parent privileges were silently changed.
    assert.equal((await db.query("SELECT pg_has_role('authenticated','legacy_property_reader','MEMBER') AS member")).rows[0].member, true);
    assert.equal((await db.query("SELECT has_column_privilege('legacy_property_reader','public.property_showcases','content','SELECT') AS granted")).rows[0].granted, true);
  });
}

test("fresh initialization and replay cannot restore the obsolete public policy", async (t) => {
  const db = await database(t);
  await assertDenied(db);
  await db.exec(migration);
  await db.exec(foundation);
  await assertDenied(db);
  assert.equal((await asRole(db, "service_role", "SELECT * FROM public.property_showcases")).rows.length, 2);
});

test("an incompatible service role aborts without adding a permissive policy", async (t) => {
  const db = await database(t);
  await db.exec("ALTER ROLE service_role NOBYPASSRLS");
  await assert.rejects(db.exec(migration), /Expected service_role BYPASSRLS/);
  await db.exec("ROLLBACK");
});
