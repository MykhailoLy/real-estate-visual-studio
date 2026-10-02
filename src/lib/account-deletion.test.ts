import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { beforeEach, after } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { isOrderOwned } from "./order-ownership.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const EMAIL = "Client@example.com";
type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let objects: Set<string>;
let calls: string[];
let users: Row[];
let signedRace: boolean;
let failure: string;
let ready: boolean;
let sessionId: string | null;
let admin: boolean;
let signedOut: boolean;

const db = createClient("http://deletion-fixture.invalid", "fixture-service-role", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push(`${method} ${url.pathname}`);
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    const authId = url.pathname.match(/\/auth\/v1\/admin\/users\/([^/]+)$/)?.[1];
    if (authId) {
      const user = users.find((u) => u.id === authId);
      if (!user) return json({ code: "user_not_found", msg: "not found" }, 404);
      if (method === "PUT") return json({ user });
      if (method === "DELETE") {
        assert.equal(body.should_soft_delete, false);
        if (failure === "auth") return json({ code: "delete_failed", msg: "private auth error" }, 500);
        users = users.filter((u) => u.id !== authId);
        for (const table of ["client_profiles", "account_pricing", "order_drafts", "welcome_offer_redemptions"]) {
          tables[table] = tables[table].filter((r) => r.user_id !== authId);
        }
        for (const order of tables.orders) if (order.user_id === authId) order.user_id = null;
      }
      return json({ user });
    }
    if (url.pathname.includes("/storage/v1/object/upload/sign/")) {
      if (signedRace) tables.account_deletion_requests.push({ user_id: ID, status: "pending" });
      return json({ url: "/object/upload/sign/order-files/test?token=fixture" });
    }
    if (url.pathname === "/storage/v1/object/list/order-files") {
      if (failure === "list") return json({ message: "private storage error" }, 500);
      const entries = new Map<string, Row>();
      for (const path of objects) if (path.startsWith(`${body.prefix}/`)) {
        const tail = path.slice(body.prefix.length + 1);
        const name = tail.split("/")[0];
        entries.set(name, { name, id: tail.includes("/") ? null : "object" });
      }
      return json([...entries.values()].sort((a, b) => String(a.name).localeCompare(String(b.name))).slice(0, body.limit));
    }
    if (url.pathname === "/storage/v1/object/order-files" && method === "DELETE") {
      if (failure === "remove") return json({ message: "private storage error" }, 500);
      for (const path of body.prefixes) {
        if (failure !== "reference_remove_ignored" || !path.startsWith("rework/")) objects.delete(path);
      }
      return json([]);
    }
    const rpc = url.pathname.match(/\/rest\/v1\/rpc\/(.+)/)?.[1];
    if (rpc) {
      if (rpc === "request_client_account_deletion") {
        const requested_at = new Date().toISOString();
        tables.account_deletion_requests.push({ user_id: body.p_user_id, status: "pending", requested_at });
        for (const order of tables.orders) if (order.user_id === body.p_user_id ||
          (!order.user_id && String(order.client_email).trim().toLowerCase() === EMAIL.toLowerCase())) order.account_deleted_at = requested_at;
        return json(requested_at);
      }
      if (rpc === "claim_client_account_deletion") {
        const row = ready ? tables.account_deletion_requests.find((r) => r.status === "pending") : null;
        if (row) row.lease_token = body.p_token;
        return json(row ? [row] : []);
      }
      if (rpc === "check_client_account_deletion") return json(failure !== "precondition");
      assert.fail(`Unexpected RPC ${rpc}`);
    }
    const table = url.pathname.match(/\/rest\/v1\/([^/]+)$/)?.[1];
    assert.ok(table && tables[table], `Unexpected request ${url}`);
    if (failure === "state" && table === "account_deletion_requests" && method === "GET") return json({ message: "private DB detail" }, 500);
    const matches = (row: Row) => [...url.searchParams.entries()].every(([key, value]) => {
      if (value.startsWith("eq.")) {
        const field = key === "orders.user_id" ? (row.orders as Row | undefined)?.user_id : row[key];
        return String(field) === value.slice(3);
      }
      if (value.startsWith("in.(")) return value.slice(4, -1).split(",").includes(String(row[key]));
      if (value.startsWith("gt.")) return String(row[key]) > value.slice(3);
      return true;
    });
    const rows = tables[table].filter(matches);
    if (method === "PATCH") {
      if (failure === "completion" && body.status === "completed") return json({ message: "write unavailable" }, 500);
      rows.forEach((r) => Object.assign(r, body));
    }
    if (method === "DELETE") tables[table] = tables[table].filter((r) => !matches(r));
    return json(rows.slice(0, Number(url.searchParams.get("limit") ?? 1000)));
  } },
});

const globals = globalThis as typeof globalThis & { __deletionTest?: unknown };
globals.__deletionTest = { db, isAdmin: () => admin, session: { auth: {
  getUser: async () => ({ data: { user: sessionId ? { id: sessionId, email: EMAIL, email_confirmed_at: "confirmed" } : null }, error: null }),
  signOut: async () => { signedOut = true; return { error: null }; },
} } };
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  const mocks: Record<string, string> = {
    "server-only": "export default undefined",
    "@/lib/supabase-admin": "export const getSupabaseAdminClient=()=>globalThis.__deletionTest.db",
    "@/lib/supabase/server": "export const createServerSupabaseClient=async()=>globalThis.__deletionTest.session",
    "@/lib/admin-auth": "export const isAdminAuthenticated=async()=>globalThis.__deletionTest.isAdmin()",
  };
  if (mocks[specifier]) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
  if (specifier === "@/lib/account-deletion") return { url: new URL("./account-deletion.ts", import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const { requestAccountDeletion, processAccountDeletion, createClientSignedUploadUrl } = await import("./account-deletion.ts");
const { POST: selfDelete } = await import("../app/api/account/delete/route.ts");
const { POST: adminDelete } = await import("../app/api/admin/clients/[userId]/delete/route.ts");
const { POST: worker } = await import("../app/api/internal/account-deletions/route.ts");
after(() => { hooks.deregister(); delete globals.__deletionTest; });
beforeEach(() => {
  calls = []; signedRace = false; failure = ""; ready = false; sessionId = ID; admin = false; signedOut = false;
  users = [{ id: ID, email: EMAIL }, { id: OTHER, email: "other@example.com" }];
  tables = {
    account_deletion_requests: [], order_submissions: [], deliverable_review_files: [],
    orders: [{ id: "history", user_id: ID, client_email: EMAIL, paid: true, amount: 5000 },
      { id: "legacy", user_id: null, client_email: ` ${EMAIL} ` }, { id: "other", user_id: OTHER, client_email: EMAIL }],
    client_profiles: [{ user_id: ID }, { user_id: OTHER }], account_pricing: [{ user_id: ID }],
    welcome_offer_redemptions: [{ user_id: ID }], order_drafts: [{ id: OTHER, user_id: ID, status: "deleted" }],
  };
  objects = new Set([`drafts/${ID}/${OTHER}/file`, `pending/${ID}/submission/file`, `drafts/${OTHER}/retain/file`, "VS-HISTORY/original.jpg"]);
});
const body = { confirmationEmail: EMAIL };
const request = (data: unknown = body) => new Request("http://fixture.invalid/api/account/delete", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
});

test("self deletion rejects unauthenticated, fake identity, wrong and inexact email", async () => {
  sessionId = null; assert.equal((await selfDelete(request())).status, 401);
  sessionId = ID;
  for (const payload of [{ ...body, userId: OTHER }, { confirmationEmail: EMAIL.toLowerCase() }, { confirmationEmail: ` ${EMAIL}` }]) {
    assert.equal((await selfDelete(request(payload))).status, 400);
  }
  assert.equal(tables.account_deletion_requests.length, 0);
});

test("verified self deletion persists pending, signs out, and removes only currently safe drafts", async () => {
  const response = await selfDelete(request());
  assert.equal(response.status, 202); assert.deepEqual(await response.json(), { status: "pending" });
  assert.equal(signedOut, true); assert.equal(tables.account_deletion_requests[0].user_id, ID);
  assert.equal(objects.has(`drafts/${ID}/${OTHER}/file`), false);
  assert.equal(objects.has(`pending/${ID}/submission/file`), true);
  assert.equal(users.length, 2);
});

test("admin authentication and exact selected target confirmation are mandatory", async () => {
  const params = { params: Promise.resolve({ userId: OTHER }) };
  assert.equal((await adminDelete(request(), params)).status, 401);
  admin = true;
  assert.equal((await adminDelete(request(), params)).status, 400);
  assert.equal((await adminDelete(request({ confirmationEmail: "other@example.com" }), params)).status, 202);
  assert.equal(tables.account_deletion_requests[0].user_id, OTHER);
  assert.equal(tables.orders[0].account_deleted_at, undefined);
});

test("pending accounts and database outages cannot mint uploads; signing race releases no URL", async () => {
  await requestAccountDeletion(db, ID, body);
  const before = calls.length;
  await assert.rejects(createClientSignedUploadUrl(db, ID, "order-files", "test"));
  assert.ok(!calls.slice(before).some((c) => c.includes("/upload/sign/")));
  tables.account_deletion_requests = []; failure = "state";
  await assert.rejects(createClientSignedUploadUrl(db, ID, "order-files", "test"));
  failure = ""; signedRace = true;
  await assert.rejects(createClientSignedUploadUrl(db, ID, "order-files", "test"));
});

test("worker does nothing until TTL eligibility and keeps temporary uploads for final sweep", async () => {
  await requestAccountDeletion(db, ID, body);
  assert.deepEqual(await processAccountDeletion(db), { processed: 0 });
  assert.equal(users.length, 2); assert.equal(objects.has(`pending/${ID}/submission/file`), true);
});

for (const fault of ["list", "remove", "precondition", "auth"]) test(`${fault} failure remains pending and retry completes without losing history`, async () => {
  await requestAccountDeletion(db, ID, body); ready = true; failure = fault;
  await assert.rejects(processAccountDeletion(db));
  assert.equal(users.length, 2); assert.equal(tables.account_deletion_requests[0].status, "pending");
  assert.ok(tables.account_deletion_requests[0].last_error_code);
  if (fault !== "auth") assert.ok(!calls.some((c) => c.startsWith("DELETE /auth")));
  failure = ""; await processAccountDeletion(db);
  assert.equal(users.length, 1); assert.equal(users[0].id, OTHER);
  assert.equal(tables.client_profiles.length, 1); assert.equal(tables.account_pricing.length, 0);
  assert.equal(tables.orders.length, 3); assert.equal(tables.orders[0].client_email, EMAIL);
  assert.equal(tables.orders[0].amount, 5000); assert.equal(tables.orders[0].paid, true);
  assert.equal(objects.has("VS-HISTORY/original.jpg"), true);
  assert.equal(objects.has(`drafts/${OTHER}/retain/file`), true);
  assert.equal(objects.has(`pending/${ID}/submission/file`), false);
  assert.equal(tables.account_deletion_requests[0].status, "completed");
  const newIdentity = { userId: "new-auth-id", email: EMAIL };
  assert.equal(isOrderOwned(tables.orders[0], newIdentity), false);
  assert.equal(isOrderOwned(tables.orders[1], newIdentity), false);
  assert.equal(isOrderOwned({ user_id: null, client_email: EMAIL }, newIdentity), true);
});

test("lost completion write retries after Auth is already absent", async () => {
  await requestAccountDeletion(db, ID, body); ready = true; failure = "completion";
  await assert.rejects(processAccountDeletion(db));
  assert.equal(users.length, 1); failure = "";
  objects.add(`pending/${ID}/unconfirmed/file`);
  await processAccountDeletion(db);
  assert.equal(objects.has(`pending/${ID}/unconfirmed/file`), false);
  assert.equal(tables.account_deletion_requests[0].status, "completed");
});

test("rework cleanup confirms removal and preserves uploaded and other-account references", async () => {
  const pendingPath = `rework/${OTHER}/pending.jpg`;
  const retainedPath = `rework/${OTHER}/uploaded.jpg`;
  const foreignPath = `rework/${ID}/foreign.jpg`;
  tables.deliverable_review_files = [
    { id: "pending", review_id: OTHER, storage_path: pendingPath, upload_status: "pending", orders: { user_id: ID } },
    { id: "uploaded", review_id: OTHER, storage_path: retainedPath, upload_status: "uploaded", orders: { user_id: ID } },
    { id: "foreign", review_id: ID, storage_path: foreignPath, upload_status: "pending", orders: { user_id: OTHER } },
  ];
  for (const path of [pendingPath, retainedPath, foreignPath]) objects.add(path);
  await requestAccountDeletion(db, ID, body); ready = true; failure = "reference_remove_ignored";
  await assert.rejects(processAccountDeletion(db), /reference_cleanup_unconfirmed/);
  assert.equal(users.length, 2); assert.equal(tables.deliverable_review_files.length, 3);
  failure = ""; await processAccountDeletion(db);
  assert.equal(objects.has(pendingPath), false);
  assert.equal(objects.has(retainedPath), true); assert.equal(objects.has(foreignPath), true);
  assert.deepEqual(tables.deliverable_review_files.map((file) => file.id), ["uploaded", "foreign"]);
});

test("recursive Storage sweep handles multiple pages without skipping shifted objects", async () => {
  await requestAccountDeletion(db, ID, body); ready = true;
  for (let i = 0; i < 205; i++) objects.add(`pending/${ID}/submission/file-${i}.jpg`);
  await processAccountDeletion(db);
  assert.ok(![...objects].some((path) => path.startsWith(`pending/${ID}/`)));
});

test("worker fails closed without a configured secret or with the wrong bearer", async () => {
  const saved = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET; assert.equal((await worker(request())).status, 503);
    process.env.CRON_SECRET = "isolated-worker-secret";
    assert.equal((await worker(request())).status, 404);
    assert.equal(tables.account_deletion_requests.length, 0);
  } finally { if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved; }
});
