import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test, { beforeEach, after } from "node:test";
import { createClient } from "@supabase/supabase-js";

const USER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ID = "11111111-1111-4111-8111-111111111111";
type Order = { id: string; user_id: string | null; client_email: string; client_phone: string };
type User = { id: string; email: string; email_confirmed_at?: string; is_anonymous?: boolean };
let user: User | null;
let profile: Record<string, unknown> | null;
let orders: Order[];
let writes: { url: URL; body: Record<string, unknown> }[];
let dbFailure: "read" | "write" | "unconfirmed" | "race" | null;
let authFailure: boolean;
let submitted: Record<string, unknown> | null;

const database = createClient("http://fixture.example", "fixture-key", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? "GET";
    const body: Record<string, unknown> = init?.body ? JSON.parse(String(init.body)) : {};
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { "Content-Type": "application/json" },
    });
    if (url.pathname.endsWith("/client_profiles")) {
      if (method === "POST") { writes.push({ url, body }); profile = { ...body, id: USER_ID }; return json(profile); }
      return json(profile ? [profile] : []);
    }
    assert.equal(url.pathname, "/rest/v1/orders");
    if (method === "GET") {
      if (dbFailure === "read") return json({ message: "private DB failure" }, 503);
      assert.equal(url.searchParams.get("user_id"), "is.null");
      assert.ok(url.searchParams.get("client_email")?.startsWith("ilike."));
      // Deliberately overinclusive candidate results prove the route checks
      // exact lowercase equality before writing, even for email metacharacters.
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 100);
      return json(orders.filter((order) => order.user_id === null).slice(offset, offset + limit));
    }
    assert.equal(method, "PATCH");
    writes.push({ url, body });
    assert.deepEqual(body, { user_id: USER_ID }, "only the account ID may be changed");
    assert.equal(url.searchParams.get("user_id"), "is.null");
    const id = url.searchParams.get("id")?.slice(3);
    const email = url.searchParams.get("client_email")?.slice(3);
    const row = orders.find((order) => order.id === id && order.user_id === null && order.client_email === email);
    if (dbFailure === "write") return json({ message: "private write error" }, 503);
    if (dbFailure === "race" && row) row.user_id = OTHER_ID;
    if (!row || dbFailure === "unconfirmed" || dbFailure === "race") return json([]);
    row.user_id = USER_ID;
    return json([{ id: row.id, user_id: row.user_id }]);
  } },
});
const globals = globalThis as typeof globalThis & { __profileAccount?: unknown };
globals.__profileAccount = {
  session: {
    auth: { async getUser() {
      return { data: { user }, error: authFailure ? { message: "private Auth failure" } : null };
    } },
    from: database.from.bind(database),
  },
  database,
  async createOrder(input: Record<string, unknown>) {
    submitted = input;
    return { ok: true, orderId: "order-id", orderNumber: "VS-TEST", replayed: false };
  },
};
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  const mocks: Record<string, string> = {
    "server-only": "export default undefined",
    "@/lib/supabase/server": "export async function createServerSupabaseClient(){return globalThis.__profileAccount.session}",
    "@/lib/supabase-admin": "export function getSupabaseAdminClient(){return globalThis.__profileAccount.database}",
    // Isolate unrelated storage/payment/email operations at the existing order
    // service boundary; the real metadata, session and identity code runs.
    "@/lib/orders/create-order-server": "export const createProductionOrder=globalThis.__profileAccount.createOrder; export const validateOrderItemsForService=(s,items)=>({ok:true,items}); export const validatePendingOrderFileDescriptors=()=>({ok:true});",
  };
  if (mocks[specifier]) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
  if (specifier.startsWith("@/lib/")) return { url: new URL(`./${specifier.slice(6)}.ts`, import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith(".") && context.parentURL) {
    const url = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
  }
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const { POST: prepare } = await import("../app/api/account/prepare-email-change/route.ts");
const { POST: upsert } = await import("../app/api/profile/upsert/route.ts");
const { POST: order } = await import("../app/(public)/api/order/route.ts");
const { NextRequest } = await import("next/server.js");

beforeEach(() => {
  user = { id: USER_ID, email: "client@example.com", email_confirmed_at: "2026-09-09T10:00:00Z" };
  profile = null; orders = []; writes = []; dbFailure = null; authFailure = false; submitted = null;
});
after(() => { hooks.deregister(); delete globals.__profileAccount; });
const request = (path: string, body: unknown) => new NextRequest(`http://fixture.example${path}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const legacy = (id: string, email = "client@example.com", owner: string | null = null): Order =>
  ({ id, user_id: owner, client_email: email, client_phone: "historic-phone" });

test("profile upsert accepts name only and empty optional phone/company; browser identity and credentials are ignored", async () => {
  for (const optional of [{}, { phone: "", company_name: "" }, { phone: null, company_name: null }]) {
    const response = await upsert(request("/api/profile/upsert", {
      full_name: "Client", ...optional, email: "attacker@example.com", user_id: OTHER_ID, password: "never-forward",
    }));
    assert.equal(response.status, 200);
    assert.equal(profile?.user_id, USER_ID);
    assert.equal(profile?.full_name, "Client");
    for (const key of ["email", "password", "current_password"]) assert.ok(!(key in writes.at(-1)!.body));
  }
});

test("profile upsert rejects missing/whitespace name and accepts edits that clear optional fields", async () => {
  assert.equal((await upsert(request("/api/profile/upsert", { full_name: "  ", phone: "123" }))).status, 422);
  assert.equal(writes.length, 0);
  profile = { full_name: "Existing Client", phone: "123", company_name: "Company" };
  assert.equal((await upsert(request("/api/profile/upsert", { phone: "", company_name: "" }))).status, 200);
});

function orderRequest() {
  return request("/api/order", {
    submissionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", serviceType: "virtual-staging", currency: "USD",
    jobTitle: "Test property", termsAcceptance: { accepted: true }, earlyPerformanceRequest: { requested: true },
    items: [{ roomName: "Living room", furnitureStyle: "Modern" }],
    itemFiles: [{ original: { bucket: "order-files", path: `pending/${USER_ID}/aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa/0-original.jpg`, originalFilename: "room.jpg", size: 20, mimeType: "image/jpeg" } }],
    user_id: OTHER_ID, email: "spoof@example.com", contact: { name: "Spoof", email: "spoof@example.com", phone: "123456" },
  });
}

test("order accepts verified user with name only and sends compatible immutable snapshot to the order service", async () => {
  profile = { full_name: " Client ", phone: null, company_name: "" };
  const response = await order(orderRequest());
  assert.equal(response.status, 201, JSON.stringify(await response.json()));
  assert.equal(submitted?.ownerUserId, USER_ID);
  assert.deepEqual(submitted?.clientIdentity, { name: "Client", email: "client@example.com", phone: "", company: null });
});

test("order fails closed for missing name/session/email and never trusts browser contact identity", async () => {
  profile = { full_name: "  ", phone: "123" };
  assert.equal((await order(orderRequest())).status, 422);
  assert.equal(submitted, null);
  user = null;
  assert.equal((await order(orderRequest())).status, 401);
  user = { id: USER_ID, email: "" };
  profile = { full_name: "Client" };
  assert.equal((await order(orderRequest())).status, 422);
  assert.equal(submitted, null);
});

test("email preparation claims only exact matching NULL legacy rows and leaves all historical snapshots/owners unchanged", async () => {
  orders = [legacy("legacy-upper", "CLIENT@EXAMPLE.COM"), legacy("legacy"), legacy("other", "other@example.com"),
    legacy("already-owned", "old@example.com", USER_ID), legacy("other-owner", "client@example.com", OTHER_ID),
    legacy("padded-email", " client@example.com ")];
  const snapshots = structuredClone(orders);
  const response = await prepare();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { prepared: true, userId: USER_ID, email: "client@example.com" });
  for (const [i, row] of orders.entries()) {
    assert.deepEqual(row, { ...snapshots[i], user_id: i < 2 ? USER_ID : snapshots[i].user_id });
  }
  assert.equal(writes.length, 2);
  assert.equal((await prepare()).status, 200);
  assert.equal(writes.length, 2, "retry never updates already owned rows");
});

test("ownership pagination does not silently miss legacy orders beyond the response limit", async () => {
  orders = Array.from({ length: 205 }, (_, index) => legacy(String(index)));
  assert.equal((await prepare()).status, 200);
  assert.equal(writes.length, 205);
  assert.ok(orders.every((row) => row.user_id === USER_ID));
});

test("email pattern characters cannot claim a different email", async () => {
  for (const email of ["a_b@example.com", "a%b@example.com", "a*b@example.com", "a\\b@example.com"]) {
    user!.email = email;
    orders = [legacy("exact", email.toUpperCase()), legacy("other", "axb@example.com")];
    assert.equal((await prepare()).status, 200);
    assert.equal(orders[0].user_id, USER_ID);
    assert.equal(orders[1].user_id, null);
  }
});

test("email preparation fails closed on unverified/anonymous/missing session", async () => {
  orders = [legacy("legacy")];
  for (const invalid of [null, { id: USER_ID, email: "client@example.com" },
    { id: USER_ID, email: "client@example.com", email_confirmed_at: "confirmed", is_anonymous: true }]) {
    user = invalid;
    assert.equal((await prepare()).status, 401);
  }
  assert.equal(writes.length, 0);
});

test("email preparation fails closed on DB errors, unconfirmed updates, or another user's concurrent claim", async () => {
  for (const failure of ["read", "write", "unconfirmed", "race"] as const) {
    dbFailure = failure; orders = [legacy("legacy")];
    const response = await prepare();
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.ok(!body.prepared);
    assert.ok(!body.error.includes("private"));
    assert.equal(orders[0].user_id, failure === "race" ? OTHER_ID : null);
  }
});

test("browser-supplied ownership identity cannot affect preparation", async () => {
  orders = [legacy("real"), legacy("victim", "victim@example.com")];
  const invoke = prepare as (request?: Request) => Promise<Response>;
  const response = await invoke(request("/api/account/prepare-email-change?email=victim@example.com", {
    userId: OTHER_ID, currentEmail: "victim@example.com", password: "never-forward",
  }));
  assert.equal(response.status, 200);
  assert.equal(orders[0].user_id, USER_ID);
  assert.equal(orders[1].user_id, null);
});
