// Requires absolute F3_POSTGRES_BIN_DIR, F3_PG_DRIVER_MODULE and GUEST_POSTGREST_BIN.
// Starts its own loopback cluster and HTTP gateway. No database URL is accepted.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { guestDraftRequest } from "../src/lib/guest-order-drafts/api.ts";
import { buildGuestState } from "../src/lib/guest-order-drafts/schema.ts";
import { newToken, readToken, setToken, tokenHash } from "../src/lib/guest-order-drafts/security.ts";
import {
  buildCreateOrderDraftInsertPayload,
  mapOrderDraftDatabaseRow,
} from "../src/lib/order-drafts/database.ts";
import { validateVirtualStagingDraftForResume } from "../src/lib/order-drafts/virtual-staging.ts";
import { STAGING_ADDON_IDS } from "../src/lib/pricing/catalog.ts";

const sql = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const route = "/dashboard/orders/new/virtual-staging";
const secret = "ephemeral-only-" + randomUUID();
const owner = randomUUID(),
  other = randomUUID();
const input = {
  currency: "EUR",
  draft: {
    jobTitle: "Guest lounge",
    defaultFurnitureStyle: "Modern",
    items: [
      {
        clientItemId: randomUUID(),
        state: {
          roomName: "Living",
          furnitureStyle: "Classic",
          additionalInfo: "",
          selectedAddons: [...STAGING_ADDON_IDS],
        },
      },
    ],
  },
};
const state = buildGuestState(input.draft);
const cookiePair = (response) => response.headers.get("set-cookie")?.split(";")[0];
const claimArgs = (g, version = 1) => ({ guestDraftId: g.id, expectedVersion: version });
const claimSql = "SELECT * FROM public.claim_guest_order_draft($1,$2,$3,$4)";
const saveSql = "SELECT * FROM public.save_guest_order_draft($1,$2,$3,$4,$5)";
const clean = await sql("supabase/cleanup-guest-order-drafts.sql");

async function freePort() {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((ok) => server.close(ok));
  return port;
}

async function waitForLock(observer, pid) {
  for (let i = 0; i < 400; i++) {
    const { rows } = await observer.query("SELECT cardinality(pg_blocking_pids($1)) AS blockers", [pid]);
    if (rows[0].blockers > 0) return;
    await delay(10);
  }
  assert.fail("Competing PostgreSQL session never waited on the row lock");
}

test("isolated PostgreSQL and PostgREST", { timeout: 240000 }, async (t) => {
  const { F3_POSTGRES_BIN_DIR: bin, F3_PG_DRIVER_MODULE: driver, GUEST_POSTGREST_BIN: rest } = process.env;
  for (const file of [bin, driver, rest])
    assert.ok(file && isAbsolute(file), "Set all three local tool paths (see file header)");
  const dir = await mkdtemp(join(resolve(tmpdir()), "picchu-guest-pg-"));
  const data = join(dir, "data"),
    port = await freePort(),
    username = "guest_" + randomUUID().replaceAll("-", "");
  const run = (name, args) =>
    promisify(execFile)(join(bin, name + (process.platform === "win32" ? ".exe" : "")), args, {
      windowsHide: true,
      timeout: 90000,
    });
  const { Client } = createRequire(import.meta.url)(driver);
  const clients = [];
  let running = false,
    gateway;
  t.after(async () => {
    if (gateway && gateway.exitCode === null && gateway.signalCode === null) {
      const stopped = once(gateway, "close");
      gateway.kill();
      await stopped;
    }
    await Promise.all(clients.map((c) => c.end()));
    if (running) await run("pg_ctl", ["-D", data, "-w", "-m", "fast", "stop"]);
    assert.equal(dirname(dir), resolve(tmpdir()));
    assert.ok(basename(dir).startsWith("picchu-guest-pg-"));
    await rm(dir, { recursive: true });
  });
  await run("initdb", ["-D", data, "-U", username, "-A", "trust", "--encoding=UTF8", "--locale=C"]);
  // On Windows postgres can inherit execFile's pipe handles after pg_ctl
  // exits. Wait for the launcher process with no inherited output pipes.
  const launcher = spawn(
    join(bin, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl"),
    ["-D", data, "-l", join(dir, "postgres.log"), "-w", "-o", "-h 127.0.0.1 -p " + port, "start"],
    { stdio: "ignore", windowsHide: true },
  );
  const [started] = await once(launcher, "exit");
  assert.equal(started, 0, "Temporary PostgreSQL failed to start");
  running = true;
  async function connect() {
    const client = new Client({
      host: "127.0.0.1",
      port,
      user: username,
      database: "postgres",
      password: "",
      ssl: false,
    });
    await client.connect();
    clients.push(client);
    await client.query("SET statement_timeout = '10s'");
    return client;
  }
  const db = await connect(),
    a = await connect(),
    b = await connect();
  const first = async (client, query, args) => (await client.query(query, args)).rows[0];
  const count = async () => (await first(db, "SELECT count(*)::int AS n FROM order_drafts")).n;
  const guest = async (g) => first(db, "SELECT * FROM guest_order_drafts WHERE id=$1", [g.id]);
  for (const path of [
    "scripts/fixtures/order-submission-postgres.sql",
    "supabase/schema.sql",
    "supabase/add-order-drafts.sql",
    "supabase/add-guest-order-drafts.sql",
    "supabase/add-guest-order-drafts.sql",
  ])
    await db.query(await sql(path));
  await db.query("INSERT INTO auth.users VALUES ($1),($2)", [owner, other]);
  await db.query(
    "CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$",
  );
  for (const client of [a, b]) await client.query("SET ROLE service_role");

  async function fixture() {
    const token = newToken(),
      hash = tokenHash(token);
    const { id } = await first(
      a,
      "INSERT INTO guest_order_drafts(token_hash,state,currency) VALUES($1,$2,'EUR') RETURNING id",
      [hash, state],
    );
    return { id, token, hash };
  }
  const claim = (c, g, v = 1, uid = owner, id = g.id) => first(c, claimSql, [uid, g.hash, id, v]);
  const save = (c, g, v = 1, s = state) => first(c, saveSql, [g.hash, g.id, v, s, "CAD"]);

  const restPort = await freePort(),
    url = "http://127.0.0.1:" + restPort;
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !/^(PGRST_|PG|PATH$)/i.test(k)),
  );
  gateway = spawn(rest, [], {
    windowsHide: true,
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...env,
      PATH: bin + delimiter + process.env.PATH,
      PGRST_DB_URI: "postgresql://" + username + "@127.0.0.1:" + port + "/postgres",
      PGRST_DB_ANON_ROLE: "service_role",
      PGRST_DB_SCHEMAS: "public",
      PGRST_SERVER_HOST: "127.0.0.1",
      PGRST_SERVER_PORT: String(restPort),
    },
  });
  let log = "";
  gateway.stderr.on("data", (s) => {
    log += s;
  });
  gateway.stdout.resume();
  for (let i = 0; ; i++) {
    if (gateway.exitCode !== null || i > 200) assert.fail("Local PostgREST unavailable: " + log);
    try {
      if ((await fetch(url + "/")).ok) break;
    } catch {
      /* starting */
    }
    await delay(50);
  }
  // Stand in for the hosted Supabase /rest/v1 reverse proxy and session provider.
  // PostgREST runs every application SQL operation under the real service_role.
  let discardClaimReply = false;
  const local = createClient(url, "synthetic", {
    global: {
      fetch: async (target, init) => {
        const path = new URL(target);
        assert.equal(path.origin, url);
        assert.ok(path.pathname.startsWith("/rest/v1/"));
        path.pathname = path.pathname.slice("/rest/v1".length);
        const headers = new Headers(init.headers);
        headers.delete("authorization");
        const response = await fetch(path, { ...init, headers });
        if (discardClaimReply && path.pathname === "/rpc/claim_guest_order_draft") {
          discardClaimReply = false;
          assert.ok(response.ok);
          await response.arrayBuffer(); // Real HTTP response after PostgreSQL COMMIT.
          throw new Error("Connection lost before the application received the RPC reply");
        }
        return response;
      },
    },
  });
  process.env.GUEST_ORDER_DRAFTS_ENABLED = "true";
  process.env.GUEST_DRAFT_COOKIE_SECRET = secret;
  function api(op, body, cookie, uid = owner) {
    const method = { get: "GET", save: "PUT", claim: "POST", new: "POST" }[op];
    return guestDraftRequest(
      new Request(url, {
        method,
        headers: { "Content-Type": "application/json", ...(cookie && { cookie }) },
        body: body && JSON.stringify(body),
      }),
      op,
      { db: () => local, user: async () => uid && { id: uid }, limit: async () => 0 },
    );
  }
  function issueCookie(g, ms = 3600000) {
    const r = new Response();
    setToken(r, g.token, secret, new Date(Date.now() + ms).toISOString());
    return cookiePair(r);
  }

  await t.test(
    "RLS and permissions deny direct guest table and RPC access to both browser roles",
    async () => {
      const table = await db.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='guest_order_drafts'",
      );
      assert.equal(table.rowCount, 14);
      assert.deepEqual(
        await first(
          db,
          "SELECT relrowsecurity AS enabled FROM pg_class WHERE oid='guest_order_drafts'::regclass",
        ),
        { enabled: true },
      );
      assert.equal(
        (await db.query("SELECT * FROM pg_policies WHERE tablename='guest_order_drafts'")).rowCount,
        0,
      );
      for (const role of ["anon", "authenticated"]) {
        await b.query("SET ROLE " + role);
        const privileges = await first(
          b,
          `
          SELECT has_table_privilege('public.guest_order_drafts',
                   'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') AS table_access,
                 has_any_column_privilege('public.guest_order_drafts',
                   'SELECT, INSERT, UPDATE, REFERENCES') AS column_access
        `,
        );
        assert.deepEqual(privileges, { table_access: false, column_access: false }, role);
        for (const statement of [
          "SELECT * FROM guest_order_drafts",
          "DELETE FROM guest_order_drafts",
          "SELECT * FROM claim_guest_order_draft(NULL,NULL,NULL,NULL)",
          "SELECT * FROM save_guest_order_draft(NULL,NULL,NULL,NULL,NULL)",
          "SELECT is_valid_guest_virtual_staging_state(NULL)",
          "SELECT guest_draft_text_ok(NULL,NULL)",
        ]) {
          await assert.rejects(b.query(statement), { code: "42501" });
        }
      }
      await b.query("SET ROLE service_role");
    },
  );

  await t.test(
    "stored state is validated inside claim, before mutation, against every catalog add-on and forbidden shapes",
    async () => {
      const g = await fixture(),
        before = await count();
      assert.equal(
        (await first(a, "SELECT is_valid_guest_virtual_staging_state($1) AS valid", [state])).valid,
        true,
      );
      // A removed catalog ID must disappear from SQL too. Positive examples
      // alone would miss a validator whose allowlist is a strict superset.
      const { definition } = await first(
        a,
        "SELECT pg_get_functiondef('public.is_valid_guest_virtual_staging_state(jsonb)'::regprocedure) AS definition",
      );
      const list = /addon #>> '{}' NOT IN\s*\(([^)]+)\)/.exec(definition);
      assert.ok(list);
      assert.deepEqual(
        Array.from(list[1].matchAll(/'([^']+)'/g), (m) => m[1]).sort(),
        [...STAGING_ADDON_IDS].sort(),
      );
      const item = state.items[0];
      for (const corrupt of [
        { ...state, quote: {} },
        { ...state, metadata: {} },
        { ...state, termsUi: { ...state.termsUi, accepted: true } },
        { ...state, items: [item, item] },
        { ...state, items: [] },
        { ...state, jobTitle: null },
        { ...state, currentStep: null },
        { ...state, jobTitle: "😀".repeat(61) },
        { ...state, schemaVersion: "1" },
        ...[
          { selectedAddons: ["made-up"] },
          { selectedAddons: ["colour-change", "colour-change"] },
          { selectedAddons: [null] },
          { originalFilename: "a" },
          { roomName: null },
          { additionalInfo: "drafts/private/a" },
          { additionalInfo: "A".repeat(4100) },
        ].map((fields) => ({ ...state, items: [{ ...item, state: { ...item.state, ...fields } }] })),
      ]) {
        await db.query("UPDATE guest_order_drafts SET state=$1 WHERE id=$2", [corrupt, g.id]);
        assert.equal((await claim(a, g)).result_code, "invalid_state");
        assert.equal((await guest(g)).claimed_at, null);
      }
      assert.equal(await count(), before);
    },
  );

  for (const phase of ["INSERT", "UPDATE"])
    await t.test(
      "forced " + phase + " failure rolls back both mutations; same request succeeds after repair",
      async () => {
        const g = await fixture(),
          original = await guest(g),
          before = await count();
        const table = phase === "INSERT" ? "order_drafts" : "guest_order_drafts";
        await db.query(
          "CREATE OR REPLACE FUNCTION test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced abort'; END $$",
        );
        await db.query(
          "CREATE TRIGGER fail_transfer BEFORE " +
            phase +
            " ON " +
            table +
            " FOR EACH ROW EXECUTE FUNCTION test_failure()",
        );
        try {
          const r = await api("claim", claimArgs(g), issueCookie(g));
          assert.equal(r.status, 500);
          assert.deepEqual(await r.json(), { code: "database_error", outcome: "rolled_back" });
          assert.equal(cookiePair(r), undefined);
          assert.deepEqual(await guest(g), original);
          assert.equal(await count(), before);
        } finally {
          await db.query("DROP TRIGGER fail_transfer ON " + table);
        }
        assert.equal((await claim(a, g)).result_code, "claimed");
      },
    );

  await t.test(
    "22-column payload parity, explicit guest style preservation, existing resume and dashboard RLS",
    async () => {
      for (const [currency, region] of [
        ["USD", "US"],
        ["EUR", "EU"],
        ["CAD", "CA"],
      ]) {
        const g = await fixture();
        await db.query("UPDATE guest_order_drafts SET currency=$1 WHERE id=$2", [currency, g.id]);
        const result = await claim(a, g);
        const { id, ...persisted } = JSON.parse(
          JSON.stringify(await first(db, "SELECT * FROM order_drafts WHERE id=$1", [result.draft_id])),
        );
        const expected = buildCreateOrderDraftInsertPayload(
          owner,
          { serviceType: "virtual-staging", route, state, currency, region },
          new Date(persisted.created_at),
        );
        assert.equal(expected.ok, true);
        assert.equal(Object.keys(expected.data).length, 22);
        // The generic Zod envelope strips the VS-specific top-level default.
        // Claim must preserve it, including when it differs from the first item.
        assert.deepEqual(persisted, {
          ...expected.data,
          state: { ...expected.data.state, defaultFurnitureStyle: state.defaultFurnitureStyle },
        });
        const resume = validateVirtualStagingDraftForResume(mapOrderDraftDatabaseRow({ id, ...persisted }));
        assert.equal(resume.ok, true);
        assert.equal(resume.form.defaultFurnitureStyle, "Modern");
        assert.equal(resume.form.items[0].furnitureStyle, "Classic");
        assert.deepEqual(resume.form.items[0].referenceFiles, []);
        assert.equal(resume.form.items[0].file, null);
        assert.deepEqual(resume.form.orderTerms, state.termsUi);
        await b.query("SET ROLE authenticated");
        for (const uid of [owner, other]) {
          await b.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid]);
          assert.equal(
            (
              await b.query(
                "SELECT id FROM order_drafts WHERE id=$1 AND status='active' AND deleted_at IS NULL AND expires_at>now()",
                [id],
              )
            ).rowCount,
            uid === owner ? 1 : 0,
          );
        }
        await b.query("SET ROLE service_role");
      }
    },
  );

  await t.test(
    "two overlapping claims, pending GET snapshot, stale same-user retry and foreign isolation",
    async () => {
      const g = await fixture(),
        before = await count(),
        cookie = issueCookie(g);
      await a.query("BEGIN");
      try {
        const firstClaim = await claim(a, g);
        const snapshot = await api("get", null, cookie);
        assert.equal((await snapshot.json()).claimed, false); // First claim can still commit.
        // Even a demonstrably aborted retry says nothing about the first claim.
        await b.query("SET statement_timeout='200ms'");
        await assert.rejects(claim(b, g), { code: "57014" });
        await b.query("SET statement_timeout='10s'");
        const retry = claim(b, g);
        await waitForLock(db, b.processID);
        await a.query("COMMIT");
        const again = await retry;
        assert.equal(again.result_code, "already_claimed");
        assert.equal(again.draft_id, firstClaim.draft_id);
        assert.equal((await claim(a, g, 999)).draft_id, again.draft_id);
        const mismatch = await claim(a, g, 1, owner, randomUUID());
        assert.equal(mismatch.result_code, "context_mismatch");
        assert.equal(mismatch.draft_id, null);
        assert.equal(await count(), before + 1);
      } finally {
        await a.query("ROLLBACK");
      }
      for (const op of ["get", "claim"]) {
        const r = await api(op, op === "claim" ? claimArgs(g) : null, cookie, other);
        assert.equal(r.status, 404);
        assert.deepEqual(await r.json(), { code: "not_found" });
      }
      const unauth = await api("get", null, cookie, null);
      assert.equal(unauth.status, 401);
      assert.deepEqual(await unauth.json(), { code: "unauthenticated", claimed: true });
    },
  );

  for (const winner of ["save", "claim"])
    await t.test(winner + " wins actual save/claim lock race", async () => {
      const g = await fixture(),
        before = await count(),
        updated = { ...state, jobTitle: "New configuration" };
      await a.query("BEGIN");
      try {
        const won = winner === "save" ? await save(a, g, 1, updated) : await claim(a, g);
        const losing = winner === "save" ? claim(b, g) : save(b, g, 1, updated);
        await waitForLock(db, b.processID);
        await a.query("COMMIT");
        const lost = await losing;
        if (winner === "save") {
          assert.equal(won.version, 2);
          assert.equal(lost.result_code, "version_conflict");
          assert.equal(await count(), before);
          const accepted = await claim(b, g, 2);
          assert.deepEqual(
            (await first(db, "SELECT state FROM order_drafts WHERE id=$1", [accepted.draft_id])).state,
            updated,
          );
        } else {
          assert.equal(lost, undefined);
          assert.deepEqual((await guest(g)).state, state);
        }
        assert.equal(await count(), before + 1);
      } finally {
        await a.query("ROLLBACK");
      }
    });

  await t.test("real HTTP save/new/GET quote, two initial tabs, CAS and context binding", async () => {
    const [r1, r2] = await Promise.all([api("save", input), api("save", input)]);
    assert.equal(r1.status, 201);
    assert.equal(r2.status, 201);
    const one = await r1.json(),
      two = await r2.json(),
      cookie = cookiePair(r2);
    assert.notEqual(one.guestDraftId, two.guestDraftId);
    assert.equal(
      (await api("save", { ...input, guestDraftId: one.guestDraftId, expectedVersion: 1 }, cookie)).status,
      409,
    );
    const stale = await api("claim", { guestDraftId: one.guestDraftId, expectedVersion: 1 }, cookie);
    assert.deepEqual(await stale.json(), { code: "guest_draft_context_mismatch" });
    const current = await api("get", null, cookie);
    assert.equal(cookiePair(current), undefined);
    assert.deepEqual(await current.json(), { claimed: false, ...two });
    const write = { ...input, guestDraftId: two.guestDraftId, expectedVersion: 1, currency: "CAD" };
    const updated = await api("save", write, cookie);
    assert.equal(updated.status, 200);
    const row = await updated.json();
    assert.equal(row.version, 2);
    assert.equal(row.quote.preview.currency, "CAD");
    assert.equal(row.quote.nonAuthoritative, true);
    const conflict = await api("save", write, cookie);
    assert.equal(conflict.status, 409);
    assert.deepEqual(await conflict.json(), { code: "version_conflict" });
    const fresh = await api("new", input, cookie);
    assert.equal(fresh.status, 201);
    const next = await fresh.json();
    assert.notEqual(next.guestDraftId, row.guestDraftId);
    assert.notEqual(cookiePair(fresh), cookie);
    assert.deepEqual(next.quote, one.quote);
  });

  await t.test(
    "committed RPC with a lost transport reply returns unknown; repeating exactly the same claim recovers",
    async () => {
      const g = await fixture(),
        before = await count(),
        cookie = issueCookie(g);
      discardClaimReply = true;
      const uncertain = await api("claim", claimArgs(g), cookie);
      assert.equal(uncertain.status, 503);
      assert.deepEqual(await uncertain.json(), { code: "write_outcome_unknown", outcome: "unknown" });
      assert.equal(cookiePair(uncertain), undefined);
      const persisted = await guest(g);
      assert.equal(persisted.claimed_by, owner);
      const retry = await api("claim", claimArgs(g), cookie);
      assert.equal(retry.status, 200);
      const recovered = await retry.json();
      assert.equal(recovered.draftId, persisted.claimed_draft_id);
      assert.equal(recovered.alreadyClaimed, true);
      assert.equal(await count(), before + 1);
    },
  );

  await t.test(
    "lose entire claim response including Set-Cookie; restore only during original cookie lifetime",
    async () => {
      const g = await fixture(),
        cookie = issueCookie(g, 120000),
        before = await count();
      const lost = await api("claim", claimArgs(g), cookie);
      assert.equal(lost.status, 200);
      const refreshed = cookiePair(lost);
      assert.notEqual(refreshed, cookie);
      const active = await guest(g);
      const restore = await api("get", null, cookie);
      assert.deepEqual(await restore.json(), {
        claimed: true,
        guestDraftId: g.id,
        draftId: active.claimed_draft_id,
        draftVersion: 1,
        draftStatus: "active",
      });
      const retry = await api("claim", claimArgs(g, 55), cookie);
      assert.equal(retry.status, 200);
      const body = await retry.json();
      assert.equal(body.alreadyClaimed, true);
      assert.equal(body.draftId, active.claimed_draft_id);
      assert.equal(Date.parse(body.guestExpiresAt), active.expires_at.getTime());
      const missed = await api("save", { ...input, ...claimArgs(g) }, cookie);
      assert.deepEqual(await missed.json(), { code: "guest_draft_claimed" });
      assert.equal(cookiePair(missed), undefined);
      const later = Date.now() + 180000;
      const host = (v) => new Request(url, { headers: { cookie: v } });
      assert.equal(readToken(host(cookie), secret, later), null);
      assert.equal(readToken(host(refreshed), secret, later), g.token);
      const now = t.mock.method(Date, "now", () => later);
      try {
        for (const value of [cookie, undefined]) {
          assert.equal((await api("get", null, value)).status, 401);
          assert.equal((await api("claim", claimArgs(g), value)).status, 401);
        }
      } finally {
        now.mock.restore();
      }
      await b.query("SET ROLE authenticated");
      await b.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [owner]);
      assert.equal(
        (
          await b.query(
            "SELECT id FROM order_drafts WHERE user_id=$1 AND status='active' AND deleted_at IS NULL AND expires_at>now() AND id=$2",
            [owner, active.claimed_draft_id],
          )
        ).rowCount,
        1,
      );
      await b.query("SET ROLE service_role");
      const fresh = await api("new", input, cookie);
      assert.equal(fresh.status, 201);
      assert.notEqual((await fresh.json()).guestDraftId, g.id);
      assert.equal(await count(), before + 1);
    },
  );

  await t.test(
    "cleanup only removes expired guest rows, skips an in-flight extension, retains order and file",
    async () => {
      const live = await fixture(),
        dead = await fixture(),
        claimed = await claim(a, dead),
        file = randomUUID();
      await db.query(
        "INSERT INTO order_draft_files(id,draft_id,item_client_id,kind,storage_path,original_filename,file_size,mime_type) VALUES ($1,$2,$3,'original','synthetic/a','a.jpg',1,'image/jpeg')",
        [file, claimed.draft_id, randomUUID()],
      );
      await db.query(
        "UPDATE guest_order_drafts SET expires_at=now()-interval '1 hour' WHERE id IN ($1,$2)",
        [live.id, dead.id],
      );
      assert.equal((await claim(a, dead)).result_code, "already_claimed");
      assert.equal((await claim(a, live)).result_code, "expired");
      await a.query("BEGIN");
      try {
        await a.query("UPDATE guest_order_drafts SET expires_at=now()+interval '30 days' WHERE id=$1", [
          live.id,
        ]);
        assert.deepEqual((await b.query(clean)).rows, [{ id: dead.id }]);
        await a.query("COMMIT");
      } finally {
        await a.query("ROLLBACK");
      }
      assert.equal((await b.query(clean)).rowCount, 0);
      assert.ok(await guest(live));
      assert.equal(
        (await db.query("SELECT id FROM order_drafts WHERE id=$1", [claimed.draft_id])).rowCount,
        1,
      );
      assert.equal((await db.query("SELECT id FROM order_draft_files WHERE id=$1", [file])).rowCount, 1);
    },
  );
});
