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

test('deletion transaction, durable targets, stale-JWT RLS, fair claims and FK retention', { skip: !enabled }, async () => {
  const cluster = await startCluster();
  try {
    const db = await cluster.connect('control');
    const other = await cluster.connect('parallel');
    await db.query(await loadSql('scripts/fixtures/order-submission-postgres.sql'));
    await db.query(`ALTER TABLE auth.users ADD email text, ADD email_confirmed_at timestamptz, ADD is_anonymous boolean DEFAULT false;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.email', true), '');
      $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE SCHEMA storage;
      CREATE TABLE storage.objects(id uuid, owner uuid, owner_id text);`);
    await db.query(await loadSql('supabase/schema.sql'));
    await db.query(await loadSql('supabase/add-order-drafts.sql'));
    await db.query(await loadSql('supabase/add-client-profiles.sql'));
    for (const file of ['add-multi-reference-files.sql', 'add-order-deliverables.sql', 'add-deliverable-reviews.sql',
      'add-deliverable-review-files.sql', '20260909191236_add_deliverable_review_file_upload_status.sql', 'add-atomic-order-submissions.sql']) {
      await db.query(await loadSql(`supabase/${file}`));
    }
    // Current hosted policy catalog matches this repository's scalar-subquery
    // auth optimization. Apply its actual ALTER POLICY block; the full script's
    // preflight also expects unrelated marketing tables absent from this fixture.
    const policyTuning = await loadSql('supabase/security-hardening-rls-auth-init-plan.sql');
    const policyStart = policyTuning.indexOf('ALTER POLICY client_profiles_insert_own');
    const policyEnd = policyTuning.indexOf('\nCOMMIT;', policyStart);
    assert.ok(policyStart > 0 && policyEnd > policyStart);
    await db.query(policyTuning.slice(policyStart, policyEnd));
    const readable = ['orders', 'order_items', 'order_deliverables', 'deliverable_reviews', 'deliverable_review_files',
      'order_drafts', 'order_draft_files', 'order_draft_item_reference_files', 'order_item_reference_files', 'client_profiles'];
    await db.query(await loadSql('supabase/20260912110000_add_client_order_reviews.sql'));
    await db.query(`CREATE TABLE public.account_pricing(user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE);
      CREATE TABLE public.welcome_offer_redemptions(user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE);
      GRANT SELECT ON public.orders, public.client_profiles TO authenticated;
      GRANT INSERT, UPDATE ON public.client_profiles TO authenticated;`);
    await db.query(`GRANT SELECT ON ${readable.join(', ')} TO authenticated`);
    const sql = await loadSql('supabase/migrations/20261002214429_client_account_deletion.sql');
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
    await insertOrder(db,owned,user,'Client@example.com','VS-OWNED');
    await insertOrder(db,legacy,null,' Client@example.com ','VS-LEGACY');
    await insertOrder(db,foreign,stranger,'Client@example.com','VS-OTHER');
    await insertOrder(db,genuineLegacy,null,'untouched@example.com','VS-GENUINE');
    const item = randomUUID(), deliverable = randomUUID(), review = randomUUID(), pendingFile = randomUUID(),
      draft = randomUUID(), draftItem = randomUUID(), submission = randomUUID();
    const pendingPath = `rework/${review}/${pendingFile}-pending.jpg`;
    const committedPath = `rework/${review}/commercial.jpg`;
    await db.query(`INSERT INTO order_items(id,order_id,item_index) VALUES ($1,$2,0)`,[item,owned]);
    await db.query(`INSERT INTO order_deliverables(id,order_id,order_number,storage_path,filename,file_size,mime_type)
      VALUES ($1,$2,'VS-OWNED','VS-OWNED/delivery.jpg','delivery.jpg',100,'image/jpeg')`,[deliverable,owned]);
    await db.query(`INSERT INTO deliverable_reviews(id,deliverable_id,order_id,order_number,client_email)
      VALUES ($1,$2,$3,'VS-OWNED','Client@example.com')`,[review,deliverable,owned]);
    await db.query(`INSERT INTO deliverable_review_files(id,review_id,order_id,deliverable_id,storage_path,filename,file_size,mime_type,upload_status)
      VALUES ($1,$2,$3,$4,$5,'pending.jpg',100,'image/jpeg','pending'),
      (gen_random_uuid(),$2,$3,$4,$6,'commercial.jpg',100,'image/jpeg','uploaded')`,[pendingFile,review,owned,deliverable,pendingPath,committedPath]);
    await db.query(`INSERT INTO order_drafts(id,user_id,service_type,route,currency) VALUES ($1,$2,'virtual-staging','/dashboard/orders/new/virtual-staging','USD')`,[draft,user]);
    await db.query(`INSERT INTO order_draft_files(draft_id,item_client_id,kind,storage_path,original_filename,file_size,mime_type)
      VALUES ($1,$2,'original',$3,'draft.jpg',100,'image/jpeg')`,[draft,draftItem,`drafts/${user}/${draft}/source.jpg`]);
    await db.query(`INSERT INTO order_draft_item_reference_files(draft_id,item_client_id,reference_id,position,storage_path,original_filename,file_size,mime_type)
      VALUES ($1,$2,gen_random_uuid(),0,$3,'ref.jpg',100,'image/jpeg')`,[draft,draftItem,`drafts/${user}/${draft}/ref.jpg`]);
    await db.query(`INSERT INTO order_item_reference_files(order_item_id,reference_id,position,storage_path,original_filename,file_size,mime_type)
      VALUES ($1,gen_random_uuid(),0,'VS-OWNED/ref.jpg','ref.jpg',100,'image/jpeg')`,[item]);
    await db.query(`INSERT INTO client_order_reviews(order_id,user_id,rating) VALUES ($1,$2,5)`,[owned,user]);
    const insertSubmission = (id,owner,number) => db.query(`INSERT INTO order_submissions
      (submission_id,user_id,request_hash,service_type,reserved_order_id,reserved_order_number,currency,pricing_version,quote_hash,estimated_total_cents,pricing_snapshot)
      VALUES ($1,$2,repeat('a',64),'virtual-staging',gen_random_uuid(),$3,'USD','fixture',repeat('b',64),5000,'{}')`,[id,owner,number]);
    await insertSubmission(submission,user,'VS-0042');
    const retiredFile = randomUUID(), retiredReview = randomUUID();
    await db.query(`INSERT INTO deliverable_reviews(id,deliverable_id,order_id,order_number,client_email)
      VALUES ($1,$2,$3,'VS-OWNED','Client@example.com')`,[retiredReview,deliverable,owned]);
    const retiredPath = `rework/${retiredReview}/retired-before-deletion.jpg`;
    await db.query(`INSERT INTO deliverable_review_files(id,review_id,order_id,deliverable_id,storage_path,filename,file_size,mime_type,upload_status)
      VALUES ($1,$2,$3,$4,$5,'retired.jpg',100,'image/jpeg','pending')`,[retiredFile,retiredReview,owned,deliverable,retiredPath]);
    await db.query('DELETE FROM deliverable_reviews WHERE id=$1',[retiredReview]); // Actual F7 FK cascade.
    const retiredTarget = (await db.query('SELECT * FROM account_deletion_cleanup_targets WHERE target=$1',[retiredPath])).rows[0];
    assert.equal(retiredTarget.user_id,null); assert.equal(retiredTarget.order_id,owned);

    await db.query('SET ROLE authenticated');
    await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [user]);
    await db.query(`SELECT set_config('request.jwt.claim.email','Client@example.com',false)`);
    for (const table of readable) assert.ok((await db.query(`SELECT * FROM ${table}`)).rowCount > 0, `${table}: positive RLS baseline`);
    await assert.rejects(db.query('SELECT * FROM client_order_reviews'), /permission denied/);
    for (const table of ['account_deletion_requests','account_deletion_cleanup_targets']) {
      await assert.rejects(db.query(`SELECT * FROM ${table}`), /permission denied/);
    }
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
    // Same JWT sub AND email, not a null/anonymous identity. Load actual policy
    // SQL, including each email-based child policy, rather than mock its result.
    for (const table of readable) assert.equal((await db.query(`SELECT * FROM ${table}`)).rowCount, 0, `${table}: pending stale JWT`);
    await assert.rejects(db.query(`INSERT INTO client_profiles(user_id,full_name) VALUES ($1,'blocked')`,[user]), /row-level security/);
    await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[stranger]);
    assert.equal((await db.query('SELECT id FROM orders')).rows[0].id,foreign);
    assert.equal((await db.query('SELECT user_id FROM client_profiles')).rows[0].user_id,stranger);
    await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[user]);
    await db.query('RESET ROLE');
    const targets = (await db.query('SELECT kind,target FROM account_deletion_cleanup_targets WHERE user_id=$1 ORDER BY kind,target',[user])).rows;
    assert.deepEqual(targets,[...[pendingPath,retiredPath].sort().map(target => ({kind:'rework_file',target})),{kind:'submission_prefix',target:'VS-0042'}]);
    await assert.rejects(db.query("UPDATE deliverable_review_files SET upload_status='uploaded' WHERE id=$1",[pendingFile]), /unavailable/);
    await assert.rejects(db.query(`UPDATE order_submissions SET lease_token=gen_random_uuid(), lease_expires_at=now()+interval '5 minutes' WHERE submission_id=$1`,[submission]), /unavailable/);
    await assert.rejects(insertSubmission(randomUUID(),user,'VS-0043'), /unavailable/);
    // Removing temporary metadata no longer destroys the cleanup association.
    await db.query('DELETE FROM deliverable_review_files WHERE id=$1',[pendingFile]);
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
    assert.equal(history.user_id,null); assert.equal(history.client_email,'Client@example.com');
    assert.equal(history.client_phone,'historic-phone'); assert.equal(history.estimated_total_cents,5000);
    assert.equal((await db.query('SELECT user_id FROM order_submissions WHERE submission_id=$1',[submission])).rows[0].user_id,null);
    assert.equal((await db.query('SELECT * FROM order_drafts WHERE id=$1',[draft])).rowCount,0);
    await db.query(`UPDATE account_deletion_requests SET status='reconciling',auth_deleted_at=now(),last_reconciled_at=now(),
      lease_token=NULL,lease_expires_at=NULL,retry_after=now()+interval '1 day' WHERE user_id=$1`,[user]);
    await db.query('DELETE FROM order_submissions WHERE submission_id=$1',[submission]);
    assert.deepEqual((await db.query('SELECT kind,target FROM account_deletion_cleanup_targets WHERE user_id=$1 ORDER BY kind,target',[user])).rows,targets);
    await db.query('SET ROLE authenticated');
    for (const table of readable) assert.equal((await db.query(`SELECT * FROM ${table}`)).rowCount,0,`${table}: post-Auth stale JWT`);
    await assert.rejects(db.query('SELECT * FROM client_order_reviews'), /permission denied/);
    await db.query('RESET ROLE');
    await db.query(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ($1,'Client@example.com',now())`,[replacement]);
    await db.query('SET ROLE authenticated');
    await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[replacement]);
    for (const table of readable) assert.equal((await db.query(`SELECT * FROM ${table}`)).rowCount,0,`${table}: same-email new account`);
    await db.query('RESET ROLE');
    assert.equal((await db.query(`SELECT outcome FROM create_client_order_review($1,$2,'Client@example.com',5::smallint)`,[legacy,replacement])).rows[0].outcome,'not_found');
    const reclaimable = await db.query(`SELECT id FROM orders WHERE user_id IS NULL AND account_deleted_at IS NULL AND lower(btrim(client_email))=lower('Client@example.com')`);
    assert.equal(reclaimable.rowCount,0);
    assert.equal((await db.query('SELECT * FROM orders WHERE id=$1 AND account_deleted_at IS NULL',[genuineLegacy])).rowCount,1);
    assert.equal((await db.query('SELECT * FROM account_deletion_requests')).rowCount,1);
    // Real claim RPC, permissions, leases and due ordering (not transport mocks).
    const pendingA=randomUUID(), pendingB=randomUUID(), reconcilingB=randomUUID();
    await db.query(`INSERT INTO account_deletion_requests(user_id,requested_at,earliest_delete_at,status,retry_after)
      VALUES ($1,now()-interval '3 hours',now()-interval '45 minutes','pending',now()-interval '1 minute'),
             ($2,now()-interval '3 hours',now()-interval '45 minutes','pending',now()-interval '30 seconds'),
             ($3,now()-interval '30 days',now()-interval '29 days','reconciling',now()-interval '30 seconds')`,[pendingA,pendingB,reconcilingB]);
    await db.query(`UPDATE account_deletion_requests SET retry_after=now()-interval '1 minute' WHERE user_id=$1`,[user]);
    await db.query('SET ROLE service_role');
    const claim = async () => (await db.query('SELECT * FROM claim_client_account_deletion($1)',[randomUUID()])).rows[0];
    const a=await claim(); assert.equal(a.user_id,pendingA); // Pending gets priority over newly due reconciliation.
    await db.query(`UPDATE account_deletion_requests SET lease_token=NULL,lease_expires_at=NULL,retry_after=now()+interval '15 minutes',last_error_code='storage_list_failed' WHERE user_id=$1`,[pendingA]);
    assert.equal((await claim()).user_id,pendingB); // Failed account cannot monopolize claims.
    assert.equal((await claim()).user_id,user); // Due recurring records remain claimable.
    assert.equal((await claim()).user_id,reconcilingB); // Leased row cannot starve the next one.
    assert.equal(await claim(),undefined);
    await db.query('RESET ROLE');
    await db.query(`UPDATE account_deletion_requests SET lease_expires_at=now()-interval '1 second' WHERE user_id=$1`,[reconcilingB]);
    assert.equal((await claim()).user_id,reconcilingB); // Crash lease recovery.
    // A persistent pending failure must not starve recurring cleanup either.
    // Age recurring work beyond the pending preference; the next retry competes
    // from its new due time instead of retaining permanent state priority.
    await db.query(`UPDATE account_deletion_requests SET lease_token=NULL,lease_expires_at=NULL,
      retry_after=now()-interval '2 hours' WHERE user_id=$1`,[reconcilingB]);
    await db.query(`UPDATE account_deletion_requests SET retry_after=now()-interval '1 second' WHERE user_id=$1`,[pendingA]);
    assert.equal((await claim()).user_id,reconcilingB);
    assert.equal((await claim()).user_id,pendingA); // The recurring record cannot repeat while leased/backed off.
    // A NULL-owner legacy review can be reserved concurrently with deletion.
    // The order-row lock makes its target capture atomic too.
    const legacyUser=randomUUID(), legacyOrder=randomUUID(), legacyDelivery=randomUUID(), legacyReview=randomUUID(), legacyFile=randomUUID();
    await db.query(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ($1,'legacy-race@example.com',now())`,[legacyUser]);
    await insertOrder(db,legacyOrder,null,'legacy-race@example.com','VS-LEGACY-RACE');
    await db.query(`INSERT INTO order_deliverables(id,order_id,order_number,storage_path,filename,file_size,mime_type)
      VALUES ($1,$2,'VS-LEGACY-RACE','VS-LEGACY-RACE/delivery.jpg','delivery.jpg',100,'image/jpeg')`,[legacyDelivery,legacyOrder]);
    await db.query(`INSERT INTO deliverable_reviews(id,deliverable_id,order_id,order_number,client_email)
      VALUES ($1,$2,$3,'VS-LEGACY-RACE','legacy-race@example.com')`,[legacyReview,legacyDelivery,legacyOrder]);
    const reserveLegacyFile = (connection, file) => connection.query(`INSERT INTO deliverable_review_files
      (id,review_id,order_id,deliverable_id,storage_path,filename,file_size,mime_type,upload_status)
      VALUES ($1,$2,$3,$4,$5,'pending.jpg',100,'image/jpeg','pending')`,[file,legacyReview,legacyOrder,legacyDelivery,`rework/${legacyReview}/${file}-pending.jpg`]);
    await other.query('BEGIN'); await reserveLegacyFile(other,legacyFile);
    const legacyDeletion = db.query(`SELECT request_client_account_deletion($1,'legacy-race@example.com')`,[legacyUser]);
    await new Promise((resolve) => setTimeout(resolve,100));
    assert.ok((await other.query(`SELECT count(*)::int n FROM pg_locks WHERE NOT granted`)).rows[0].n > 0);
    await other.query('COMMIT'); await legacyDeletion;
    assert.equal((await db.query('SELECT target FROM account_deletion_cleanup_targets WHERE user_id=$1',[legacyUser])).rows[0].target,`rework/${legacyReview}/${legacyFile}-pending.jpg`);
    await db.query('DELETE FROM auth.users WHERE id=$1',[legacyUser]);
    await assert.rejects(reserveLegacyFile(db,randomUUID()), /unavailable/); // Tombstone survives SET NULL.
    console.log('Verified stale JWT and same-email denial across ' + readable.length + ' real RLS tables; durable targets and fair retry/lease claims.');
  } finally { await cluster.stop(); }
});
