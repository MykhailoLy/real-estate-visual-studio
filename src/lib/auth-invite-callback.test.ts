import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { beforeEach, after } from "node:test";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let authenticated = false;
let profile: { full_name: string; phone: string } | null = null;
let profileThrows = false;
let exchangeFails = false;
let userThrows = false;
let calls: string[] = [];
const globals = globalThis as typeof globalThis & { __inviteCallbackSupabase?: unknown };
globals.__inviteCallbackSupabase = {
  auth: {
    async exchangeCodeForSession(code: string) {
      calls.push(`exchange:${code}`);
      authenticated = !exchangeFails;
      return { error: exchangeFails ? { message: "Invalid code" } : null };
    },
    async getUser() {
      calls.push("verify-session");
      if (userThrows) throw new Error("private Auth transport failure");
      return { data: { user: authenticated ? { id: "11111111-1111-4111-8111-111111111111" } : null }, error: null };
    },
  },
  from(table: string) {
    assert.equal(table, "client_profiles"); calls.push("profile");
    return { select() { return this; }, async maybeSingle() {
      if (profileThrows) throw new Error("offline");
      return { data: profile, error: null };
    } };
  },
};
registerHooks({ resolve(specifier, context, nextResolve) {
  const mocks: Record<string, string> = {
    "server-only": "export default undefined",
    "@supabase/ssr": "export function createServerClient(){return globalThis.__inviteCallbackSupabase}",
    "next/headers": "export async function cookies(){return {getAll(){return []},set(){}}}",
  };
  if (mocks[specifier]) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
  if (specifier.startsWith("@/lib/")) return { url: new URL(`./${specifier.slice(6)}.ts`, import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
} });
const { GET } = await import("../app/auth/callback/route.ts");
const { NextRequest } = await import("next/server.js");
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  authenticated = false; profile = null; profileThrows = false; exchangeFails = false; userThrows = false; calls = [];
});
after(() => {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  delete globals.__inviteCallbackSupabase;
});
async function destination(query: string) {
  return (await GET(new NextRequest(`http://localhost/auth/callback${query}`))).headers.get("location");
}

test("invite marker or browser email cannot authenticate or assign Partner", async () => {
  assert.equal(await destination("?type=invite&email=future@example.com&partnerClient=true"), "http://localhost/login");
  assert.deepEqual(calls, ["verify-session"]);
});

test("invite Auth verification exceptions fail closed to login", async () => {
  authenticated = true; userThrows = true;
  assert.equal(await destination("?type=invite"), "http://localhost/login");
  assert.deepEqual(calls, ["verify-session"]);
});

test("accepted invite with verified session routes missing/incomplete profiles to onboarding with safe next", async () => {
  authenticated = true;
  for (const current of [null, { full_name: "Future Client", phone: "" }]) {
    profile = current;
    assert.equal(await destination("?type=invite&next=%2Fdashboard%2Forders%2Fnew%2Fvirtual-staging"),
      "http://localhost/dashboard/profile?onboarding=1&next=%2Fdashboard%2Forders%2Fnew%2Fvirtual-staging");
  }
  assert.ok(!calls.some((call) => call.startsWith("exchange:")));
});

test("accepted invite with completed profile reaches dashboard or intended internal route", async () => {
  authenticated = true; profile = { full_name: "Future Client", phone: "+34 600 000 000" };
  assert.equal(await destination("?type=invite"), "http://localhost/dashboard");
  assert.equal(await destination("?type=invite&next=%2Fdashboard%2Fjobs"), "http://localhost/dashboard/jobs");
  for (const next of ["https://evil.example", "//evil.example", "/\\evil.example", "/\nevil"]) {
    assert.equal(await destination(`?type=invite&next=${encodeURIComponent(next)}`), "http://localhost/dashboard");
  }
});

test("invite profile lookup exceptions lead to onboarding", async () => {
  authenticated = true; profileThrows = true;
  assert.equal(await destination("?type=invite"), "http://localhost/dashboard/profile?onboarding=1");
});

test("existing signup/confirmation and default magic-link PKCE flows retain onboarding and next", async () => {
  for (const type of ["", "&type=signup"]) {
    profile = null;
    assert.equal(await destination(`?code=valid${type}`), "http://localhost/dashboard/profile?onboarding=1");
    profile = { full_name: "Client", phone: "123" };
    assert.equal(await destination(`?code=valid${type}&next=%2Fdashboard%2Fjobs`), "http://localhost/dashboard/jobs");
  }
  assert.equal(calls.filter((call) => call === "exchange:valid").length, 4);
});

test("recovery still exchanges its code and reaches password reset without profile routing", async () => {
  assert.equal(await destination("?code=valid&type=recovery&next=%2Fdashboard%2Fjobs"), "http://localhost/reset-password");
  assert.deepEqual(calls, ["exchange:valid"]);
});

test("missing/failed codes and forwarded errors retain safe login failure", async () => {
  assert.equal(await destination(""), "http://localhost/login");
  assert.equal(await destination("?type=recovery"), "http://localhost/login");
  exchangeFails = true;
  assert.equal(await destination("?code=invalid"), "http://localhost/login?error=Invalid+code");
  assert.equal(await destination("?error=access_denied"), "http://localhost/login?error=access_denied");
});
