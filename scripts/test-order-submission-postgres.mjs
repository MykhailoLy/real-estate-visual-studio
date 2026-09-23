/**
 * Opt-in real PostgreSQL concurrency regression; no production connection exists.
 *
 * Provide F3_POSTGRES_BIN_DIR (initdb/postgres/pg_ctl) and F3_PG_DRIVER_MODULE
 * (absolute path to an externally installed pg package). No repo dependency change
 * is needed. Example PowerShell, after installing those tools outside this repo:
 *   $env:F3_POSTGRES_BIN_DIR = 'C:/temporary/runtime/package/native/bin'
 *   $env:F3_PG_DRIVER_MODULE = 'C:/temporary/runtime/node_modules/pg'
 *   node --test scripts/test-order-submission-postgres.mjs
 *
 * Every run initializes a fresh temporary cluster listening on loopback only,
 * loads the repository SQL, creates synthetic rows, and stops the cluster.
 * Separate PostgreSQL backend sessions and observed lock barriers prove races;
 * this is not PGlite, a mock RPC implementation, or an in-process simulation.
 * Auth providers/Storage/HTTP/email sending are deliberately outside this test.
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
const runtime = process.env.F3_POSTGRES_BIN_DIR;
const driver = process.env.F3_PG_DRIVER_MODULE;
const enabled = Boolean(runtime && driver);
const hash = "a".repeat(64);
const quoteHash = "b".repeat(64);
const snapshot = {
  serviceType: "virtual-staging",
  currency: "USD",
  pricingVersion: "f3-synthetic-v1",
  totalCents: 1500,
  items: [{ lineSubtotalCents: 1500 }],
};

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
  const directory = await mkdtemp(join(tmpdir(), "picchuspot-f3-postgres-"));
  const dataDirectory = join(directory, "data");
  const username = `f3_${randomUUID().replaceAll("-", "")}`;
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
    const client = new Client({ host: "127.0.0.1", port, user: username, database: "postgres", password: "", ssl: false, application_name: `f3-${name}` });
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

async function installRepositoryContracts(client) {
  await client.query(await loadSql("scripts/fixtures/order-submission-postgres.sql"));
  await client.query(await loadSql("supabase/schema.sql"));
  await client.query(await loadSql("supabase/add-order-drafts.sql"));
  await client.query(await loadSql("supabase/add-order-draft-finalization.sql"));
  await client.query(await loadSql("supabase/add-multi-reference-files.sql"));
  await client.query(await loadSql("supabase/add-atomic-order-submissions.sql"));
  // Manifest authority: the floor-plan compatibility migration replaces commit.
  // Execute its exact body and grants, never a hand-copied algorithm.
  const latestCommit = await loadSql("supabase/allow-floor-plan-draft-finalization.sql");
  const start = latestCommit.indexOf("CREATE OR REPLACE FUNCTION public.commit_order_submission(");
  assert.notEqual(start, -1);
  const end = latestCommit.indexOf("COMMIT;", start);
  await client.query(latestCommit.slice(start, end === -1 ? undefined : end));
}

async function claim(client, owner, submission, token, overrides = {}) {
  const result = await client.query(`SELECT * FROM public.claim_order_submission(
    $1::uuid, $2::uuid, $3::text, 1::smallint, 'virtual-staging', NULL::uuid,
    $4::uuid, 'USD', $5::text, $6::text, $7::integer, $8::jsonb
  )`, [owner, submission, overrides.hash ?? hash, token, snapshot.pricingVersion, overrides.quoteHash ?? quoteHash, snapshot.totalCents, JSON.stringify(snapshot)]);
  return result.rows[0];
}

function itemsFor(submission) {
  return [{
    itemIndex: 0,
    originalPhotoPath: `f3-synthetic/${submission}/original.jpg`,
    referenceImagePath: `f3-synthetic/${submission}/reference.jpg`,
    subtotalCents: 1500,
    details: { synthetic: true },
    references: [{ referenceId: "44444444-4444-4444-8444-444444444444", position: 0, bucket: "order-files", storagePath: `f3-synthetic/${submission}/reference.jpg`, originalFilename: "synthetic-reference.jpg", fileSize: 123, mimeType: "image/jpeg" }],
  }];
}

async function commit(client, owner, submission, token, requestHash = hash) {
  const result = await client.query(`SELECT * FROM public.commit_order_submission(
    $1::uuid, $2::uuid, $3::text, $4::uuid,
    'Synthetic F3', 'f3@example.invalid', '000000000', NULL::text, 'Synthetic F3 verification', $5::jsonb
  )`, [owner, submission, requestHash, token, JSON.stringify(itemsFor(submission))]);
  return result.rows[0];
}

async function release(client, owner, submission, token) {
  const result = await client.query("SELECT public.release_order_submission($1, $2, $3, 'storage_failure') AS result", [owner, submission, token]);
  return result.rows[0].result;
}

async function expire(client, submission) {
  // Controlled synthetic fixture mutation; no sleeps or browser clocks.
  await client.query("UPDATE public.order_submissions SET lease_expires_at = clock_timestamp() - interval '1 second' WHERE submission_id = $1", [submission]);
}

async function assertWaitingOnLock(observer, blockedPid) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const result = await observer.query("SELECT wait_event_type, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid = $1", [blockedPid]);
    if (result.rows[0]?.wait_event_type === "Lock" && result.rows[0].blockers.length > 0) return;
  }
  assert.fail(`Backend ${blockedPid} did not reach the controlled PostgreSQL lock barrier`);
}

async function assertSingleOrder(observer, submission, orderId) {
  const counts = await observer.query(`SELECT
    (SELECT count(*)::integer FROM public.order_submissions WHERE submission_id = $1 AND status = 'committed' AND order_id = $2) AS submissions,
    (SELECT count(*)::integer FROM public.orders WHERE id = $2) AS orders,
    (SELECT count(*)::integer FROM public.order_items WHERE order_id = $2) AS items,
    (SELECT count(*)::integer FROM public.order_item_reference_files r JOIN public.order_items i ON i.id = r.order_item_id WHERE i.order_id = $2) AS references`, [submission, orderId]);
  assert.deepEqual(counts.rows[0], { submissions: 1, orders: 1, items: 1, references: 1 });
  const deliveries = await observer.query("SELECT delivery_kind, count(*)::integer AS count FROM public.order_email_deliveries WHERE order_id = $1 GROUP BY delivery_kind ORDER BY delivery_kind", [orderId]);
  assert.deepEqual(deliveries.rows, [
    { delivery_kind: "admin_notification", count: 1 },
    { delivery_kind: "client_confirmation", count: 1 },
  ]);
}

test("F3 real PostgreSQL claim, lease, commit and outbox concurrency", { skip: enabled ? false : "Not run: set F3_POSTGRES_BIN_DIR and F3_PG_DRIVER_MODULE for a fresh local PostgreSQL cluster", timeout: 120000 }, async (suite) => {
  const cluster = await startCluster();
  suite.after(() => cluster.stop());
  const observer = await cluster.connect("observer");
  const original = await cluster.connect("original");
  const retry = await cluster.connect("retry");
  const originalPid = (await original.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  const retryPid = (await retry.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  assert.notEqual(originalPid, retryPid);
  suite.diagnostic((await observer.query("SELECT version() AS version")).rows[0].version);
  suite.diagnostic(`Separate PostgreSQL backends: ${originalPid}, ${retryPid}; synthetic cluster: ${cluster.directory}`);
  await installRepositoryContracts(observer);
  const owner = randomUUID();
  const stranger = randomUUID();
  await observer.query("INSERT INTO auth.users(id) VALUES ($1), ($2)", [owner, stranger]);

  await suite.test("active lease refuses retry; released lease reuses original reservation and commits once", async () => {
    const submission = randomUUID();
    const oldToken = randomUUID();
    const newToken = randomUUID();
    const first = await claim(original, owner, submission, oldToken);
    assert.equal(first.result_code, "claimed");
    assert.equal((await claim(retry, owner, submission, newToken)).result_code, "in_progress");
    assert.equal(await release(original, owner, submission, oldToken), "released");
    const state = await observer.query("SELECT status, lease_token, lease_expires_at FROM public.order_submissions WHERE submission_id = $1", [submission]);
    assert.deepEqual(state.rows[0], { status: "processing", lease_token: null, lease_expires_at: null });
    const takeover = await claim(retry, owner, submission, newToken);
    assert.equal(takeover.result_code, "claimed");
    assert.equal(takeover.reserved_order_id, first.reserved_order_id);
    assert.equal(takeover.reserved_order_number, first.reserved_order_number);
    assert.equal(await release(original, owner, submission, oldToken), "not_released");
    assert.equal((await commit(original, owner, submission, oldToken)).result_code, "lease_conflict");
    const created = await commit(retry, owner, submission, newToken);
    assert.equal(created.result_code, "created");
    assert.equal((await commit(original, owner, submission, oldToken)).result_code, "replayed");
    await assertSingleOrder(observer, submission, created.order_id);
  });

  await suite.test("expired lease takeover blocks the stale backend and rejects its old token after takeover commits", async () => {
    const submission = randomUUID();
    const oldToken = randomUUID();
    const newToken = randomUUID();
    await claim(original, owner, submission, oldToken);
    await expire(observer, submission);
    await retry.query("BEGIN");
    assert.equal((await claim(retry, owner, submission, newToken)).result_code, "claimed");
    const staleCommit = commit(original, owner, submission, oldToken);
    await assertWaitingOnLock(observer, originalPid);
    await retry.query("COMMIT");
    assert.equal((await staleCommit).result_code, "lease_conflict");
    assert.equal(await release(original, owner, submission, oldToken), "not_released");
    const lease = await observer.query("SELECT lease_token FROM public.order_submissions WHERE submission_id = $1", [submission]);
    assert.equal(lease.rows[0].lease_token, newToken);
    const created = await commit(retry, owner, submission, newToken);
    assert.equal(created.result_code, "created");
    await assertSingleOrder(observer, submission, created.order_id);
  });

  await suite.test("pre-claim invisible row and overlapping same-ID retry reserve only one order; overlapping commits replay", async () => {
    const submission = randomUUID();
    const token = randomUUID();
    await original.query("BEGIN");
    const first = await claim(original, owner, submission, token);
    // A recovery SELECT sees no row while the first POST's claim is uncommitted.
    assert.equal((await observer.query("SELECT submission_id FROM public.order_submissions WHERE submission_id = $1", [submission])).rowCount, 0);
    const retryClaim = claim(retry, owner, submission, randomUUID());
    await assertWaitingOnLock(observer, retryPid);
    await original.query("COMMIT");
    const blocked = await retryClaim;
    assert.equal(blocked.result_code, "in_progress");
    assert.equal(blocked.reserved_order_id, first.reserved_order_id);
    await original.query("BEGIN");
    const created = await commit(original, owner, submission, token);
    const repeatedCommit = commit(retry, owner, submission, token);
    await assertWaitingOnLock(observer, retryPid);
    await original.query("COMMIT");
    const replayed = await repeatedCommit;
    assert.equal(created.result_code, "created");
    assert.equal(replayed.result_code, "replayed");
    assert.equal(replayed.created, false);
    assert.equal(replayed.order_id, created.order_id);
    assert.equal(replayed.order_number, created.order_number);
    await assertSingleOrder(observer, submission, created.order_id);
  });

  await suite.test("ownership, immutable request hash and pricing conflict survive released lease", async () => {
    const submission = randomUUID();
    const token = randomUUID();
    await claim(original, owner, submission, token);
    await release(original, owner, submission, token);
    const denied = await claim(retry, stranger, submission, randomUUID());
    assert.equal(denied.result_code, "not_found");
    assert.ok(Object.entries(denied).every(([key, value]) => key === "result_code" || value === null));
    assert.equal((await commit(retry, stranger, submission, token)).result_code, "not_found");
    assert.equal((await claim(retry, owner, submission, randomUUID(), { hash: "c".repeat(64) })).result_code, "payload_conflict");
    assert.equal((await claim(retry, owner, submission, randomUUID(), { quoteHash: "d".repeat(64) })).result_code, "pricing_changed");
    const newToken = randomUUID();
    assert.equal((await claim(retry, owner, submission, newToken)).result_code, "claimed");
    assert.equal((await commit(retry, owner, submission, newToken, "c".repeat(64))).result_code, "payload_conflict");
    const created = await commit(retry, owner, submission, newToken);
    const replay = await claim(original, owner, submission, randomUUID());
    assert.equal(replay.result_code, "committed");
    assert.equal(replay.order_id, created.order_id);
    await assertSingleOrder(observer, submission, created.order_id);
  });
});
