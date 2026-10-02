// Isolated loopback PostgreSQL only. No production URL or credentials accepted.
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
const runtime = process.env.DELETION_POSTGRES_BIN_DIR;
const driver = process.env.DELETION_PG_DRIVER_MODULE;
const enabled = Boolean(runtime && driver);
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
  const directory = await mkdtemp(join(tmpdir(), "picchuspot-deletion-postgres-"));
  const dataDirectory = join(directory, "data");
  const username = `deletion_${randomUUID().replaceAll("-", "")}`;
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
    const client = new Client({ host: "127.0.0.1", port, user: username, database: "postgres", password: "", ssl: false, application_name: `deletion-${name}` });
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

test('deletion transaction, immutable ownership, lockout, TTL claims and FK retention', { skip: !enabled }, async () => {
  const cluster = await startCluster();
  try {
    const db = await cluster.connect('control');
    const other = await cluster.connect('parallel');
    await db.query(await loadSql('scripts/fixtures/order-submission-postgres.sql'));
    await db.query(`ALTER TABLE auth.users ADD email text, ADD email_confirmed_at timestamptz, ADD is_anonymous boolean DEFAULT false;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE SCHEMA storage;
      CREATE TABLE storage.objects(id uuid, owner uuid, owner_id text);`);
    await db.query(await loadSql('supabase/schema.sql'));
    await db.query(await loadSql('supabase/add-order-drafts.sql'));
    await db.query(await loadSql('supabase/add-client-profiles.sql'));
    await db.query(await loadSql('supabase/20260912110000_add_client_order_reviews.sql'));
    await db.query(`CREATE TABLE public.order_submissions(submission_id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users ON DELETE SET NULL, status text, lease_expires_at timestamptz);
      CREATE TABLE public.account_pricing(user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE);
      CREATE TABLE public.welcome_offer_redemptions(user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE);
      GRANT SELECT ON public.orders, public.client_profiles TO authenticated;
      GRANT INSERT, UPDATE ON public.client_profiles TO authenticated;`);
    const sql = await loadSql('supabase/migrations/20261002095908_client_account_deletion.sql');
    await db.query(sql); await db.query(sql); // Exact rerun is safe.
    const user = randomUUID(), stranger = randomUUID(), replacement = randomUUID();
    await db.query(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ($1,'Client@example.com',now()),($2,'other@example.com',now())`, [user,stranger]);
    await db.query(`INSERT INTO client_profiles(user_id,full_name) VALUES ($1,'Client'),($2,'Other');
    `, [user,stranger]);
    await db.query(`INSERT INTO account_pricing VALUES ($1);`, [user]);
    await db.query(`INSERT INTO welcome_offer_redemptions VALUES ($1);`, [user]);
    const insertOrder = async (client, id, owner, email, number) => client.query(`INSERT INTO orders
      (id,order_number,service_type,status,client_name,client_email,client_phone,item_count,estimated_total_cents,currency,user_id)
      VALUES ($1,$2,'virtual-staging','delivered','Snapshot Name',$3,'historic-phone',1,5000,'USD',$4)`, [id,number,email,owner]);
    const owned = randomUUID(), legacy = randomUUID(), foreign = randomUUID(), genuineLegacy = randomUUID();
    await insertOrder(db,owned,user,'old-address@example.com','VS-OWNED');
    await insertOrder(db,legacy,null,' Client@example.com ','VS-LEGACY');
    await insertOrder(db,foreign,stranger,'Client@example.com','VS-OTHER');
    await insertOrder(db,genuineLegacy,null,'untouched@example.com','VS-GENUINE');
    await db.query('SET ROLE authenticated');
    await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [user]);
    assert.equal((await db.query('SELECT * FROM orders')).rowCount, 1);
    await assert.rejects(db.query(`SELECT public.request_client_account_deletion($1,'Client@example.com')`, [user]), /permission denied/);
    await db.query('RESET ROLE');
    await assert.rejects(db.query(`SELECT public.request_client_account_deletion($1,'client@example.com')`, [user]), /identity/);
    assert.equal((await db.query('SELECT * FROM account_deletion_requests')).rowCount, 0);

    // Observe an actual lock barrier: deletion cannot miss a concurrent order
    // whose transaction passed the account guard before deletion acquired it.
    await other.query('BEGIN');
    const racingOrder = randomUUID();
    await insertOrder(other,racingOrder,user,'Client@example.com','VS-RACE');
    const pending = db.query(`SELECT public.request_client_account_deletion($1,'Client@example.com')`, [user]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const locks = await other.query(`SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted`);
    assert.ok(locks.rows[0].n >= 1);
    await other.query('COMMIT'); await pending;
    await db.query(`SELECT public.request_client_account_deletion($1,'Client@example.com')`, [user]);
    assert.equal((await db.query('SELECT * FROM account_deletion_requests')).rowCount, 1);
    const marked = (await db.query('SELECT id FROM orders WHERE account_deleted_at IS NOT NULL')).rows.map((r)=>r.id).sort();
    assert.deepEqual(marked,[owned,legacy,racingOrder].sort());
    assert.equal((await db.query('SELECT user_id FROM orders WHERE id=$1',[legacy])).rows[0].user_id,user);
    assert.equal((await db.query(`SELECT outcome FROM create_client_order_review($1,$2,'Client@example.com',5::smallint)`,[owned,user])).rows[0].outcome,'not_found');
    await assert.rejects(insertOrder(db,randomUUID(),user,'Client@example.com','VS-BLOCKED'), /unavailable/);
    await assert.rejects(db.query('UPDATE orders SET account_deleted_at=NULL WHERE id=$1',[owned]), /immutable/);
    await assert.rejects(db.query('UPDATE orders SET user_id=$1 WHERE id=$2',[stranger,legacy]), /immutable/);
    await db.query(`SET ROLE authenticated`);
    assert.equal((await db.query('SELECT * FROM orders')).rowCount, 0);
    assert.equal((await db.query('SELECT * FROM client_profiles')).rowCount, 0);
    await assert.rejects(db.query(`INSERT INTO client_profiles(user_id,full_name) VALUES ($1,'blocked')`,[user]), /row-level security/);
    await db.query('RESET ROLE');
    const token = randomUUID();
    assert.equal((await db.query('SELECT * FROM claim_client_account_deletion($1)',[token])).rowCount,0);
    await db.query(`UPDATE account_deletion_requests SET requested_at=now()-interval '3 hours',earliest_delete_at=now()-interval '45 minutes'`);
    assert.equal((await db.query('SELECT * FROM claim_client_account_deletion($1)',[token])).rowCount,1);
    assert.equal((await other.query('SELECT * FROM claim_client_account_deletion($1)',[randomUUID()])).rowCount,0);
    assert.equal((await db.query('SELECT check_client_account_deletion($1,$2) AS ready',[user,token])).rows[0].ready,true);
    await db.query('INSERT INTO storage.objects VALUES ($1,$2,$3)',[randomUUID(),user,user]);
    assert.equal((await db.query('SELECT check_client_account_deletion($1,$2) AS ready',[user,token])).rows[0].ready,false);
    await db.query('DELETE FROM storage.objects'); // Synthetic object only.
    await db.query('DELETE FROM auth.users WHERE id=$1',[user]); // Simulate Auth FK transaction.
    assert.equal((await db.query('SELECT * FROM account_pricing')).rowCount,0);
    assert.equal((await db.query('SELECT * FROM welcome_offer_redemptions')).rowCount,0);
    assert.equal((await db.query('SELECT * FROM client_profiles')).rowCount,1);
    const history = (await db.query('SELECT * FROM orders WHERE id=$1',[owned])).rows[0];
    assert.equal(history.user_id,null); assert.equal(history.client_email,'old-address@example.com');
    assert.equal(history.client_phone,'historic-phone'); assert.equal(history.estimated_total_cents,5000);
    await db.query(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ($1,'Client@example.com',now())`,[replacement]);
    assert.equal((await db.query(`SELECT outcome FROM create_client_order_review($1,$2,'Client@example.com',5::smallint)`,[legacy,replacement])).rows[0].outcome,'not_found');
    const reclaimable = await db.query(`SELECT id FROM orders WHERE user_id IS NULL AND account_deleted_at IS NULL AND lower(btrim(client_email))=lower('Client@example.com')`);
    assert.equal(reclaimable.rowCount,0);
    assert.equal((await db.query('SELECT * FROM orders WHERE id=$1 AND account_deleted_at IS NULL',[genuineLegacy])).rowCount,1);
    assert.equal((await db.query('SELECT * FROM account_deletion_requests')).rowCount,1);
  } finally { await cluster.stop(); }
});
