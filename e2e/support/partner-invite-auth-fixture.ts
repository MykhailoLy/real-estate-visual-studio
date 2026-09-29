// Loopback-only Supabase HTTP fixture. Real SDK, cookies, routes and components
// run against this process; no email, production account or order is created.
import { createServer, request as proxyRequest } from "node:http";
import { STAGING_STYLE_CARDS } from "../../src/data/order-options.ts";

const userId = "33333333-3333-4333-8333-333333333333";
const existingId = "11111111-1111-4111-8111-111111111111";
const makeUser = (id: string, email: string) => ({ id, email, aud: "authenticated", role: "authenticated",
  email_confirmed_at: "2026-09-09T10:00:00Z", new_email: "",
  created_at: "2026-09-09T10:00:00Z", app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { private_marker: "never-expose-invite-metadata" }, is_anonymous: false });
let users = [makeUser(existingId, "registered@example.com")];
let pricing: Record<string, unknown>[] = [];
let profile: Record<string, unknown> | null = null;
let mode = "success";
let passwordSet = false;
let inviteCalls = 0;
let redirectTo = "";
let passwordSignIns = 0;
let authenticatedUserReads = 0;
let unsupportedOperations: string[] = [];
let accountOrders: { id: string; user_id: string | null; client_email: string }[] = [];
let accountFailures = { ownership: false, email: false, password: false };
let emailChanges = 0;
let passwordChanges = 0;
let currentPasswordVerified = false;
const tokenPart = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const accessToken = `${tokenPart({ alg: "HS256", typ: "JWT" })}.${tokenPart({ sub: userId, exp: Math.floor(Date.now() / 1000) + 86400, role: "authenticated" })}.${Buffer.from("fixture-signature").toString("base64url")}`;

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:3200");
  // The isolated catalogue has no admin-managed style media. Supply only its
  // known fallback thumbnails so order-form QA retains strict console checks.
  if (req.method === "GET" && STAGING_STYLE_CARDS.some(({ imageSrc }) => imageSrc === url.pathname)) {
    res.writeHead(200, { "Content-Type": "image/svg+xml" });
    res.end('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><rect width="32" height="24" fill="#ddd"/></svg>');
    return;
  }
  if (!url.pathname.startsWith("/__fixture/") && !url.pathname.startsWith("/__supabase/")) {
    // Same-origin local proxy keeps the application's full production CSP
    // intact, including connect-src; no security headers are bypassed.
    const upstream = proxyRequest({ hostname: "127.0.0.1", port: 3202, path: req.url, method: req.method, headers: req.headers }, (response) => {
      const headers = { ...response.headers };
      // next start constructs absolute redirects with its internal listener's
      // origin. Keep those redirects on the fixture's public proxy origin.
      for (const name of ["location", "x-nextjs-redirect"]) {
        const value = headers[name];
        if (typeof value === "string") headers[name] = value.replace(/^http:\/\/(?:localhost|127\.0\.0\.1):3202(?=\/)/, "http://127.0.0.1:3200");
      }
      res.writeHead(response.statusCode ?? 502, headers); response.pipe(res);
    });
    upstream.on("error", () => { if (res.headersSent) res.destroy(); else res.writeHead(502).end(); });
    req.pipe(upstream); return;
  }
  url.pathname = url.pathname.replace(/^\/__supabase/, "");
  res.setHeader("X-Supabase-Api-Version", "2024-01-01");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  const json = (value: unknown, status = 200) => { res.writeHead(status).end(JSON.stringify(value)); };
  if (url.pathname === "/__fixture/health") { json({ ok: true }); return; }
  if (url.pathname === "/__fixture/reset") {
    users = [makeUser(existingId, "registered@example.com")]; pricing = []; profile = null;
    mode = body.mode ?? "success"; passwordSet = false; inviteCalls = 0; redirectTo = "";
    passwordSignIns = 0; authenticatedUserReads = 0; unsupportedOperations = [];
    accountOrders = body.accountOrders ?? [];
    accountFailures = { ownership: false, email: false, password: false };
    emailChanges = 0; passwordChanges = 0; currentPasswordVerified = false;
    if (mode === "password-login") {
      users.unshift(makeUser(userId, "root-client@example.com"));
      profile = body.profile ? { ...body.profile, id: userId, user_id: userId } : null;
    }
    json({ ok: true }); return;
  }
  if (url.pathname === "/__fixture/state") {
    json({ pricing, profile, passwordSet, inviteCalls, redirectTo, accessToken, userId,
      passwordSignIns, authenticatedUserReads, unsupportedOperations, accountOrders,
      emailChanges, passwordChanges, currentPasswordVerified }); return;
  }
  if (url.pathname === "/__fixture/account-failures") {
    accountFailures = { ...accountFailures, ...body }; json({ ok: true }); return;
  }
  if (url.pathname === "/__fixture/confirm-email") {
    const user = users.find((user) => user.id === userId);
    if (user?.new_email) { user.email = user.new_email; user.new_email = ""; }
    json({ ok: true }); return;
  }
  // Password-grant stub for cross-root acceptance. The real browser SDK writes
  // cookies; the unchanged server gate must still call /auth/v1/user below.
  if (url.pathname === "/auth/v1/token" && req.method === "POST" &&
      url.searchParams.get("grant_type") === "password" && mode === "password-login" &&
      body.email === "root-client@example.com" && body.password === "fixture-password-only") {
    passwordSignIns++;
    json({ access_token: accessToken, refresh_token: "fixture-refresh-token", token_type: "bearer",
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: users.find((user) => user.id === userId) }); return;
  }
  if (url.pathname === "/auth/v1/invite") {
    inviteCalls++; redirectTo = url.searchParams.get("redirect_to") ?? "";
    if (mode === "conflict" || body.email === "registered@example.com") {
      json({ code: "email_exists", msg: "private provider conflict" }, 422); return;
    }
    users = [makeUser(userId, body.email), ...users.filter((user) => user.id !== userId)];
    json(users[0]); return;
  }
  if (url.pathname === "/auth/v1/admin/users") {
    res.setHeader("x-total-count", String(users.length));
    json({ users, total: users.length }); return;
  }
  if (url.pathname.startsWith("/auth/v1/admin/users/")) {
    json(users.find((user) => user.id === url.pathname.split("/").at(-1)) ?? null); return;
  }
  if (url.pathname === "/auth/v1/user") {
    if (req.headers.authorization !== `Bearer ${accessToken}`) {
      json({ code: "bad_jwt", msg: "Invalid fixture token" }, 401); return;
    }
    authenticatedUserReads++;
    if (req.method === "PUT") {
      if (typeof body.email === "string") {
        if (accountFailures.email) { json({ code: "email_exists", msg: "Unable to change email." }, 422); return; }
        // Assert ownership preparation preceded the real SDK email update.
        const user = users.find((user) => user.id === userId)!;
        if (accountOrders.some((order) => order.user_id === null && order.client_email.toLowerCase() === user.email.toLowerCase())) {
          json({ code: "fixture_ownership", msg: "Ownership was not prepared" }, 400); return;
        }
        emailChanges++; user.new_email = body.email;
      }
      if (typeof body.password === "string") {
        if (mode === "password-login") {
          if (accountFailures.password || body.current_password !== "fixture-password-only") {
            json({ code: "invalid_credentials", msg: "Current password is incorrect." }, 422); return;
          }
          currentPasswordVerified = true; passwordChanges++;
        }
        passwordSet = body.password.length >= 8;
      }
    }
    json(users.find((user) => user.id === userId)); return;
  }
  if (url.pathname === "/rest/v1/account_pricing") {
    if (req.method === "POST") {
      if (mode === "partial") { json({ code: "fixture", message: "private pricing write failure" }, 503); return; }
      pricing = pricing.filter((row) => row.user_id !== body.user_id).concat(body);
      json(null, 201); return;
    }
    const id = url.searchParams.get("user_id");
    json(id?.startsWith("eq.") ? pricing.filter((row) => row.user_id === id.slice(3)) : pricing); return;
  }
  if (url.pathname === "/rest/v1/client_profiles") {
    if (req.method === "POST") { profile = { ...body, id: userId }; json(profile, 201); return; }
    json(profile ? [profile] : []); return;
  }
  if (url.pathname === "/rest/v1/orders" && mode === "password-login" &&
      req.headers.authorization === "Bearer isolated-fixture-service-role") {
    if (accountFailures.ownership) { json({ message: "fixture ownership failure" }, 503); return; }
    if (req.method === "GET" && url.searchParams.get("user_id") === "is.null" &&
        url.searchParams.get("client_email")?.startsWith("ilike.")) {
      const email = url.searchParams.get("client_email")!.slice(6).replace(/\\([\\%_])/g, "$1").toLowerCase();
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 100);
      json(accountOrders.filter((row) => row.user_id === null && row.client_email.toLowerCase() === email).slice(offset, offset + limit)); return;
    }
    if (req.method === "PATCH" && Object.keys(body).length === 1 && body.user_id === userId &&
        url.searchParams.get("user_id") === "is.null" && url.searchParams.get("id")?.startsWith("eq.") &&
        url.searchParams.get("client_email")?.startsWith("eq.")) {
      const row = accountOrders.find((row) => row.id === url.searchParams.get("id")!.slice(3) &&
        row.user_id === null && row.client_email === url.searchParams.get("client_email")!.slice(3));
      if (row) row.user_id = userId;
      json(row ? [{ id: row.id, user_id: row.user_id }] : []); return;
    }
  }
  // Listing dashboard drafts first recovers stale claims. This fixture has no
  // drafts to recover; accept only the authenticated fixture user's list call.
  if (req.method === "POST" && url.pathname === "/rest/v1/rpc/recover_stale_order_draft_finalization" &&
      mode === "password-login" && body.p_user_id === userId && body.p_draft_id === null &&
      req.headers.authorization === "Bearer isolated-fixture-service-role") {
    json([]); return;
  }
  // Public/build and dashboard reads have empty, isolated data. Never permit
  // unknown writes, particularly order/payment/storage operations.
  if (req.method === "GET" && url.pathname.startsWith("/rest/v1/")) {
    if (req.headers.prefer?.includes("count=")) res.setHeader("content-range", "*/0");
    json([]); return;
  }
  unsupportedOperations.push(`${req.method} ${url.pathname}`);
  json({ error: "Unsupported fixture operation" }, 400);
}).listen(3200, "127.0.0.1");
