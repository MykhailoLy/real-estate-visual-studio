import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { beforeEach, after } from "node:test";
import type { User } from "@supabase/supabase-js";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let authenticated = false;
let profile: { full_name: string; phone: string } | null = null;
let profileThrows = false;
let exchangeFails = false;
let userThrows = false;
let userError = false;
let missingUser = false;
let user: Partial<User>;
const exchangedAccessToken = "EXCHANGED-ACCESS-TOKEN";
let exchangeHasSession = true;
let claims: { sub?: string; amr?: unknown } | null;
let claimsError = false;
let claimsThrows = false;
let verifiedTokens: { user: (string | undefined)[]; claims: (string | undefined)[] };
let resendMode: "ok" | "unavailable" | "error" | "throws";
let afterThrows = false;
let deferred: (() => Promise<void>)[] = [];
type Email = { from: string; to: string; subject: string; text: string; html: string };
let sent: { payload: Email; options: { headers: { "Idempotency-Key": string } } }[] = [];
let calls: string[] = [];
const globals = globalThis as typeof globalThis & {
  __inviteCallbackSupabase?: unknown;
  __registrationResend?: unknown;
  __registrationAfter?: (callback: () => Promise<void>) => void;
};
globals.__registrationAfter = (callback) => {
  if (afterThrows) throw new Error("private scheduling failure");
  deferred.push(callback);
};
globals.__registrationResend = {
  getResendClient() {
    if (resendMode === "unavailable") return { ok: false, reason: "private configuration detail" };
    return { ok: true, client: { emails: { async send(payload: Email, options: { headers: { "Idempotency-Key": string } }) {
      sent.push({ payload, options });
      if (resendMode === "throws") throw new Error("private Resend transport error");
      return { error: resendMode === "error" ? { message: "private provider detail" } : null };
    } } } };
  },
  getAdminAddress() { calls.push("admin-address"); return "configured-admin@example.com"; },
  getFromAddress() { calls.push("from-address"); return "PicchuSpot <configured-from@example.com>"; },
};
globals.__inviteCallbackSupabase = {
  auth: {
    async exchangeCodeForSession(code: string) {
      calls.push(`exchange:${code}`);
      authenticated = !exchangeFails;
      return { data: {
        user: { email: "unverified-exchange@example.com" },
        session: exchangeHasSession ? { access_token: exchangedAccessToken } : null,
      }, error: exchangeFails ? { message: "Invalid code" } : null };
    },
    async getUser(token?: string) {
      verifiedTokens.user.push(token);
      calls.push("verify-session");
      if (userThrows) throw new Error("private Auth transport failure");
      return { data: { user: authenticated && !missingUser ? user : null }, error: userError ? { message: "private verification failure" } : null };
    },
    async getClaims(token?: string) {
      verifiedTokens.claims.push(token);
      if (claimsThrows) throw new Error("private claims transport failure");
      // An older cookie session could still have signup AMR. Only the token
      // from this code exchange describes the callback being processed.
      const tokenClaims = token === exchangedAccessToken ? claims : { sub: user.id, amr: [{ method: "email/signup" }] };
      return { data: tokenClaims ? { claims: tokenClaims } : null, error: claimsError ? { message: "invalid signature" } : null };
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
    "next/server": `export { NextRequest, NextResponse } from ${JSON.stringify(new URL("../../node_modules/next/server.js", import.meta.url).href)}; export function after(callback){globalThis.__registrationAfter(callback)}`,
    "@/lib/email/resend-client": "export const {getResendClient,getAdminAddress,getFromAddress}=globalThis.__registrationResend",
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
  userError = false; missingUser = false; resendMode = "ok"; deferred = []; sent = []; afterThrows = false;
  exchangeHasSession = true; claimsError = false; claimsThrows = false;
  verifiedTokens = { user: [], claims: [] };
  user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "verified-client@example.com",
    created_at: "2026-10-06T08:00:00.000Z",
    email_confirmed_at: "2026-10-06T08:05:00.000Z",
    is_anonymous: false,
    user_metadata: { full_name: "Verified Client", password: "PRIVATE-PASSWORD", token: "PRIVATE-TOKEN" },
  };
  claims = { sub: user.id, amr: [{ method: "email/signup", timestamp: 1791273900 }] };
});
after(() => {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  delete globals.__inviteCallbackSupabase;
  delete globals.__registrationResend;
  delete globals.__registrationAfter;
});
async function destination(query: string) {
  return (await GET(new NextRequest(`http://localhost/auth/callback${query}`))).headers.get("location");
}
async function deliver() {
  for (const callback of deferred.splice(0)) await callback();
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
  for (const current of [null, { full_name: "  ", phone: "123" }]) {
    profile = current;
    assert.equal(await destination("?type=invite&next=%2Fdashboard%2Forders%2Fnew%2Fvirtual-staging"),
      "http://localhost/dashboard/profile?onboarding=1&next=%2Fdashboard%2Forders%2Fnew%2Fvirtual-staging");
  }
  assert.ok(!calls.some((call) => call.startsWith("exchange:")));
});

test("accepted invite with completed profile reaches dashboard or intended internal route", async () => {
  authenticated = true; profile = { full_name: "Future Client", phone: "" };
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

for (const type of ["", "&type=signup"]) {
  test(`public signup confirmation sends one admin email after redirect (${type || "PKCE"})`, async () => {
    const location = await destination(`?code=PRIVATE-CODE&flow=signup${type}&email=browser@example.com&name=Browser&next=%2Fdashboard%2Fjobs`);
    assert.equal(location, "http://localhost/dashboard/profile?onboarding=1&next=%2Fdashboard%2Fjobs");
    assert.deepEqual(calls, ["exchange:PRIVATE-CODE", "verify-session", "profile"]);
    assert.deepEqual(verifiedTokens, { user: [exchangedAccessToken], claims: [exchangedAccessToken] });
    assert.equal(sent.length, 0, "delivery does not block the redirect");
    assert.equal(deferred.length, 1);
    await deliver();
    assert.equal(sent.length, 1);
    const { payload, options } = sent[0];
    assert.equal(payload.to, "configured-admin@example.com");
    assert.equal(payload.from, "PicchuSpot <configured-from@example.com>");
    assert.ok(calls.includes("admin-address"));
    assert.ok(calls.includes("from-address"));
    assert.equal(payload.subject, "New client registered — Verified Client");
    for (const body of [payload.text, payload.html]) {
      assert.ok(body.includes("Verified Client"));
      assert.ok(body.includes("verified-client@example.com"));
      assert.ok(body.includes("2026-10-06T08:00:00.000Z"));
      assert.ok(body.includes("https://picchuspot.com/admin/clients"));
    }
    assert.doesNotMatch(JSON.stringify(payload), /PRIVATE-PASSWORD|PRIVATE-TOKEN|PRIVATE-CODE|EXCHANGED-ACCESS-TOKEN|browser@example.com|unverified-exchange/);
    assert.equal(options.headers["Idempotency-Key"], `client-registration-${user.id}`);
    await deliver();
    assert.equal(sent.length, 1);
    // The one-time Auth code cannot send another notification when replayed.
    exchangeFails = true;
    assert.equal(await destination(`?code=PRIVATE-CODE&flow=signup${type}`), "http://localhost/login?error=Invalid+code");
    await deliver();
    assert.equal(sent.length, 1);
  });
}

test("recovery, invite, default/magic-link and unmarked signup callbacks never notify", async () => {
  for (const query of [
    "?code=valid", "?code=valid&type=signup", "?code=valid&type=magiclink",
    "?code=valid&type=recovery", "?code=valid&type=invite",
    "?code=valid&type=recovery&flow=signup", "?code=valid&type=invite&flow=signup",
    "?code=valid&type=magiclink&flow=signup", "?code=valid&type=login&flow=signup",
  ]) {
    await destination(query);
    assert.equal(deferred.length, 0, query);
  }
  authenticated = true;
  await destination("?type=invite&flow=signup");
  await deliver();
  assert.equal(sent.length, 0);
});

test("existing confirmed account cannot spoof signup with flow=signup on a valid default magic-link PKCE callback", async () => {
  user.created_at = "2025-01-01T08:00:00.000Z";
  user.email_confirmed_at = "2025-01-01T08:05:00.000Z";
  user.last_sign_in_at = "2026-10-06T08:05:00.000Z";
  claims = { sub: user.id, amr: [{ method: "magiclink", timestamp: 1791273900 }] };
  profile = { full_name: "Existing Client", phone: "" };
  assert.equal(await destination("?code=valid&flow=signup"), "http://localhost/dashboard");
  assert.equal(authenticated, true);
  assert.ok(calls.includes("verify-session"));
  assert.equal(deferred.length, 0, "a valid existing-user session is not a signup event");
  await deliver();
  assert.equal(sent.length, 0);
});

test("spoofed signup query/metadata cannot override verified magic-link, recovery, invite, email-change or login AMR", async () => {
  // Even newly created/just-confirmed account timestamps cannot prove the flow.
  user.user_metadata = { full_name: "Client", flow: "signup", amr: [{ method: "email/signup" }] };
  for (const method of ["magiclink", "recovery", "invite", "email_change", "password", "otp", "oauth"]) {
    claims = { sub: user.id, amr: [{ method, timestamp: 1791273900 }] };
    for (const queryType of ["", "&type=signup"]) {
      assert.equal(await destination(`?code=valid&flow=signup${queryType}&amr=email%2Fsignup`), "http://localhost/dashboard/profile?onboarding=1");
      assert.equal(deferred.length, 0, method);
    }
  }
  assert.equal(sent.length, 0);
});

test("missing/malformed signup evidence and a different verified subject fail closed for notification only", async () => {
  for (const amr of [undefined, null, [], "email/signup", { method: "email/signup" }, [null], ["signup"], [{ method: "signup" }]]) {
    claims = { sub: user.id, amr };
    assert.equal(await destination("?code=valid&flow=signup"), "http://localhost/dashboard/profile?onboarding=1");
    assert.equal(deferred.length, 0);
  }
  for (const invalidClaims of [null, { amr: ["email/signup"] }, { sub: "another-user", amr: ["email/signup"] }]) {
    claims = invalidClaims;
    await destination("?code=valid&flow=signup");
    assert.equal(deferred.length, 0);
  }
  assert.equal(sent.length, 0);
});

test("verified signup AMR supports the SDK string-array representation without a timestamp heuristic", async () => {
  // The confirmation may occur long after signup. Auth's event, not account age,
  // determines whether this exchange represents an email signup confirmation.
  user.created_at = "2025-01-01T08:00:00.000Z";
  claims = { sub: user.id, amr: ["email/signup"] };
  await destination("?code=valid&flow=signup");
  await deliver();
  assert.equal(sent.length, 1);
});

test("unverifiable claims never schedule email or change successful onboarding/redirects", async () => {
  for (const failure of ["error", "throws"] as const) {
    claimsError = failure === "error";
    claimsThrows = failure === "throws";
    for (const completed of [false, true]) {
      profile = completed ? { full_name: "Client", phone: "" } : null;
      assert.equal(await destination("?code=valid&flow=signup&next=%2Fdashboard%2Fjobs"), completed
        ? "http://localhost/dashboard/jobs"
        : "http://localhost/dashboard/profile?onboarding=1&next=%2Fdashboard%2Fjobs");
      assert.equal(deferred.length, 0);
    }
  }
  assert.equal(sent.length, 0);
});

test("a successful exchange without a returned session never falls back to an older signup cookie", async () => {
  exchangeHasSession = false;
  assert.equal(await destination("?code=valid&flow=signup"), "http://localhost/dashboard/profile?onboarding=1");
  assert.deepEqual(verifiedTokens, { user: [], claims: [] });
  assert.equal(deferred.length, 0);
  assert.equal(sent.length, 0);
});

test("missing/expired codes and forwarded confirmation failures never schedule notification", async () => {
  for (const query of ["?flow=signup", "?flow=signup&type=signup", "?flow=signup&code=valid&error=expired"]) {
    await destination(query);
    assert.equal(deferred.length, 0);
  }
  exchangeFails = true;
  await destination("?code=expired&flow=signup");
  assert.equal(deferred.length, 0);
  assert.equal(sent.length, 0);
});

test("missing, anonymous, unconfirmed, invited or unverifiable identities never notify", async () => {
  const confirmedUser = user;
  for (const override of [
    { id: "" }, { email: undefined }, { email: "" }, { email_confirmed_at: undefined },
    { is_anonymous: true }, { invited_at: "2026-10-05T08:00:00.000Z" },
  ]) {
    user = { ...confirmedUser, ...override };
    assert.equal(await destination("?code=valid&flow=signup"), "http://localhost/dashboard/profile?onboarding=1");
    assert.equal(deferred.length, 0);
  }
  user = confirmedUser;
  missingUser = true;
  await destination("?code=valid&flow=signup");
  assert.equal(deferred.length, 0);
  missingUser = false;
  userError = true;
  await destination("?code=valid&flow=signup");
  assert.equal(deferred.length, 0);
  userError = false; userThrows = true;
  await destination("?code=valid&flow=signup");
  assert.equal(deferred.length, 0);
  assert.equal(sent.length, 0);
});

for (const mode of ["unavailable", "error", "throws"] as const) {
  test(`Resend ${mode} preserves successful signup onboarding and next`, async () => {
    resendMode = mode;
    for (const completed of [false, true]) {
      profile = completed ? { full_name: "Client", phone: "" } : null;
      const response = await GET(new NextRequest("http://localhost/auth/callback?code=valid&flow=signup&next=%2Fdashboard%2Fjobs"));
      assert.equal(response.headers.get("location"), completed
        ? "http://localhost/dashboard/jobs"
        : "http://localhost/dashboard/profile?onboarding=1&next=%2Fdashboard%2Fjobs");
      await assert.doesNotReject(deliver());
      assert.doesNotMatch(await response.text(), /private|provider|Resend/);
    }
  });
}

test("notification scheduling failure preserves signup onboarding", async () => {
  afterThrows = true;
  assert.equal(await destination("?code=valid&flow=signup"), "http://localhost/dashboard/profile?onboarding=1");
  assert.equal(sent.length, 0);
});

test("registration email escapes name/email HTML and keeps sensitive metadata out", async () => {
  user.email = '<client&"test\'>@example.com';
  user.user_metadata = {
    full_name: '<script>alert("x")</script> & O\'Neil',
    password: "PRIVATE-PASSWORD", access_token: "PRIVATE-TOKEN", code: "PRIVATE-CODE",
  };
  await destination("?code=PRIVATE-CODE&flow=signup");
  await deliver();
  const { payload } = sent[0];
  assert.ok(payload.html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; O&#39;Neil"));
  assert.ok(payload.html.includes("&lt;client&amp;&quot;test&#39;&gt;@example.com"));
  assert.ok(payload.text.includes(user.email));
  assert.ok(payload.text.includes(user.user_metadata.full_name));
  assert.doesNotMatch(payload.html, /<script>|<client/);
  assert.doesNotMatch(JSON.stringify(payload), /PRIVATE-PASSWORD|PRIVATE-TOKEN|PRIVATE-CODE/);
});

test("missing/non-string display names fall back to verified email", async () => {
  for (const name of [undefined, "   ", { role: "admin" }]) {
    user.user_metadata = { full_name: name };
    await destination("?code=valid&flow=signup");
    await deliver();
    assert.equal(sent.at(-1)?.payload.subject, "New client registered — verified-client@example.com");
    assert.ok(sent.at(-1)?.payload.text.includes("Name: Not provided"));
  }
});
