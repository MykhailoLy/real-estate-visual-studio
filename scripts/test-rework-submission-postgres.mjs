/** F7 real PostgreSQL races. Fresh loopback-only cluster; synthetic data only.
 * Uses the existing F3/F5 external native PostgreSQL + pg pattern, independently.
 * Set F7_POSTGRES_BIN_DIR and F7_PG_DRIVER_MODULE to absolute external paths.
 * Missing runtime is a skip, never a successful database verification.
 */
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
const executeFile = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const runtime = process.env.F7_POSTGRES_BIN_DIR;
const driver = process.env.F7_PG_DRIVER_MODULE;
const migration = "supabase/migrations/20260926134104_f7_atomic_rework_submission.sql";
function binary(name) {
  return join(runtime, process.platform === "win32" ? `${name}.exe` : name);
}

async function loadSql(relativePath) {
  return readFile(join(repositoryRoot, relativePath), "utf8");
}

async function unusedLoopbackPort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startCluster() {
  assert.ok(isAbsolute(runtime), "Use an explicit absolute PostgreSQL binary directory");
  assert.ok(isAbsolute(driver), "Use an explicit absolute external pg module path");
  const { Client } = createRequire(import.meta.url)(driver);
  const directory = await mkdtemp(join(tmpdir(), "picchuspot-f7-postgres-"));
  const dataDirectory = join(directory, "data");
  const username = `f7_${randomUUID().replaceAll("-", "")}`;
  const port = await unusedLoopbackPort();
  await executeFile(binary("initdb"), ["-D", dataDirectory, "-U", username, "-A", "trust", "--encoding=UTF8", "--locale=C"], { windowsHide: true });
  const server = spawn(binary("postgres"), ["-D", dataDirectory, "-h", "127.0.0.1", "-p", String(port), "-c", "max_connections=12"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let serverLog = "";
  server.stdout.on("data", (chunk) => { serverLog += chunk.toString(); });
  server.stderr.on("data", (chunk) => { serverLog += chunk.toString(); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`PostgreSQL startup timed out: ${serverLog}`)), 30000);
    const inspect = () => {
      if (serverLog.includes("database system is ready to accept connections")) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout.on("data", inspect);
    server.stderr.on("data", inspect);
    server.once("error", (error) => { clearTimeout(timer); reject(error); });
    server.once("exit", (code) => { clearTimeout(timer); reject(new Error(`PostgreSQL exited ${code}: ${serverLog}`)); });
  });
  const sessions = [];
  const connect = async (name) => {
    // Explicit fields only: never consult DATABASE_URL or application credentials.
    const client = new Client({ host: "127.0.0.1", port, user: username, database: "postgres", password: "", ssl: false, application_name: `f7-${name}` });
    await client.connect();
    await client.query("SET statement_timeout = '15s'");
    sessions.push(client);
    return client;
  };
  return {
    directory,
    connect,
    async stop() {
      await Promise.all(sessions.map((client) => client.end()));
      await executeFile(binary("pg_ctl"), ["-D", dataDirectory, "-m", "fast", "-w", "stop"], { windowsHide: true });
      if (server.exitCode === null) await once(server, "exit");
      // Keep the synthetic cluster/logs in OS temp for review; never delete user paths.
    },
  };
}

async function install(client) {
  // Minimal synthetic FK/auth prerequisites; actual review tables, constraints,
  // RLS and active index come from the repository's unchanged historical SQL.
  await client.query(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;
    CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql AS $$ SELECT NULL::text $$;
    CREATE TABLE public.orders(id uuid PRIMARY KEY, client_email text);
    CREATE TABLE public.order_deliverables(id uuid PRIMARY KEY, order_id uuid REFERENCES public.orders);
    CREATE FUNCTION public.update_updated_at() RETURNS trigger LANGUAGE plpgsql
      AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;`);
  for (const path of ["supabase/add-deliverable-reviews.sql", "supabase/add-deliverable-review-files.sql",
    "supabase/20260909191236_add_deliverable_review_file_upload_status.sql"]) {
    await client.query(await loadSql(path));
  }
  const before = await catalog(client);
  await client.query(await loadSql(migration));
  await client.query(await loadSql(migration)); // Idempotence, no grant widening.
  assert.deepEqual(await catalog(client), before, "Tables, indexes, policies and grants unchanged");
}

async function catalog(client) {
  return (await client.query(`SELECT 'constraint' AS kind, conname AS name, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conrelid IN ('public.deliverable_reviews'::regclass, 'public.deliverable_review_files'::regclass)
    UNION ALL SELECT 'index', indexname, indexdef FROM pg_indexes WHERE tablename IN ('deliverable_reviews', 'deliverable_review_files')
    UNION ALL SELECT 'table', relname, relacl::text || '/' || relrowsecurity::text FROM pg_class WHERE oid IN ('public.deliverable_reviews'::regclass, 'public.deliverable_review_files'::regclass)
    UNION ALL SELECT 'policy', policyname, coalesce(qual, '') || coalesce(with_check, '') FROM pg_policies WHERE tablename IN ('deliverable_reviews', 'deliverable_review_files')
    ORDER BY kind, name, definition`)).rows;
}

async function seed(client, deliverableId = randomUUID(), status = "pending_review") {
  const orderId = randomUUID(), reviewId = randomUUID();
  await client.query("INSERT INTO orders VALUES ($1, 'synthetic@example.invalid')", [orderId]);
  await client.query("INSERT INTO order_deliverables VALUES ($1, $2) ON CONFLICT DO NOTHING", [deliverableId, orderId]);
  await client.query(`INSERT INTO deliverable_reviews(id, deliverable_id, order_id, order_number, item_index, client_email, status, comment)
    VALUES ($1, $2, $3, 'F7-SYNTHETIC', 2, 'synthetic@example.invalid', $4, 'Please adjust the light.')`, [reviewId, deliverableId, orderId, status]);
  return { reviewId, deliverableId, orderId };
}
async function slot(client, reviewId) {
  const fileId = randomUUID();
  return (await client.query("SELECT * FROM public.prepare_rework_reference_file_upload($1,$2,$3,'reference.png',8::bigint,'image/png')",
    [reviewId, fileId, `synthetic/${reviewId}/${fileId}.png`])).rows[0];
}
async function finalize(client, reviewId, count) {
  return (await client.query("SELECT * FROM public.finalize_rework_review_submission($1,$2)", [reviewId, count])).rows[0];
}
async function upload(client, reviewId) {
  await client.query("UPDATE deliverable_review_files SET upload_status='uploaded' WHERE review_id=$1", [reviewId]);
}
async function waiting(observer, blocked, blocker) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const row = (await observer.query("SELECT wait_event_type, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1", [blocked])).rows[0];
    if (row?.wait_event_type === "Lock" && row.blockers.includes(blocker)) return;
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  assert.fail("Expected database row-lock barrier was not observed");
}

test("F7 native PostgreSQL: strict slots and finalization share the parent lock", { skip: !runtime || !driver, timeout: 90000 }, async (t) => {
  const cluster = await startCluster();
  try {
    const observer = await cluster.connect("observer");
    await install(observer);
    const a = await cluster.connect("slot"), b = await cluster.connect("finalizer");
    const pidA = (await a.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    const pidB = (await b.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    assert.notEqual(pidA, pidB);
    t.diagnostic(`PostgreSQL ${(await observer.query("SHOW server_version")).rows[0].server_version}; distinct backends ${pidA}/${pidB}`);
    await a.query("SET ROLE service_role"); await b.query("SET ROLE service_role");

    await t.test("A/B/C: slot holds parent lock; finalize waits and counts committed pending slot", async () => {
      const { reviewId } = await seed(observer);
      await a.query("BEGIN");
      assert.equal((await slot(a, reviewId)).result_code, "prepared");
      const pending = finalize(b, reviewId, 1);
      await waiting(observer, pidB, pidA);
      await a.query("COMMIT");
      assert.equal((await pending).result_code, "files_incomplete");
      assert.equal((await observer.query("SELECT count(*)::int AS n FROM deliverable_review_files WHERE review_id=$1", [reviewId])).rows[0].n, 1);
      await upload(observer, reviewId);
      assert.equal((await finalize(b, reviewId, 1)).result_code, "finalized");
    });
    await t.test("D: finalize commits first; a waiting strict slot cannot insert", async () => {
      const { reviewId } = await seed(observer);
      await slot(a, reviewId); await upload(observer, reviewId);
      await b.query("BEGIN");
      assert.equal((await finalize(b, reviewId, 1)).result_code, "finalized");
      const pending = slot(a, reviewId);
      await waiting(observer, pidA, pidB);
      await b.query("COMMIT");
      assert.equal((await pending).result_code, "invalid_state");
      assert.equal((await observer.query("SELECT count(*)::int AS n FROM deliverable_review_files WHERE review_id=$1", [reviewId])).rows[0].n, 1);
    });
    await t.test("E/F/G: pending, mismatched and invalid counts reject; exact verified count promotes once", async () => {
      const { reviewId, orderId, deliverableId } = await seed(observer);
      const prepared = await slot(a, reviewId);
      const file = (await observer.query("SELECT * FROM deliverable_review_files WHERE id=$1", [prepared.file_id])).rows[0];
      assert.equal(file.order_id, orderId); assert.equal(file.deliverable_id, deliverableId);
      assert.equal(file.item_index, 2); assert.equal(file.upload_status, "pending");
      assert.equal((await finalize(b, reviewId, 1)).result_code, "files_incomplete");
      await upload(observer, reviewId);
      for (const count of [0, 6, null]) assert.equal((await finalize(b, reviewId, count)).result_code, "invalid_count");
      assert.equal((await finalize(b, reviewId, 2)).result_code, "files_incomplete");
      await slot(a, reviewId);
      assert.equal((await finalize(b, reviewId, 1)).result_code, "files_incomplete");
      assert.equal((await finalize(b, reviewId, 2)).result_code, "files_incomplete");
      await upload(observer, reviewId);
      assert.equal((await finalize(b, reviewId, 2)).result_code, "finalized");
      assert.equal((await finalize(b, reviewId, 2)).result_code, "invalid_state");
    });
    await t.test("H: concurrent second finalization waits and cannot promote twice", async () => {
      const { reviewId } = await seed(observer);
      await slot(a, reviewId); await upload(observer, reviewId);
      await a.query("BEGIN");
      assert.equal((await finalize(a, reviewId, 1)).result_code, "finalized");
      const pending = finalize(b, reviewId, 1);
      await waiting(observer, pidB, pidA);
      await a.query("COMMIT");
      assert.equal((await pending).result_code, "invalid_state");
    });
    await t.test("I: existing active review conflicts without changing the preparation", async () => {
      const active = await seed(observer, randomUUID(), "rework_requested");
      const { reviewId } = await seed(observer, active.deliverableId);
      await slot(a, reviewId); await upload(observer, reviewId);
      assert.equal((await finalize(b, reviewId, 1)).result_code, "active_rework");
      assert.equal((await observer.query("SELECT status FROM deliverable_reviews WHERE id=$1", [reviewId])).rows[0].status, "pending_review");
    });
    await t.test("I: separate preparations race against the unchanged unique active index", async () => {
      const first = await seed(observer), second = await seed(observer, first.deliverableId);
      await slot(a, first.reviewId); await slot(b, second.reviewId);
      await upload(observer, first.reviewId); await upload(observer, second.reviewId);
      await a.query("BEGIN");
      assert.equal((await finalize(a, first.reviewId, 1)).result_code, "finalized");
      const pending = finalize(b, second.reviewId, 1);
      await waiting(observer, pidB, pidA); await a.query("COMMIT");
      assert.equal((await pending).result_code, "active_rework");
    });
    await t.test("Slot limit is enforced under lock across concurrent requests", async () => {
      const { reviewId } = await seed(observer);
      for (let i = 0; i < 4; i++) await slot(a, reviewId);
      await a.query("BEGIN"); assert.equal((await slot(a, reviewId)).result_code, "prepared");
      const pending = slot(b, reviewId);
      await waiting(observer, pidB, pidA); await a.query("COMMIT");
      assert.equal((await pending).result_code, "file_limit");
    });
    await t.test("Retirement racing finalization never deletes committed references", async () => {
      const { reviewId } = await seed(observer);
      await slot(a, reviewId); await upload(observer, reviewId);
      await a.query("BEGIN"); await finalize(a, reviewId, 1);
      const pending = b.query("DELETE FROM deliverable_reviews WHERE id=$1 AND status='pending_review' RETURNING id", [reviewId]);
      await waiting(observer, pidB, pidA); await a.query("COMMIT");
      assert.equal((await pending).rowCount, 0);
      assert.equal((await observer.query("SELECT count(*)::int AS n FROM deliverable_review_files WHERE review_id=$1", [reviewId])).rows[0].n, 1);
    });
    await t.test("Retired preparation cascades metadata; late slot and finalize cannot restore it", async () => {
      const { reviewId } = await seed(observer);
      await slot(a, reviewId);
      await observer.query("DELETE FROM deliverable_reviews WHERE id=$1 AND status='pending_review'", [reviewId]);
      assert.equal((await slot(a, reviewId)).result_code, "not_found");
      assert.equal((await finalize(b, reviewId, 1)).result_code, "not_found");
      assert.equal((await observer.query("SELECT count(*)::int AS n FROM deliverable_review_files WHERE review_id=$1", [reviewId])).rows[0].n, 0);
    });
    await t.test("J: invoker RPCs reject PUBLIC/anon/authenticated and allow only service_role", async () => {
      const functions = (await observer.query(`SELECT oid, proname, prosecdef, proconfig,
        has_function_privilege('anon',oid,'EXECUTE') AS anon,
        has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated,
        has_function_privilege('service_role',oid,'EXECUTE') AS service_role,
        EXISTS(SELECT 1 FROM aclexplode(proacl) WHERE grantee=0 AND privilege_type='EXECUTE') AS public
        FROM pg_proc WHERE proname IN ('prepare_rework_reference_file_upload','finalize_rework_review_submission')`)).rows;
      assert.equal(functions.length, 2);
      for (const fn of functions) {
        assert.equal(fn.prosecdef, false); assert.equal(fn.anon, false);
        assert.equal(fn.authenticated, false); assert.equal(fn.public, false);
        assert.equal(fn.service_role, true); assert.deepEqual(fn.proconfig, ["search_path=pg_catalog, public"]);
      }
      for (const role of ["anon", "authenticated"]) {
        await b.query(`SET ROLE ${role}`);
        await assert.rejects(slot(b, randomUUID()), { code: "42501" });
        await assert.rejects(finalize(b, randomUUID(), 1), { code: "42501" });
      }
      await b.query("SET ROLE service_role");
    });
  } finally { await cluster.stop(); }
});
