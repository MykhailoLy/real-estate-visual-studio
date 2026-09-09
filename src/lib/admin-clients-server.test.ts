import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import test, { beforeEach, after } from "node:test";

const userId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const originalPassword = process.env.ADMIN_PASSWORD;
const cookies = new Map<string, { value: string }>();
type AuthFixture = { id: string; email?: string; created_at: string; user_metadata: Record<string, unknown>; is_anonymous?: boolean };
let users: AuthFixture[];
let profiles: Record<string, unknown>[];
let pricing: Record<string, unknown>[];
let calls: string[];
let writes: Record<string, unknown>[];
let listError: boolean;
let authError: { status: number; code?: string } | null;
let pricingError: boolean;
let profileError: boolean;
let writeError: boolean;
let wrongIdentity: boolean;
const committedOrder = Object.freeze({ user_id: userId, estimated_total_cents: 11685 });

function user(id = userId): AuthFixture {
  return { id, email: "registered@example.com", created_at: "2026-09-09T10:00:00Z",
    user_metadata: { full_name: "Registered Client", private_marker: "never-render-auth-metadata" } };
}
const supabase = {
  auth: { admin: {
    async listUsers({ page, perPage }: { page: number; perPage: number }) {
      assert.equal(perPage, 50);
      calls.push(`list:${page}`);
      return { data: { users: users.slice((page - 1) * perPage, page * perPage), total: users.length, nextPage: 1 }, error: listError ? { message: "private provider detail" } : null };
    },
    async getUserById(id: string) {
      calls.push(`auth:${id}`);
      return { data: { user: wrongIdentity ? user(otherId) : users.find((entry) => entry.id === id) ?? null }, error: authError };
    },
  } },
  from(table: string) {
    calls.push(table);
    assert.ok(["client_profiles", "account_pricing", "orders"].includes(table));
    let selectedId = "";
    return {
      select(columns: string) {
        assert.equal(columns, table === "client_profiles" ? "user_id, first_name, last_name, full_name, company_name" : table === "orders" ? "user_id" : columns.includes("user_id") ? "user_id, partner_client" : "partner_client");
        return this;
      },
      eq(column: string, id: string) {
        assert.equal(column, table === "orders" ? "id" : "user_id");
        selectedId = id; return this;
      },
      async in(column: string, ids: string[]) {
        assert.equal(column, "user_id"); assert.ok(ids.length <= 50);
        return { data: (table === "client_profiles" ? profiles : pricing).filter((row) => ids.includes(String(row.user_id))),
          error: (table === "client_profiles" ? profileError : pricingError) ? { message: "unavailable" } : null };
      },
      async maybeSingle() {
        if (table === "orders") return { data: selectedId === orderId ? committedOrder : null, error: null };
        return { data: pricing.find((row) => row.user_id === selectedId) ?? null, error: pricingError ? { message: "unavailable" } : null };
      },
      async upsert(row: Record<string, unknown>, options: { onConflict: string }) {
        assert.equal(table, "account_pricing"); assert.equal(options.onConflict, "user_id");
        assert.deepEqual(Object.keys(row).sort(), ["partner_client", "updated_at", "user_id"]);
        if (writeError) return { error: { message: "private write failure" } };
        writes.push(row); pricing = pricing.filter((entry) => entry.user_id !== row.user_id).concat(row);
        return { error: null };
      },
    };
  },
};

const globals = globalThis as typeof globalThis & { __adminClientsCookies?: unknown; __adminClientsSupabase?: unknown };
globals.__adminClientsCookies = cookies;
globals.__adminClientsSupabase = supabase;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export default undefined", shortCircuit: true };
  if (specifier === "next/headers") return { url: "data:text/javascript,export async function cookies(){return globalThis.__adminClientsCookies}", shortCircuit: true };
  if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export function getSupabaseAdminClient(){return globalThis.__adminClientsSupabase}", shortCircuit: true };
  if (specifier.startsWith("@/lib/")) return { url: new URL(`./${specifier.slice(6)}.ts`, import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { ADMIN_COOKIE_NAME, buildSessionCookieValue, verifySessionCookieValue } = await import("./admin-auth.ts");
const { listAdminClients, setAdminClientPartner, parseAdminClientsPage, AdminClientsError } = await import("./admin-clients-server.ts");
const { getPartnerClient } = await import("./account-pricing-server.ts");
const { calculateOrderQuote } = await import("./pricing/calculate.ts");
const { POST } = await import("../app/(public)/api/admin/clients/[userId]/partner-pricing/route.ts");
const { POST: orderPOST } = await import("../app/(public)/api/admin/orders/[orderId]/partner-pricing/route.ts");

beforeEach(() => {
  process.env.ADMIN_PASSWORD = "isolated-admin-clients-test-password";
  cookies.clear(); users = [user()]; profiles = []; pricing = []; calls = []; writes = [];
  listError = false; authError = null; pricingError = false; profileError = false; writeError = false; wrongIdentity = false;
});
after(() => {
  if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = originalPassword;
  delete globals.__adminClientsCookies; delete globals.__adminClientsSupabase;
});
function admin() { cookies.set(ADMIN_COOKIE_NAME, { value: buildSessionCookieValue().value }); }
async function request(body: unknown = { partnerClient: true }, id = userId) {
  return POST(new Request("http://localhost/api/admin/clients/" + id + "/partner-pricing", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ userId: id }) });
}

test("anonymous, customer and forged admin sessions cannot list clients or mutate Partner", async () => {
  for (const cookie of [null, "customer-session", "9999999999.invalid-signature"]) {
    cookies.clear(); cookies.set("sb-test-auth-token", { value: "ordinary-customer-session" });
    if (cookie) cookies.set(ADMIN_COOKIE_NAME, { value: cookie });
    await assert.rejects(listAdminClients(1), (error: unknown) => error instanceof AdminClientsError && error.status === 401);
    await assert.rejects(setAdminClientPartner(userId, true), (error: unknown) => error instanceof AdminClientsError && error.status === 401);
    const response = await request();
    assert.equal(response.status, 401); assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(calls.length, 0); assert.equal(writes.length, 0);
  }
});

test("real admin session verification rejects expired and tampered cookies", () => {
  const value = buildSessionCookieValue().value;
  assert.equal(verifySessionCookieValue(value), true);
  assert.equal(verifySessionCookieValue(value.replace(/^\d+/, "1")), false);
  assert.equal(verifySessionCookieValue(value.replace(/\.[^.]+\./, ".invalid.")), false);
});

test("zero-order accounts appear with safe missing-profile/Partner fallbacks and whitelisted data", async () => {
  admin();
  const result = await listAdminClients(1);
  assert.deepEqual(result.clients, [{ userId, name: "Registered Client", email: "registered@example.com", company: null, joined: "2026-09-09T10:00:00Z", partnerClient: false }]);
  assert.equal(result.hasNextPage, false);
  assert.equal(calls.includes("orders"), false);
  assert.doesNotMatch(JSON.stringify(result), /private_marker|never-render|identities|session/);
  users = [{ ...user(), email: undefined, user_metadata: {} }];
  const missing = (await listAdminClients(1)).clients[0];
  assert.equal(missing.name, null); assert.equal(missing.email, null);
});

test("profile names/company and Partner status are joined by account identity", async () => {
  admin(); users.push({ ...user(otherId), email: "other@example.com" });
  profiles = [{ user_id: otherId, first_name: "Other", last_name: "Client", full_name: "", company_name: "Realty" }];
  pricing = [{ user_id: otherId, partner_client: true }];
  const { clients } = await listAdminClients(1);
  assert.equal(clients[0].partnerClient, false);
  assert.equal(clients[1].partnerClient, true);
  assert.equal(clients[1].name, "Other Client"); assert.equal(clients[1].company, "Realty");
});

test("Auth failures are explicit errors, and Partner failures cannot masquerade as OFF", async () => {
  admin(); listError = true;
  await assert.rejects(listAdminClients(1), (error: unknown) => error instanceof AdminClientsError && error.status === 503 && !error.message.includes("private"));
  listError = false; pricingError = true; profileError = true;
  const result = await listAdminClients(1);
  assert.equal(result.pricingUnavailable, true); assert.equal(result.profilesUnavailable, true);
  assert.equal(result.clients[0].partnerClient, null);
  const response = await request();
  assert.equal(response.status, 503); assert.equal(writes.length, 0);
  pricingError = false; pricing = [{ user_id: userId, partner_client: "true" }];
  assert.equal((await listAdminClients(1)).clients[0].partnerClient, null);
});

test("pagination stays bounded beyond page 9 and handles invalid and empty pages", async () => {
  admin(); users = Array.from({ length: 551 }, (_, index) => user(`account-${index}`));
  assert.equal((await listAdminClients(10)).clients.length, 50);
  assert.equal((await listAdminClients(10)).hasNextPage, true);
  assert.equal((await listAdminClients(12)).clients.length, 1);
  assert.equal((await listAdminClients(12)).hasNextPage, false);
  assert.equal((await listAdminClients(13)).clients.length, 0);
  for (const input of [undefined, "-1", "0", "1.5", "1e3", "1000001", ["1", "2"]]) assert.equal(parseAdminClientsPage(input), 1);
  assert.equal(parseAdminClientsPage("12"), 12);
  await assert.rejects(listAdminClients(0), AdminClientsError);
});

test("registered account with no orders can be enabled, receive first-order pricing, and disabled", async () => {
  admin();
  assert.equal((await request()).status, 200);
  assert.equal(writes[0].user_id, userId); assert.equal(writes[0].partner_client, true);
  assert.equal(calls.includes("orders"), false);
  const partnerClient = await getPartnerClient(userId, supabase as never);
  const quote = calculateOrderQuote({ serviceType: "virtual-staging", currency: "USD", items: [{ selectedAddons: [] }] }, { partnerClient });
  assert.equal(quote.partnerClient, true); assert.equal(quote.totalCents, 1350);
  const response = await request({ partnerClient: false });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { partnerClient: false });
  assert.equal(await getPartnerClient(userId, supabase as never), false);
});

test("invalid identity/body/percentage cannot write; missing account is 404", async () => {
  admin();
  for (const body of [{}, null, { partnerClient: "true" }, { partnerClient: true, percentage: 20 }, { partnerClient: true, user_id: otherId }, { partnerClient: true, company_name: "Changed" }]) {
    assert.equal((await request(body)).status, 400);
  }
  assert.equal((await request({ partnerClient: true }, "invalid")).status, 400);
  assert.equal((await request({ partnerClient: true }, otherId)).status, 404);
  authError = { status: 404, code: "user_not_found" };
  assert.equal((await request()).status, 404);
  assert.equal(writes.length, 0);
});

test("Auth lookup failures, identity mismatches and database failures return safe errors", async () => {
  admin(); authError = { status: 503 };
  assert.equal((await request()).status, 503);
  authError = null; wrongIdentity = true;
  assert.equal((await request()).status, 503);
  wrongIdentity = false; writeError = true;
  const response = await request();
  assert.equal(response.status, 503); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.doesNotMatch(await response.text(), /private write|provider/);
  assert.equal(writes.length, 0);
});

test("Order Detail shortcut and Clients share account mutation without altering committed totals", async () => {
  admin();
  const response = await orderPOST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ partnerClient: true }) }), { params: Promise.resolve({ orderId }) });
  assert.equal(response.status, 200);
  assert.ok(calls.includes(`auth:${userId}`));
  assert.equal((await listAdminClients(1)).clients[0].partnerClient, true);
  assert.equal((await request({ partnerClient: false })).status, 200);
  assert.equal(committedOrder.estimated_total_cents, 11685);
  assert.equal(writes.length, 2);
});

test("Clients page redirects unauthorized users and unavailable states render no control", () => {
  const page = readFileSync("src/app/(public)/admin/clients/page.tsx", "utf8");
  const list = readFileSync("src/components/admin/AdminClientsList.tsx", "utf8");
  assert.match(page, /listAdminClients\(page\)/);
  assert.match(page, /error\.status === 401\) redirect\("\/admin\/login"\)/);
  assert.match(page, /Registered clients could not be loaded/);
  assert.match(list, /client\.partnerClient === null \?/);
  assert.match(list, /Partner status unavailable/);
  assert.doesNotMatch(page + list, /auth\.users|service_role|user_metadata|\.from\("orders"\)/);
});
