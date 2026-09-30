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
let reads: URL[];
let returnedCandidateIds: string[];
let dbFailure: "read" | "write" | "unconfirmed" | "race" | "email-race" | "scan-race" | "remaining" | null;
let authFailure: boolean;
let submitted: Record<string, unknown> | null;

// Model the PostgREST ILIKE filter, including its '*' wildcard alias. Only the
// route's authoritative ownership predicate may decide which candidates to claim.
function matchesIlike(value: string, pattern: string): boolean {
  const special = "\\^$.*+?()[]{}|";
  let expression = "";
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    if (character === "\\" && index + 1 < pattern.length) {
      const literal = pattern[++index];
      expression += (special.includes(literal) ? "\\" : "") + literal;
    } else if (character === "%" || character === "*") expression += "[\\s\\S]*";
    else if (character === "_") expression += "[\\s\\S]";
    else expression += (special.includes(character) ? "\\" : "") + character;
  }
  return new RegExp(`^${expression}$`, "i").test(value);
}

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
      reads.push(url);
      if (dbFailure === "read") return json({ message: "private DB failure" }, 503);
      assert.equal(url.searchParams.get("user_id"), "is.null");
      const filter = url.searchParams.get("client_email");
      const escapedEmail = user!.email.trim().replace(/([\\%_])/g, "\\$1");
      assert.equal(filter, `ilike.%${escapedEmail}%`, "every page must filter by the escaped verified email, including the final check");
      assert.equal(url.searchParams.get("order"), "id.asc");
      assert.equal(url.searchParams.has("offset"), false);
      if (dbFailure === "scan-race" && reads.length === 2) {
        for (const row of orders.filter((order) => order.client_email === "prefix-client@example.com")) row.user_id = OTHER_ID;
      }
      if (dbFailure === "remaining" && writes.length > 0 && !orders.some((row) => row.id === "late-legacy")) {
        orders.push({ id: "late-legacy", user_id: null, client_email: " CLIENT@example.com ", client_phone: "historic-phone" });
      }
      const afterId = url.searchParams.get("id")?.slice(3);
      const limit = Number(url.searchParams.get("limit") ?? 100);
      const candidates = orders.filter((order) => order.user_id === null && (!afterId || order.id > afterId) &&
        matchesIlike(order.client_email, filter!.slice(6)))
        .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).slice(0, limit);
      returnedCandidateIds.push(...candidates.map((row) => row.id));
      return json(candidates);
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
    if (dbFailure === "email-race" && row) row.client_email = ` ${row.client_email.toUpperCase()} `;
    if (!row || dbFailure === "unconfirmed" || dbFailure === "race" || dbFailure === "email-race") return json([]);
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
  profile = null; orders = []; writes = []; reads = []; returnedCandidateIds = []; dbFailure = null; authFailure = false; submitted = null;
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

test("email preparation claims case-only and whitespace-padded NULL legacy matches without changing historical snapshots or other owners", async () => {
  orders = [legacy("legacy-upper", "CLIENT@EXAMPLE.COM"), legacy("legacy"), legacy("other", "other@example.com"),
    legacy("already-owned", "old@example.com", USER_ID), legacy("other-owner", "client@example.com", OTHER_ID),
    legacy("padded-email", " client@example.com "), legacy("padded-mixed-email", "\tCLIENT@example.com\n"),
    legacy("already-owned-matching", " client@example.com ", USER_ID),
    legacy("substring", "prefix-client@example.com"), legacy("suffix", "client@example.com.invalid"),
    legacy("other-owner-padded", " CLIENT@example.com ", OTHER_ID), legacy("empty-owner", "client@example.com", "")];
  const snapshots = structuredClone(orders);
  const claimedIds = new Set(["legacy-upper", "legacy", "padded-email", "padded-mixed-email"]);
  const response = await prepare();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { prepared: true, userId: USER_ID, email: "client@example.com" });
  for (const [i, row] of orders.entries()) {
    assert.deepEqual(row, { ...snapshots[i], user_id: claimedIds.has(row.id) ? USER_ID : snapshots[i].user_id });
  }
  assert.equal(writes.length, 4);
  for (const write of writes) {
    const id = write.url.searchParams.get("id")?.slice(3);
    const snapshot = snapshots.find((row) => row.id === id)!;
    assert.equal(write.url.searchParams.get("client_email"), `eq.${snapshot.client_email}`, "claims retain the exact raw email guard");
  }
  assert.equal((await prepare()).status, 200);
  assert.equal(writes.length, 4, "retry never updates already owned rows");
});

test("ownership pagination does not silently miss legacy orders beyond the response limit", async () => {
  orders = Array.from({ length: 410 }, (_, index) => legacy(String(index).padStart(4, "0"),
    index % 2 === 0 ? " client@example.com " : "prefix-client@example.com"));
  assert.equal((await prepare()).status, 200);
  assert.equal(writes.length, 205);
  assert.ok(orders.every((row, index) => row.user_id === (index % 2 === 0 ? USER_ID : null)));
  assert.ok(reads.some((url) => url.searchParams.get("id")?.startsWith("gt.")), "later pages use a stable ID cursor");
});

test("concurrent claims of earlier unrelated candidates do not shift later legacy matches out of pagination", async () => {
  orders = Array.from({ length: 230 }, (_, index) => legacy(String(index).padStart(4, "0"),
    index < 100 ? "prefix-client@example.com" : " client@example.com "));
  dbFailure = "scan-race";
  assert.equal((await prepare()).status, 200);
  assert.equal(writes.length, 130);
  assert.ok(orders.every((row, index) => row.user_id === (index < 100 ? OTHER_ID : USER_ID)));
});

test("email pattern characters cannot claim a different email", async () => {
  for (const email of ["a_b@example.com", "a%b@example.com", "a*b@example.com", "a\\b@example.com", "a+b@example.com", "o'connor@example.com"]) {
    user!.email = email;
    orders = [legacy("exact", ` ${email.toUpperCase()} `), legacy("other", "axb@example.com"),
      legacy("substring", `prefix-${email}`)];
    assert.equal((await prepare()).status, 200);
    assert.equal(orders[0].user_id, USER_ID);
    assert.equal(orders[1].user_id, null);
    assert.equal(orders[2].user_id, null);
  }
});

test("candidate filtering avoids downloading the global NULL-owner set and rejects substring matches", async () => {
  user!.email = " CLIENT@example.com ";
  orders = Array.from({ length: 2000 }, (_, index) => legacy(`unrelated-${index}`, `other-${index}@example.com`));
  orders.push(legacy("matching", "\tclient@example.com\n"), legacy("substring", "prefix-client@example.com"));
  assert.equal((await prepare()).status, 200);
  assert.equal(reads.length, 2, "one bounded candidate page plus the final recheck");
  assert.deepEqual(returnedCandidateIds, ["matching", "substring", "substring"]);
  assert.equal(writes.length, 1);
  assert.equal(orders.find((row) => row.id === "matching")?.user_id, USER_ID);
  assert.ok(orders.filter((row) => row.id !== "matching").every((row) => row.user_id === null));
});

test("email preparation fails closed on unverified/anonymous/missing session", async () => {
  orders = [legacy("legacy")];
  for (const invalid of [null, { id: USER_ID, email: "client@example.com" },
    { id: USER_ID, email: " \t ", email_confirmed_at: "confirmed" },
    { id: USER_ID, email: "client@example.com", email_confirmed_at: "confirmed", is_anonymous: true }]) {
    user = invalid;
    assert.equal((await prepare()).status, 401);
  }
  assert.equal(writes.length, 0);
});

test("email preparation fails closed on DB errors, unconfirmed updates, or another user's concurrent claim", async () => {
  for (const failure of ["read", "write", "unconfirmed", "race", "email-race"] as const) {
    dbFailure = failure; orders = [legacy("legacy")];
    const response = await prepare();
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.ok(!body.prepared);
    assert.ok(!body.error.includes("private"));
    assert.equal(orders[0].user_id, failure === "race" ? OTHER_ID : null);
  }
});

test("email preparation fails closed when a matching padded legacy row remains after claims", async () => {
  orders = [legacy("legacy")];
  dbFailure = "remaining";
  const response = await prepare();
  assert.equal(response.status, 503);
  assert.ok(!(await response.json()).prepared);
  assert.equal(orders[0].user_id, USER_ID);
  assert.equal(orders.find((row) => row.id === "late-legacy")?.user_id, null);
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
