import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";

let admin = false;
let accountUserId: string | null = "11111111-1111-4111-8111-111111111111";
let failWrite = false;
let updates: Record<string, unknown>[] = [];
const orderId = "22222222-2222-4222-8222-222222222222";
const globals = globalThis as typeof globalThis & { __partnerAdmin?: () => boolean; __partnerSupabase?: unknown };
globals.__partnerAdmin = () => admin;
globals.__partnerSupabase = {
  auth: { admin: { async getUserById(id: string) {
    assert.equal(id, accountUserId);
    return { data: { user: { id } }, error: null };
  } } },
  from(table: string) {
    if (table === "orders") return { select() { return this; }, eq(column: string, value: string) {
      assert.equal(column, "id"); assert.equal(value, orderId); return this;
    }, async maybeSingle() { return { data: { user_id: accountUserId }, error: null }; } };
    assert.equal(table, "account_pricing");
    return { select() { return this; }, eq() { return this; },
      async maybeSingle() { return { data: null, error: null }; },
      async upsert(row: Record<string, unknown>, options: { onConflict: string }) {
      assert.equal(options.onConflict, "user_id");
      if (!failWrite) updates.push(row);
      return { error: failWrite ? { message: "offline" } : null };
    } };
  },
};

registerHooks({ resolve(specifier, context, nextResolve) {
  const mocks: Record<string, string> = {
    "server-only": "export default undefined;",
    "@/lib/admin-auth": "export async function isAdminAuthenticated() { return globalThis.__partnerAdmin(); }",
    "@/lib/supabase-admin": "export function getSupabaseAdminClient() { return globalThis.__partnerSupabase; }",
  };
  if (mocks[specifier]) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
  if (specifier === "@/lib/admin-clients-server") return { url: new URL("./admin-clients-server.ts", import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { getPartnerClient, AccountPricingError } = await import("./account-pricing-server.ts");
const { POST } = await import("../app/(public)/api/admin/orders/[orderId]/partner-pricing/route.ts");

function lookup(data: unknown, error: unknown = null) {
  return { from(table: string) {
    assert.equal(table, "account_pricing");
    return { select(columns: string) { assert.equal(columns, "partner_client"); return this; },
      eq(column: string, userId: string) { assert.equal(column, "user_id"); assert.equal(userId, accountUserId); return this; },
      async maybeSingle() { return { data, error }; },
    };
  } };
}

test("missing pricing row is ordinary; only a trusted boolean enables Partner", async () => {
  for (const [row, expected] of [[null, false], [{ partner_client: false }, false], [{ partner_client: true }, true]] as const) {
    assert.equal(await getPartnerClient(accountUserId!, lookup(row) as never), expected);
  }
  for (const row of [{ partner_client: "true" }, {}, undefined]) {
    await assert.rejects(getPartnerClient(accountUserId!, lookup(row) as never), AccountPricingError);
  }
  await assert.rejects(getPartnerClient(accountUserId!, lookup(null, { message: "offline" }) as never), AccountPricingError);
  await assert.rejects(getPartnerClient(accountUserId!, { from() { throw new Error("offline"); } } as never), AccountPricingError);
});

async function request(body: unknown) {
  return POST(new Request("http://localhost/api/admin/orders/" + orderId + "/partner-pricing", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ orderId }) });
}

test("customers cannot mutate Partner status without admin authorization", async () => {
  admin = false; updates = [];
  assert.equal((await request({ partnerClient: true })).status, 401);
  assert.equal(updates.length, 0);
});

test("admin changes only the server-resolved account boolean; flags/rates/identity extras are rejected", async () => {
  admin = true; updates = [];
  for (const body of [{ partnerClient: true, user_id: "other" }, { partnerClient: true, rate: 50 }, { partnerClient: "true" }]) {
    assert.equal((await request(body)).status, 400);
  }
  assert.equal(updates.length, 0);
  for (const partnerClient of [true, false]) {
    const response = await request({ partnerClient });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { partnerClient });
    assert.deepEqual(Object.keys(updates.at(-1)!).sort(), ["partner_client", "updated_at", "user_id"]);
    assert.equal(updates.at(-1)?.user_id, accountUserId);
    assert.equal(updates.at(-1)?.partner_client, partnerClient);
  }
});

test("unlinked accounts and failed writes never alter orders or profiles", async () => {
  admin = true; updates = [];
  const originalUserId = accountUserId;
  accountUserId = null;
  assert.equal((await request({ partnerClient: true })).status, 409);
  accountUserId = originalUserId;
  failWrite = true;
  assert.equal((await request({ partnerClient: true })).status, 503);
  failWrite = false;
  assert.deepEqual(updates, []);
});

test("migration enables RLS and grants no direct client read/write or policies", () => {
  const sql = readFileSync("supabase/add-account-pricing.sql", "utf8").replace(/--[^\n]*/g, "");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.account_pricing/);
  assert.match(sql, /user_id UUID PRIMARY KEY REFERENCES auth\.users\(id\)/);
  assert.match(sql, /partner_client BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(sql, /ALTER TABLE public\.account_pricing ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.account_pricing\s+FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.account_pricing TO service_role/);
  assert.doesNotMatch(sql, /CREATE POLICY|SECURITY DEFINER|DROP TABLE|ALTER TABLE public\.(orders|client_profiles)|INSERT INTO/i);
  assert.equal((sql.match(/GRANT /g) ?? []).length, 1);
});
