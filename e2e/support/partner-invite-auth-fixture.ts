// Loopback-only Supabase HTTP fixture. Real SDK, cookies, routes and components
// run against this process; no email, production account or order is created.
import { createServer, request as proxyRequest } from "node:http";

const userId = "33333333-3333-4333-8333-333333333333";
const existingId = "11111111-1111-4111-8111-111111111111";
const makeUser = (id: string, email: string) => ({ id, email, aud: "authenticated", role: "authenticated",
  created_at: "2026-09-09T10:00:00Z", app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { private_marker: "never-expose-invite-metadata" }, is_anonymous: false });
let users = [makeUser(existingId, "registered@example.com")];
let pricing: Record<string, unknown>[] = [];
let profile: Record<string, unknown> | null = null;
let mode = "success";
let passwordSet = false;
let inviteCalls = 0;
let redirectTo = "";
const tokenPart = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const accessToken = `${tokenPart({ alg: "HS256", typ: "JWT" })}.${tokenPart({ sub: userId, exp: Math.floor(Date.now() / 1000) + 86400, role: "authenticated" })}.${Buffer.from("fixture-signature").toString("base64url")}`;

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:3200");
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
    json({ ok: true }); return;
  }
  if (url.pathname === "/__fixture/state") {
    json({ pricing, profile, passwordSet, inviteCalls, redirectTo, accessToken, userId }); return;
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
    if (req.method === "PUT") passwordSet = typeof body.password === "string" && body.password.length >= 8;
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
  // Public/build and dashboard reads have empty, isolated data. Never permit
  // unknown writes, particularly order/payment/storage operations.
  if (req.method === "GET" && url.pathname.startsWith("/rest/v1/")) {
    if (req.headers.prefer?.includes("count=")) res.setHeader("content-range", "*/0");
    json([]); return;
  }
  json({ error: "Unsupported fixture operation" }, 400);
}).listen(3200, "127.0.0.1");
