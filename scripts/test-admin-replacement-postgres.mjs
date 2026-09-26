/** F8 real PostgreSQL races. Fresh loopback-only cluster; synthetic data only.
 * Uses the existing F3/F5 external native PostgreSQL + pg pattern, independently.
 * Set F8_POSTGRES_BIN_DIR and F8_PG_DRIVER_MODULE to absolute external paths.
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
const runtime = process.env.F8_POSTGRES_BIN_DIR;
const driver = process.env.F8_PG_DRIVER_MODULE;
const migration = "supabase/migrations/20260926155032_f8_atomic_replacement_deliverable_commit.sql";
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
  const directory = await mkdtemp(join(tmpdir(), "picchuspot-f8-postgres-"));
  const dataDirectory = join(directory, "data");
  const username = `f8_${randomUUID().replaceAll("-", "")}`;
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
    const client = new Client({ host: "127.0.0.1", port, user: username, database: "postgres", password: "", ssl: false, application_name: `f8-${name}` });
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
  await client.query(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;
    CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql AS $$ SELECT NULL::text $$;
    CREATE TABLE public.orders(id uuid PRIMARY KEY, order_number text NOT NULL,
      item_count integer NOT NULL, client_email text, status text, updated_at timestamptz DEFAULT now());
    GRANT SELECT ON public.orders TO service_role;
    CREATE FUNCTION public.update_updated_at() RETURNS trigger LANGUAGE plpgsql
      AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;`);
  await client.query(await loadSql("supabase/add-order-deliverables.sql"));
  await client.query(await loadSql("supabase/add-deliverable-reviews.sql"));
  // Exact repository outbox DDL, without installing unrelated order submission RPCs.
  const foundation = await loadSql("supabase/add-atomic-order-submissions.sql");
  const outbox = foundation.match(/CREATE TABLE IF NOT EXISTS public\.order_email_deliveries \([\s\S]*?\n\);/);
  assert.ok(outbox);
  await client.query(outbox[0]);
  await client.query(`ALTER TABLE public.order_email_deliveries ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.order_email_deliveries FROM PUBLIC, anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_email_deliveries TO service_role;`);
  await client.query(await loadSql("supabase/20260909210000_add_order_delivered_email.sql"));
  const before = await catalog(client);
  await client.query(await loadSql(migration));
  await client.query(await loadSql(migration));
  assert.deepEqual(await catalog(client), before, "Protected schema and legacy function unchanged after idempotent install");
}

async function catalog(client) {
  return (await client.query(`SELECT 'constraint' AS kind, conname AS name, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conrelid IN ('public.order_deliverables'::regclass, 'public.deliverable_reviews'::regclass, 'public.order_email_deliveries'::regclass)
    UNION ALL SELECT 'index', indexname, indexdef FROM pg_indexes WHERE tablename IN ('order_deliverables','deliverable_reviews','order_email_deliveries')
    UNION ALL SELECT 'table', relname, relacl::text || '/' || relrowsecurity::text FROM pg_class WHERE oid IN ('public.order_deliverables'::regclass,'public.deliverable_reviews'::regclass,'public.order_email_deliveries'::regclass)
    UNION ALL SELECT 'policy', policyname, coalesce(qual,'') || coalesce(with_check,'') FROM pg_policies WHERE tablename IN ('order_deliverables','deliverable_reviews','order_email_deliveries')
    UNION ALL SELECT 'column', table_name || '.' || column_name, data_type || '/' || coalesce(column_default,'') || '/' || is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('order_deliverables','deliverable_reviews','order_email_deliveries')
    UNION ALL SELECT 'function', proname, pg_get_functiondef(oid) || proacl::text FROM pg_proc WHERE oid='public.attach_replacement_with_email(uuid,uuid)'::regprocedure
    ORDER BY kind,name,definition`)).rows;
}

async function seed(client, status = "rework_requested", item = 0) {
  const orderId = randomUUID(), originalId = randomUUID(), reviewId = randomUUID(), candidateId = randomUUID();
  const orderNumber = `F8-${orderId}`;
  await client.query("INSERT INTO orders(id,order_number,item_count,client_email) VALUES($1,$2,2,'synthetic@example.invalid')", [orderId, orderNumber]);
  await client.query(`INSERT INTO order_deliverables(id,order_id,order_number,item_index,storage_path,filename,file_size,mime_type)
    VALUES($1,$2,$3,$4,'synthetic/original.png','original.png',8,'image/png')`, [originalId, orderId, orderNumber, item]);
  await client.query(`INSERT INTO deliverable_reviews(id,deliverable_id,order_id,order_number,item_index,client_email,status)
    VALUES($1,$2,$3,$4,$5,'synthetic@example.invalid',$6)`, [reviewId, originalId, orderId, orderNumber, item, status]);
  return { reviewId, originalId, orderId, orderNumber, candidateId, item };
}
function candidatePath(f, candidateId = f.candidateId) { return `${f.orderNumber}/rework/${f.reviewId}/${candidateId}-replacement.png`; }
async function commit(client, f, candidateId = f.candidateId, overrides = {}) {
  const p = { reviewId: f.reviewId, candidateId, path: candidatePath(f,candidateId), filename: "replacement.png", size: 8, mime: "image/png", ...overrides };
  return (await client.query("SELECT * FROM public.commit_rework_replacement_upload($1,$2,$3,$4,$5,$6)",
    [p.reviewId,p.candidateId,p.path,p.filename,p.size,p.mime])).rows[0];
}
async function counts(client, f, candidates = [f.candidateId]) {
  return (await client.query(`SELECT
    (SELECT count(*)::int FROM order_deliverables WHERE id=ANY($1::uuid[])) AS deliverables,
    (SELECT count(*)::int FROM order_email_deliveries WHERE order_id=$2 AND delivery_kind=$3) AS events`,
    [candidates,f.orderId,`admin_replacement_ready:${f.reviewId}`])).rows[0];
}
async function waiting(observer, blocked, blocker) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const row = (await observer.query("SELECT wait_event_type, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1", [blocked])).rows[0];
    if (row?.wait_event_type === "Lock" && row.blockers.includes(blocker)) return;
    await new Promise(resolve => setTimeout(resolve,15));
  }
  assert.fail("Expected PostgreSQL review-row lock barrier was not observed");
}

test("F8 native PostgreSQL: atomic replacement registration, idempotency and outbox", { skip: !runtime || !driver, timeout: 90000 }, async t => {
  const cluster = await startCluster();
  try {
    const observer = await cluster.connect("observer"); await install(observer);
    const a = await cluster.connect("first"), b = await cluster.connect("second");
    const pidA = (await a.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    const pidB = (await b.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    assert.notEqual(pidA,pidB);
    t.diagnostic(`PostgreSQL ${(await observer.query("SHOW server_version")).rows[0].server_version}; distinct backends ${pidA}/${pidB}`);
    await a.query("SET ROLE service_role"); await b.query("SET ROLE service_role");

    await t.test("Same candidate serializes on review row and returns the one committed deliverable/event", async () => {
      const f = await seed(observer);
      await a.query("BEGIN"); const first = await commit(a,f); assert.equal(first.result_code,"committed");
      const pending = commit(b,f); await waiting(observer,pidB,pidA); await a.query("COMMIT");
      const second = await pending; assert.equal(second.result_code,"already_committed");
      assert.deepEqual(second.deliverable,first.deliverable);
      assert.deepEqual(await counts(observer,f),{ deliverables:1,events:1 });
      const row = (await observer.query("SELECT status,replacement_deliverable_id FROM deliverable_reviews WHERE id=$1",[f.reviewId])).rows[0];
      assert.deepEqual(row,{ status:"rework_delivered",replacement_deliverable_id:f.candidateId });
      assert.doesNotMatch(JSON.stringify(first),/storage_path|client_email|uploaded_by/);
    });
    await t.test("Different candidates serialize: loser conflicts without inserting a deliverable", async () => {
      const f = await seed(observer), other = randomUUID();
      await a.query("BEGIN"); await commit(a,f);
      const pending = commit(b,f,other); await waiting(observer,pidB,pidA); await a.query("COMMIT");
      assert.equal((await pending).result_code,"conflict");
      assert.deepEqual(await counts(observer,f,[f.candidateId,other]),{ deliverables:1,events:1 });
      assert.equal((await observer.query("SELECT count(*)::int AS n FROM order_deliverables WHERE id=$1",[other])).rows[0].n,0);
    });
    await t.test("Response-loss retry preserves ID, timestamps and one logical event", async () => {
      const f = await seed(observer,"rework_in_progress",null);
      const first = await commit(a,f); const second = await commit(b,f);
      assert.equal(second.result_code,"already_committed"); assert.deepEqual(first.deliverable,second.deliverable);
      assert.equal(first.deliverable.item_index,null);
      const row = (await observer.query("SELECT uploaded_by,expires_at FROM order_deliverables WHERE id=$1",[f.candidateId])).rows[0];
      assert.deepEqual(row,{ uploaded_by:"admin",expires_at:null });
      const event = (await observer.query("SELECT delivery_kind,idempotency_key,status FROM order_email_deliveries WHERE order_id=$1",[f.orderId])).rows[0];
      assert.deepEqual(event,{delivery_kind:`admin_replacement_ready:${f.reviewId}`,idempotency_key:`review-${f.reviewId}-replacement-${f.candidateId}-ready-v1`,status:"pending"});
      assert.deepEqual(await counts(observer,f),{deliverables:1,events:1});
    });
    await t.test("Failure after insertion rolls back candidate, review link and outbox", async () => {
      // Fault injection only in this disposable test database, after both writes.
      await observer.query(`CREATE FUNCTION public.f8_reject_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic outbox failure'; END $$;
        CREATE TRIGGER f8_reject_event BEFORE INSERT ON order_email_deliveries FOR EACH ROW EXECUTE FUNCTION public.f8_reject_event();`);
      const f = await seed(observer);
      await assert.rejects(commit(a,f),{code:"P0001"});
      assert.deepEqual(await counts(observer,f),{deliverables:0,events:0});
      assert.deepEqual((await observer.query("SELECT status,replacement_deliverable_id FROM deliverable_reviews WHERE id=$1",[f.reviewId])).rows[0],
        {status:"rework_requested",replacement_deliverable_id:null});
      await observer.query("DROP TRIGGER f8_reject_event ON order_email_deliveries; DROP FUNCTION public.f8_reject_event();");
      assert.equal((await commit(a,f)).result_code,"committed");
    });
    await t.test("Lifecycle, missing review and original candidate guards never register", async () => {
      for (const status of ["pending_review","approved","resolved","rework_delivered"]) {
        const f = await seed(observer,status);
        assert.equal((await commit(a,f)).result_code,"invalid_state");
        assert.deepEqual(await counts(observer,f),{deliverables:0,events:0});
      }
      const f = await seed(observer);
      assert.equal((await commit(a,f,f.originalId)).result_code,"invalid_candidate");
      assert.equal((await commit(a,f,f.candidateId,{reviewId:randomUUID()})).result_code,"not_found");
      assert.deepEqual(await counts(observer,f),{deliverables:0,events:0});
    });
    await t.test("Wrong order/review paths, invalid size and inconsistent item/order assignments reject", async () => {
      const f = await seed(observer);
      for (const path of ["OTHER/replacement.png",`${f.orderNumber}/rework/${randomUUID()}/${f.candidateId}-replacement.png`,`${candidatePath(f)}/../escape.png`]) {
        assert.equal((await commit(a,f,f.candidateId,{path})).result_code,"invalid_candidate");
      }
      for (const size of [0,209715201,null]) assert.equal((await commit(a,f,f.candidateId,{size})).result_code,"invalid_candidate");
      await observer.query("UPDATE deliverable_reviews SET item_index=1 WHERE id=$1",[f.reviewId]);
      assert.equal((await commit(a,f)).result_code,"invalid_assignment");
      await observer.query("UPDATE deliverable_reviews SET item_index=2 WHERE id=$1",[f.reviewId]);
      await observer.query("UPDATE order_deliverables SET item_index=2 WHERE id=$1",[f.originalId]);
      assert.equal((await commit(a,f)).result_code,"invalid_assignment");
      const other = await seed(observer);
      await observer.query("UPDATE deliverable_reviews SET order_id=$1 WHERE id=$2",[other.orderId,f.reviewId]);
      assert.equal((await commit(a,f)).result_code,"invalid_assignment");
      assert.deepEqual(await counts(observer,f),{deliverables:0,events:0});
    });
    await t.test("Same-ID reconciliation requires exact persisted path and metadata", async () => {
      const f = await seed(observer); await commit(a,f);
      for (const changes of [{filename:"different.png"},{size:9},{mime:"image/jpeg"},{path:candidatePath(f).replace("replacement.png","other.png")}]) {
        assert.equal((await commit(b,f,f.candidateId,changes)).result_code,"conflict");
      }
      await observer.query("UPDATE order_deliverables SET item_index=1 WHERE id=$1",[f.candidateId]);
      assert.equal((await commit(b,f)).result_code,"conflict");
      assert.deepEqual(await counts(observer,f),{deliverables:1,events:1});
    });
    await t.test("An existing candidate UUID is never overwritten or reattached", async () => {
      const first = await seed(observer); await commit(a,first);
      const second = await seed(observer);
      assert.equal((await commit(b,second,first.candidateId)).result_code,"conflict");
      assert.deepEqual(await counts(observer,second),{deliverables:0,events:0});
      assert.equal((await observer.query("SELECT order_id FROM order_deliverables WHERE id=$1",[first.candidateId])).rows[0].order_id,first.orderId);
    });
    await t.test("Legacy function still attaches an already registered deliverable", async () => {
      const f = await seed(observer);
      await observer.query(`INSERT INTO order_deliverables(id,order_id,order_number,item_index,storage_path,filename,file_size,mime_type)
        VALUES($1,$2,$3,0,$4,'replacement.png',8,'image/png')`,[f.candidateId,f.orderId,f.orderNumber,candidatePath(f)]);
      const result = await a.query("SELECT * FROM attach_replacement_with_email($1,$2)",[f.reviewId,f.candidateId]);
      assert.equal(result.rows.length,1); assert.deepEqual(await counts(observer,f),{deliverables:1,events:1});
    });
    await t.test("Invoker RPC denies PUBLIC/anon/authenticated and grants service_role only", async () => {
      const row = (await observer.query(`SELECT prosecdef,proconfig,
        has_function_privilege('anon',oid,'EXECUTE') AS anon,has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated,
        has_function_privilege('service_role',oid,'EXECUTE') AS service_role,
        EXISTS(SELECT 1 FROM aclexplode(proacl) WHERE grantee=0 AND privilege_type='EXECUTE') AS public
        FROM pg_proc WHERE oid='public.commit_rework_replacement_upload(uuid,uuid,text,text,bigint,text)'::regprocedure`)).rows[0];
      assert.deepEqual(row,{prosecdef:false,proconfig:["search_path=pg_catalog, public"],anon:false,authenticated:false,service_role:true,public:false});
      const f = await seed(observer);
      for (const role of ["anon","authenticated"]) {
        await b.query(`SET ROLE ${role}`); await assert.rejects(commit(b,f),{code:"42501"});
      }
      await b.query("SET ROLE service_role"); assert.equal((await commit(b,f)).result_code,"committed");
    });
  } finally { await cluster.stop(); }
});
