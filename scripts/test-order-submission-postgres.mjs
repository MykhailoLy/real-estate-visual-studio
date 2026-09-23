/**
 * Opt-in real PostgreSQL concurrency regression and F5 migration red -> green.
 * No production connection exists. Baseline assertions reproduce the blocker,
 * then the exact forward migration must permit new immutable draft attempts.
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
const f5Migration = "supabase/migrations/20260923143459_allow_multiple_draft_submission_attempts.sql";
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
  // Manifest authority: this supplies the current four-service claim and commit.
  // Execute the repository functions unchanged, never a hand-copied algorithm.
  await client.query(await loadSql("supabase/allow-floor-plan-draft-finalization.sql"));
  await client.query(await loadSql("supabase/add-welcome-offer-redemptions.sql"));
  await client.query(await loadSql("supabase/fix-welcome-offer-rpc-coalesce.sql"));
}

async function claim(client, owner, submission, token, overrides = {}) {
  const pricing = overrides.snapshot ?? snapshot;
  const result = await client.query(`SELECT * FROM public.claim_order_submission(
    $1::uuid, $2::uuid, $3::text, 1::smallint, $9::text, $10::uuid,
    $4::uuid, $11::text, $5::text, $6::text, $7::integer, $8::jsonb
  )`, [owner, submission, overrides.hash ?? hash, token, pricing.pricingVersion, overrides.quoteHash ?? quoteHash, pricing.totalCents, JSON.stringify(pricing), pricing.serviceType, overrides.sourceDraftId ?? null, pricing.currency]);
  return result.rows[0];
}

function itemsFor(submission, subtotalCents = 1500) {
  return [{
    itemIndex: 0,
    originalPhotoPath: `f3-synthetic/${submission}/original.jpg`,
    referenceImagePath: `f3-synthetic/${submission}/reference.jpg`,
    subtotalCents,
    details: { synthetic: true },
    references: [{ referenceId: "44444444-4444-4444-8444-444444444444", position: 0, bucket: "order-files", storagePath: `f3-synthetic/${submission}/reference.jpg`, originalFilename: "synthetic-reference.jpg", fileSize: 123, mimeType: "image/jpeg" }],
  }];
}

async function commit(client, owner, submission, token, requestHash = hash, draft = null) {
  const welcome = draft?.welcomeBenefitKeys !== undefined;
  const rpc = welcome ? "commit_order_submission_with_welcome_offer_v1" : "commit_order_submission";
  const args = [owner, submission, requestHash, token, JSON.stringify(draft?.items ?? itemsFor(submission)), draft?.version ?? null, draft?.key ?? null, draft ? JSON.stringify(draft.movedFiles ?? []) : null];
  if (welcome) args.push(draft.welcomeBenefitKeys);
  const result = await client.query(`SELECT * FROM public.${rpc}(
    $1::uuid, $2::uuid, $3::text, $4::uuid,
    'Synthetic F3', 'f3@example.invalid', '000000000', NULL::text, 'Synthetic F3 verification', $5::jsonb,
    $6::integer, $7::uuid, $8::jsonb${welcome ? ", $9::text[]" : ""}
  )`, args);
  return result.rows[0];
}

async function createDraft(client, owner, service = "virtual-staging") {
  const draftId = randomUUID();
  await client.query(`INSERT INTO public.order_drafts
    (id, user_id, service_type, route, currency, title, state)
    VALUES ($1, $2, $3, $4, 'USD', 'Before edit', '{"instructions":"Before edit"}')`, [draftId, owner, service, `/dashboard/orders/new/${service}`]);
  return draftId;
}

async function claimDraft(client, owner, draftId, key, version = 1) {
  const result = await client.query("SELECT * FROM public.claim_order_draft_finalization($1, $2, $3, $4)", [owner, draftId, version, key]);
  return result.rows[0];
}

async function releaseDraft(client, owner, draftId, key) {
  const result = await client.query("SELECT * FROM public.release_order_draft_finalization($1, $2, $3)", [owner, draftId, key]);
  return result.rows[0].result_code;
}

async function editDraft(client, owner, draftId) {
  const result = await client.query(`UPDATE public.order_drafts
    SET title = 'After edit', state = '{"instructions":"After edit"}', version = version + 1
    WHERE id = $1 AND user_id = $2 AND status = 'active' AND version = 1 RETURNING version`, [draftId, owner]);
  assert.equal(result.rows[0]?.version, 2);
}

async function immutableSubmission(client, submission) {
  const result = await client.query(`SELECT request_hash, pricing_version, quote_hash, currency,
    estimated_total_cents, pricing_snapshot, source_draft_id, reserved_order_id, reserved_order_number
    FROM public.order_submissions WHERE submission_id = $1`, [submission]);
  return result.rows[0];
}

async function addDraftFiles(client, owner, draftId, submission) {
  const itemId = randomUUID();
  const fileId = randomUUID();
  const referenceId = randomUUID();
  const originalPath = `drafts/${owner}/${draftId}/${fileId}/original.jpg`;
  const referencePath = `drafts/${owner}/${draftId}/${referenceId}/reference.jpg`;
  await client.query(`INSERT INTO public.order_draft_files
    (id, draft_id, item_client_id, item_index, kind, storage_path, original_filename, file_size, mime_type)
    VALUES ($1, $2, $3, 0, 'original', $4, 'original.jpg', 123, 'image/jpeg')`, [fileId, draftId, itemId, originalPath]);
  await client.query(`INSERT INTO public.order_draft_item_reference_files
    (draft_id, item_client_id, item_index, reference_id, position, storage_path, original_filename, file_size, mime_type)
    VALUES ($1, $2, 0, $3, 0, $4, 'reference.jpg', 123, 'image/jpeg')`, [draftId, itemId, referenceId, referencePath]);
  const items = itemsFor(submission);
  items[0].references[0].referenceId = referenceId;
  return { items, movedFiles: [{ fileId, finalPath: items[0].originalPhotoPath }] };
}

async function protectedCatalog(client) {
  return (await client.query(`SELECT 'constraint' AS kind, conname AS name, pg_get_constraintdef(oid) AS definition, NULL::text AS privileges
      FROM pg_constraint WHERE conrelid IN ('public.order_submissions'::regclass, 'public.orders'::regclass)
    UNION ALL SELECT 'index', indexname, indexdef, NULL FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN ('order_submissions', 'orders')
        AND indexname NOT IN ('order_submissions_source_draft_unique', 'idx_order_submissions_source_draft')
    UNION ALL SELECT 'function', proname, pg_get_functiondef(oid), proacl::text FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace AND proname IN
        ('claim_order_submission', 'commit_order_submission', 'commit_order_submission_with_welcome_offer_v1',
         'release_order_submission', 'claim_order_draft_finalization', 'release_order_draft_finalization')
    UNION ALL SELECT 'table', relname, relrowsecurity::text || '/' || relforcerowsecurity::text, relacl::text
      FROM pg_class WHERE oid IN ('public.order_submissions'::regclass, 'public.orders'::regclass)
    ORDER BY kind, name, definition`)).rows;
}

async function storedRows(client) {
  return (await client.query(`SELECT 'submission' AS kind, submission_id::text AS id, to_jsonb(submissions) AS row
      FROM public.order_submissions AS submissions
    UNION ALL SELECT 'order', id::text, to_jsonb(orders) FROM public.orders AS orders
    ORDER BY kind, id`)).rows;
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

test("F3/F5 real PostgreSQL migration, claim, lease, commit and outbox concurrency", { skip: enabled ? false : "Not run: set F3_POSTGRES_BIN_DIR and F3_PG_DRIVER_MODULE for a fresh local PostgreSQL cluster", timeout: 120000 }, async (suite) => {
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
  let historicalAttempt;
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

  await suite.test("F5 RED before migration: historical draft-ID submission rejects edited payload, new pricing, and a new attempt ID", async (scenario) => {
    const draftId = await createDraft(observer, owner);
    const oldKey = randomUUID();
    const newKey = randomUUID();
    const oldToken = randomUUID();
    assert.equal((await claimDraft(original, owner, draftId, oldKey)).result_code, "claimed");
    assert.equal((await claim(original, owner, draftId, oldToken, { sourceDraftId: draftId })).result_code, "claimed");
    const historical = await immutableSubmission(observer, draftId);
    assert.equal(await release(original, owner, draftId, oldToken), "released");
    assert.equal(await releaseDraft(original, owner, draftId, oldKey), "released");
    assert.equal((await observer.query("SELECT count(*)::integer AS count FROM public.orders WHERE source_draft_id = $1", [draftId])).rows[0].count, 0);
    await editDraft(observer, owner, draftId);
    assert.equal((await claimDraft(retry, owner, draftId, newKey, 2)).result_code, "claimed");

    assert.equal((await claim(retry, owner, draftId, randomUUID(), { sourceDraftId: draftId, hash: "c".repeat(64) })).result_code, "payload_conflict");
    const reviewedPricing = { ...snapshot, pricingVersion: "f5-synthetic-v2", totalCents: 1800, items: [{ lineSubtotalCents: 1800 }] };
    assert.equal((await claim(retry, owner, draftId, randomUUID(), { sourceDraftId: draftId, quoteHash: "d".repeat(64), snapshot: reviewedPricing })).result_code, "pricing_changed");
    await assert.rejects(
      claim(retry, owner, newKey, randomUUID(), { sourceDraftId: draftId, hash: "c".repeat(64), quoteHash: "d".repeat(64), snapshot: reviewedPricing }),
      { code: "23505", constraint: "order_submissions_source_draft_unique" },
    );
    assert.deepEqual(await immutableSubmission(observer, draftId), historical);
    assert.equal((await observer.query("SELECT count(*)::integer AS count FROM public.order_submissions WHERE source_draft_id = $1", [draftId])).rows[0].count, 1);
    assert.equal((await observer.query("SELECT count(*)::integer AS count FROM public.orders WHERE source_draft_id = $1", [draftId])).rows[0].count, 0);
    assert.equal(await releaseDraft(retry, owner, draftId, newKey), "released");
    historicalAttempt = { draftId, newKey, historical, reviewedPricing };
    scenario.diagnostic("Before migration RED: payload_conflict / pricing_changed for draftId, and K2 raises SQLSTATE 23505 on order_submissions_source_draft_unique.");
  });

  await suite.test("F5 migration fails closed for missing order uniqueness or wrong lookup index; applying twice preserves rows and protected catalog", async (scenario) => {
    const migration = await loadSql(f5Migration);
    const catalogBefore = await protectedCatalog(observer);
    const rowsBefore = await storedRows(observer);
    // These isolated negative fixtures are rolled back, including the unchanged
    // migration's own BEGIN on the already-open transaction. No schema bypass.
    await original.query("BEGIN");
    await original.query("DROP INDEX public.orders_source_draft_id_unique");
    await assert.rejects(original.query(migration), /required order uniqueness index is missing/);
    await original.query("ROLLBACK");
    await original.query("BEGIN");
    await original.query("CREATE INDEX idx_order_submissions_source_draft ON public.order_submissions (submission_id)");
    await assert.rejects(original.query(migration), /unexpected definition for index idx_order_submissions_source_draft/);
    await original.query("ROLLBACK");
    assert.deepEqual(await protectedCatalog(observer), catalogBefore);
    for (let run = 0; run < 2; run += 1) {
      await observer.query(migration);
      assert.deepEqual(await storedRows(observer), rowsBefore);
      assert.deepEqual(await protectedCatalog(observer), catalogBefore);
    }
    const indexes = await observer.query(`SELECT c.relname, i.indisunique, i.indisvalid,
      pg_get_expr(i.indpred, i.indrelid) AS predicate
      FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
      WHERE c.relnamespace = 'public'::regnamespace AND c.relname IN
        ('order_submissions_source_draft_unique', 'idx_order_submissions_source_draft', 'orders_source_draft_id_unique')
      ORDER BY c.relname`);
    assert.deepEqual(indexes.rows, [
      { relname: "idx_order_submissions_source_draft", indisunique: false, indisvalid: true, predicate: "(source_draft_id IS NOT NULL)" },
      { relname: "orders_source_draft_id_unique", indisunique: true, indisvalid: true, predicate: "(source_draft_id IS NOT NULL)" },
    ]);
    scenario.diagnostic(`Executed ${f5Migration} twice in the disposable cluster only; rows, other indexes, constraints, RLS, grants and RPC bodies unchanged.`);
  });

  await suite.test("F5 GREEN: historical draft-ID row coexists unchanged with K2 current pricing; unchanged K2 retries commit one edited draft order", async (scenario) => {
    assert.ok(historicalAttempt);
    const { draftId, newKey, historical, reviewedPricing } = historicalAttempt;
    const token = randomUUID();
    assert.equal((await claimDraft(retry, owner, draftId, newKey, 2)).result_code, "claimed");
    const options = { sourceDraftId: draftId, hash: "c".repeat(64), quoteHash: "d".repeat(64), snapshot: reviewedPricing };
    const reservation = await claim(retry, owner, newKey, token, options);
    assert.equal(reservation.result_code, "claimed");
    assert.equal((await claim(original, owner, newKey, randomUUID(), options)).result_code, "in_progress");
    assert.equal(await release(retry, owner, newKey, token), "released");
    const retryToken = randomUUID();
    const replayedClaim = await claim(original, owner, newKey, retryToken, options);
    assert.equal(replayedClaim.result_code, "claimed");
    assert.equal(replayedClaim.reserved_order_id, reservation.reserved_order_id);
    assert.equal(replayedClaim.reserved_order_number, reservation.reserved_order_number);
    const files = await addDraftFiles(observer, owner, draftId, newKey);
    files.items[0].subtotalCents = reviewedPricing.totalCents;
    const created = await commit(original, owner, newKey, retryToken, options.hash, { version: 2, key: newKey, ...files });
    assert.equal(created.result_code, "created");
    assert.equal(created.estimated_total_cents, 1800);
    assert.deepEqual(created.pricing_snapshot, reviewedPricing);
    assert.deepEqual(await immutableSubmission(observer, draftId), historical);
    const attempts = await observer.query("SELECT submission_id, status FROM public.order_submissions WHERE source_draft_id = $1 ORDER BY status", [draftId]);
    assert.deepEqual(attempts.rows, [{ submission_id: newKey, status: "committed" }, { submission_id: draftId, status: "processing" }]);
    assert.equal((await observer.query("SELECT upload_status FROM public.order_draft_files WHERE draft_id = $1", [draftId])).rows[0].upload_status, "moved");
    assert.equal((await observer.query("SELECT upload_status FROM public.order_draft_item_reference_files WHERE draft_id = $1", [draftId])).rows[0].upload_status, "deleted");
    await assertSingleOrder(observer, newKey, created.order_id);
    await assert.rejects(observer.query(`INSERT INTO public.orders
      SELECT (jsonb_populate_record(NULL::public.orders, to_jsonb(o) ||
        jsonb_build_object('id', $2::uuid, 'order_number', $3::text))).*
      FROM public.orders AS o WHERE o.id = $1`, [created.order_id, randomUUID(), `f5-duplicate-${randomUUID()}`]),
    { code: "23505", constraint: "orders_source_draft_id_unique" });
    assert.equal((await observer.query("SELECT count(*)::integer AS count FROM public.orders WHERE source_draft_id = $1", [draftId])).rows[0].count, 1);
    scenario.diagnostic("After migration GREEN: K2 stores the new 1800-cent quote beside historical 1500-cent draftId snapshot; direct duplicate order INSERT is rejected by orders_source_draft_id_unique.");
  });

  await suite.test("F5 GREEN concurrency: stale K1 waits for K2 takeover, fails closed, and only K2 commits", async (scenario) => {
    const draftId = await createDraft(observer, owner);
    const oldKey = randomUUID();
    const newKey = randomUUID();
    const oldToken = randomUUID();
    assert.equal((await claimDraft(original, owner, draftId, oldKey)).result_code, "claimed");
    assert.equal((await claim(original, owner, oldKey, oldToken, { sourceDraftId: draftId })).result_code, "claimed");
    // Exercise the draft guard independently of the submission lease guard:
    // an abandoned handler can still hold a live submission lease after release.
    assert.equal(await releaseDraft(original, owner, draftId, oldKey), "released");
    await editDraft(observer, owner, draftId);
    await retry.query("BEGIN");
    assert.equal((await claimDraft(retry, owner, draftId, newKey, 2)).result_code, "claimed");
    const newToken = randomUUID();
    assert.equal((await claim(retry, owner, newKey, newToken, { sourceDraftId: draftId, hash: "c".repeat(64) })).result_code, "claimed");
    const staleCommit = commit(original, owner, oldKey, oldToken, hash, { version: 1, key: oldKey });
    await assertWaitingOnLock(observer, originalPid);
    await retry.query("COMMIT");
    assert.equal((await staleCommit).result_code, "draft_conflict");
    // Version, key and verified owner remain separate fail-closed checks.
    assert.equal((await commit(original, owner, oldKey, oldToken, hash, { version: 2, key: oldKey })).result_code, "draft_conflict");
    assert.equal((await commit(original, owner, oldKey, oldToken, hash, { version: 1, key: newKey })).result_code, "draft_conflict");
    assert.equal((await commit(original, stranger, oldKey, oldToken, hash, { version: 2, key: newKey })).result_code, "not_found");
    assert.equal(await releaseDraft(original, owner, draftId, oldKey), "finalization_conflict");
    assert.equal(await release(original, owner, oldKey, oldToken), "released");
    const created = await commit(retry, owner, newKey, newToken, "c".repeat(64), { version: 2, key: newKey });
    assert.equal(created.result_code, "created");
    assert.equal((await observer.query("SELECT count(*)::integer AS count FROM public.orders WHERE source_draft_id = $1", [draftId])).rows[0].count, 1);
    assert.equal((await observer.query("SELECT count(*)::integer AS count FROM public.order_submissions WHERE source_draft_id = $1", [draftId])).rows[0].count, 2);
    await assertSingleOrder(observer, newKey, created.order_id);
    scenario.diagnostic("Separate backend lock barrier: stale K1 draft_conflict; K2 created; one order/item/reference and one outbox row per kind.");
  });

  await suite.test("F5 retained guarantees: unchanged same-attempt retry, overlapping commit replay, and source-draft reconciliation create one order", async () => {
    const draftId = await createDraft(observer, owner);
    const key = randomUUID();
    const token = randomUUID();
    assert.equal((await claimDraft(original, owner, draftId, key)).result_code, "claimed");
    const reservation = await claim(original, owner, key, token, { sourceDraftId: draftId });
    assert.equal(reservation.result_code, "claimed");
    assert.equal(await release(original, owner, key, token), "released");
    assert.equal(await releaseDraft(original, owner, draftId, key), "released");
    assert.equal((await claimDraft(retry, owner, draftId, key)).result_code, "claimed");
    const retryToken = randomUUID();
    const sameAttempt = await claim(retry, owner, key, retryToken, { sourceDraftId: draftId });
    assert.equal(sameAttempt.result_code, "claimed");
    assert.equal(sameAttempt.reserved_order_id, reservation.reserved_order_id);
    assert.equal(sameAttempt.reserved_order_number, reservation.reserved_order_number);

    await retry.query("BEGIN");
    const created = await commit(retry, owner, key, retryToken, hash, { version: 1, key });
    assert.equal(created.result_code, "created");
    const replayPromise = commit(original, owner, key, retryToken, hash, { version: 1, key });
    await assertWaitingOnLock(observer, originalPid);
    await retry.query("COMMIT");
    const replay = await replayPromise;
    assert.equal(replay.result_code, "replayed");
    assert.equal(replay.order_id, created.order_id);
    assert.equal((await claimDraft(original, owner, draftId, randomUUID())).converted_order_id, created.order_id);

    // Current commit converts the draft atomically. Seed only the historical
    // interrupted-completion shape to exercise the supported reconciliation RPC.
    await observer.query("UPDATE public.order_drafts SET status = 'converting', converted_order_id = NULL, converted_at = NULL, finalization_key = $2 WHERE id = $1", [draftId, key]);
    const reconciled = await claimDraft(original, owner, draftId, randomUUID());
    assert.equal(reconciled.result_code, "already_claimed");
    assert.equal(reconciled.converted_order_id, created.order_id);
    assert.equal(await releaseDraft(original, owner, draftId, key), "order_exists");
    assert.equal((await observer.query("SELECT count(*)::integer AS count FROM public.orders WHERE source_draft_id = $1", [draftId])).rows[0].count, 1);
    await assertSingleOrder(observer, key, created.order_id);
  });

  for (const service of ["virtual-staging", "photo-editing", "virtual-renovation", "3d-floor-plans"]) {
    await suite.test(`F5 ${service}: released K1 snapshot retained; edited version 2 commits only through K2`, async () => {
      const draftId = await createDraft(observer, owner, service);
      const key1 = randomUUID();
      const token1 = randomUUID();
      const servicePricing = { ...snapshot, serviceType: service };
      const source = { sourceDraftId: draftId, snapshot: servicePricing };
      assert.equal((await claimDraft(original, owner, draftId, key1)).result_code, "claimed");
      assert.equal((await claim(original, owner, key1, token1, source)).result_code, "claimed");
      assert.equal(await release(original, owner, key1, token1), "released");
      assert.equal(await releaseDraft(original, owner, draftId, key1), "released");
      const historical = await immutableSubmission(observer, key1);
      await editDraft(observer, owner, draftId);
      const key2 = randomUUID();
      const token2 = randomUUID();
      assert.equal((await claimDraft(retry, stranger, draftId, key2, 2)).result_code, "not_found");
      assert.equal((await claimDraft(retry, owner, draftId, key2, 1)).result_code, "version_conflict");
      assert.equal((await claimDraft(retry, owner, draftId, key2, 2)).result_code, "claimed");
      assert.equal((await claim(retry, owner, key2, token2, { ...source, hash: "c".repeat(64) })).result_code, "claimed");
      const files = await addDraftFiles(observer, owner, draftId, key2);
      const created = await commit(retry, owner, key2, token2, "c".repeat(64), { version: 2, key: key2, ...files });
      assert.equal(created.result_code, "created");
      assert.equal(created.pricing_snapshot.serviceType, service);
      assert.deepEqual(await immutableSubmission(observer, key1), historical);
      assert.equal((await claimDraft(original, owner, draftId, key1, 1)).converted_order_id, created.order_id);
      await assertSingleOrder(observer, key2, created.order_id);
    });
  }

  await suite.test("F5 Welcome wrapper: same-key redemption replay; conflict deletes only the current loser; historical attempts survive repricing", async () => {
    const welcomeOwner = randomUUID();
    await observer.query("INSERT INTO auth.users(id) VALUES ($1)", [welcomeOwner]);
    const benefitKeys = ["virtual-staging-first-image-50"];
    const welcomePricing = {
      ...snapshot,
      welcomeDiscountCents: 1500,
      welcomeOffer: { version: "2026-08-29", totalDiscountCents: 1500, benefits: [{ key: benefitKeys[0], itemIndex: 0, priceKey: "virtual-staging", discountPercent: 50, discountCents: 1500 }] },
      items: [{ priceKey: "virtual-staging", baseSubtotalCents: 3000, lineSubtotalCents: 1500 }],
    };
    const winnerDraft = await createDraft(observer, welcomeOwner);
    const winnerKey = randomUUID();
    const winnerToken = randomUUID();
    assert.equal((await claimDraft(original, welcomeOwner, winnerDraft, winnerKey)).result_code, "claimed");
    assert.equal((await claim(original, welcomeOwner, winnerKey, winnerToken, { sourceDraftId: winnerDraft, snapshot: welcomePricing })).result_code, "claimed");
    const winner = await commit(original, welcomeOwner, winnerKey, winnerToken, hash, { version: 1, key: winnerKey, welcomeBenefitKeys: benefitKeys });
    assert.equal(winner.result_code, "created");
    const winnerSnapshot = await immutableSubmission(observer, winnerKey);
    const replay = await commit(retry, welcomeOwner, winnerKey, randomUUID(), hash, { version: 1, key: winnerKey, welcomeBenefitKeys: benefitKeys });
    assert.equal(replay.result_code, "replayed");
    assert.equal(replay.order_id, winner.order_id);
    assert.deepEqual(replay.pricing_snapshot, welcomePricing);
    await assertSingleOrder(observer, winnerKey, winner.order_id);

    const loserDraft = await createDraft(observer, welcomeOwner);
    const historicalKey = randomUUID();
    const historicalToken = randomUUID();
    assert.equal((await claimDraft(original, welcomeOwner, loserDraft, historicalKey)).result_code, "claimed");
    assert.equal((await claim(original, welcomeOwner, loserDraft, historicalToken, { sourceDraftId: loserDraft, snapshot: welcomePricing })).result_code, "claimed");
    assert.equal(await release(original, welcomeOwner, loserDraft, historicalToken), "released");
    assert.equal(await releaseDraft(original, welcomeOwner, loserDraft, historicalKey), "released");
    const historical = await immutableSubmission(observer, loserDraft);
    await editDraft(observer, welcomeOwner, loserDraft);
    const loserKey = randomUUID();
    const loserToken = randomUUID();
    assert.equal((await claimDraft(retry, welcomeOwner, loserDraft, loserKey, 2)).result_code, "claimed");
    assert.equal((await claim(retry, welcomeOwner, loserKey, loserToken, { sourceDraftId: loserDraft, snapshot: welcomePricing, hash: "c".repeat(64) })).result_code, "claimed");
    const loser = await commit(retry, welcomeOwner, loserKey, loserToken, "c".repeat(64), { version: 2, key: loserKey, welcomeBenefitKeys: benefitKeys });
    assert.equal(loser.result_code, "welcome_offer_conflict");
    assert.equal((await observer.query("SELECT submission_id FROM public.order_submissions WHERE submission_id = $1", [loserKey])).rowCount, 0);
    assert.deepEqual(await immutableSubmission(observer, loserDraft), historical);
    assert.deepEqual(await immutableSubmission(observer, winnerKey), winnerSnapshot);
    assert.equal(await releaseDraft(retry, welcomeOwner, loserDraft, loserKey), "released");

    const reviewedPricing = { ...welcomePricing, totalCents: 3000, welcomeDiscountCents: 0, welcomeOffer: { version: "2026-08-29", totalDiscountCents: 0, benefits: [] }, items: [{ priceKey: "virtual-staging", baseSubtotalCents: 3000, lineSubtotalCents: 3000 }] };
    const reviewedKey = randomUUID();
    const reviewedToken = randomUUID();
    assert.equal((await claimDraft(retry, welcomeOwner, loserDraft, reviewedKey, 2)).result_code, "claimed");
    assert.equal((await claim(retry, welcomeOwner, reviewedKey, reviewedToken, { sourceDraftId: loserDraft, snapshot: reviewedPricing, hash: "c".repeat(64), quoteHash: "d".repeat(64) })).result_code, "claimed");
    const created = await commit(retry, welcomeOwner, reviewedKey, reviewedToken, "c".repeat(64), { version: 2, key: reviewedKey, items: itemsFor(reviewedKey, 3000), welcomeBenefitKeys: [] });
    assert.equal(created.result_code, "created");
    assert.deepEqual(created.pricing_snapshot, reviewedPricing);
    assert.deepEqual(await immutableSubmission(observer, loserDraft), historical);
    const redemptions = await observer.query("SELECT benefit_key, order_id FROM public.welcome_offer_redemptions WHERE user_id = $1", [welcomeOwner]);
    assert.deepEqual(redemptions.rows, [{ benefit_key: benefitKeys[0], order_id: winner.order_id }]);
    await assertSingleOrder(observer, reviewedKey, created.order_id);
  });
});
