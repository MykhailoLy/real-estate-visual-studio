import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { ORDER_DRAFT_API_MAX_BODY_BYTES } from "../order-drafts/api.ts";
import { calculateOrderQuote } from "../pricing/calculate.ts";
import { STAGING_ADDON_IDS } from "../pricing/catalog.ts";
import { guestDraftRequest } from "./api.ts";
import {
  buildGuestState,
  CreateInput,
  GUEST_DRAFT_MAX_BYTES,
  GUEST_DRAFT_SIZE_ERROR,
  guestQuote,
  SaveInput,
} from "./schema.ts";
import { checkRateLimit, newToken, readToken, setToken, tokenHash } from "./security.ts";

const origin = "https://example.invalid";
const secret = "guest-draft-local-test-secret-only".repeat(2);
const id = randomUUID();
const userId = randomUUID();
const raw = {
  jobTitle: " Lounge ",
  defaultFurnitureStyle: "Modern",
  items: [
    {
      clientItemId: id,
      state: {
        roomName: "Living",
        furnitureStyle: "",
        additionalInfo: "",
        selectedAddons: ["day-to-dusk"],
      },
    },
  ],
};
const input = { currency: "USD", draft: raw };
const request = (body: unknown, headers?: Record<string, string>) =>
  new Request(origin, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const unused = (): never => {
  throw new Error("Unexpected dependency call");
};
const deps = { db: unused, user: unused, limit: async () => 0 };
process.env.GUEST_ORDER_DRAFTS_ENABLED = "true";
process.env.GUEST_DRAFT_COOKIE_SECRET = secret;

test("strict guest input rejects unknown fields at every boundary, attachments, identity, terms and prices", () => {
  const item = raw.items[0];
  const invalid = [
    { ...input, user_id: id },
    { ...input, token: "token" },
    { ...input, quote: {} },
    { ...input, currency: "GBP" },
    ...[
      "serviceType",
      "route",
      "state",
      "termsUi",
      "metadata",
      "schemaVersion",
      "totalCents",
      "files",
      "pricingVersionSeen",
    ].map((key) => ({ ...input, draft: { ...raw, [key]: true } })),
    ...[
      "referenceFiles",
      "originalFilename",
      "referenceFilename",
      "fileSizeLimit",
      "referenceLink",
      "draftFileId",
      "pricingPreview",
      "disclaimerText",
    ].map((key) => ({
      ...input,
      draft: { ...raw, items: [{ ...item, state: { ...item.state, [key]: [] } }] },
    })),
    ...[
      [],
      Array(51).fill(item),
      [item, item],
      [{ ...item, clientItemId: "x" }],
      [{ ...item, files: {} }],
    ].map((items) => ({ ...input, draft: { ...raw, items } })),
    ...[["unknown"], ["day-to-dusk", "day-to-dusk"]].map((selectedAddons) => ({
      ...input,
      draft: { ...raw, items: [{ ...item, state: { ...item.state, selectedAddons } }] },
    })),
    ...[
      "data:image/jpeg;base64,a",
      "A".repeat(4100),
      "Look at drafts/" + id + "/private.jpg",
      "VS-0042/0-original.jpg",
      "blob:https://example.invalid/abc",
      "https://x.invalid/storage/v1/object/sign/a?token=secret",
      "😀".repeat(2501),
      "\0",
      "\ud800",
    ].map((additionalInfo) => ({
      ...input,
      draft: { ...raw, items: [{ ...item, state: { ...item.state, additionalInfo } }] },
    })),
  ];
  for (const value of invalid) assert.equal(CreateInput.safeParse(value).success, false);
  const state = buildGuestState(CreateInput.parse(input).draft);
  assert.equal(state.jobTitle, "Lounge");
  assert.deepEqual(state.termsUi, {
    accepted: false,
    earlyPerformanceRequested: false,
    allowPortfolio: false,
  });
  assert.deepEqual(Object.keys(state.items[0].state).sort(), Object.keys(item.state).sort());
});

test("the SQL claim allowlist and guest validation use the staging catalog", () => {
  const migration = readFileSync(
    new URL("../../../supabase/add-guest-order-drafts.sql", import.meta.url),
    "utf8",
  );
  const list = /addon\s*#>>\s*'\{\}'\s+NOT IN\s*\(([^)]+)\)/i.exec(migration);
  assert.ok(list, "Missing SQL guest add-on allowlist");
  const sqlIds = list[1].split(",").map((entry) => {
    const literal = /^'([a-z0-9-]+)'$/.exec(entry.trim());
    assert.ok(literal, "Expected a literal catalog ID in the SQL allowlist");
    return literal[1];
  });
  assert.deepEqual(sqlIds.sort(), [...STAGING_ADDON_IDS].sort());
  const schema = readFileSync(new URL("./schema.ts", import.meta.url), "utf8");
  assert.match(schema, /selectedAddons:\s*z\s*\.array\(z\.enum\(STAGING_ADDON_IDS\)\)/);
  const entry = raw.items[0];
  assert.ok(
    CreateInput.safeParse({
      ...input,
      draft: {
        ...raw,
        items: [{ ...entry, state: { ...entry.state, selectedAddons: [...STAGING_ADDON_IDS] } }],
      },
    }).success,
  );
});

for (const [name, character] of [
  ["ASCII", "."],
  ["Cyrillic", "я"],
  ["emoji", "😀"],
]) {
  test(`serialized UTF-8 draft budget: ${name} at the boundary and one byte over`, async () => {
    const items = Array.from({ length: 50 }, () => ({
      clientItemId: randomUUID(),
      state: { ...raw.items[0].state, roomName: "r".repeat(200), furnitureStyle: "f".repeat(200) },
    }));
    const draft = { ...raw, jobTitle: "Lounge", items };
    const budget = GUEST_DRAFT_MAX_BYTES;
    const space = budget - Buffer.byteLength(JSON.stringify(draft));
    const charBytes = Buffer.byteLength(character);
    const count = Math.floor(space / charBytes);
    for (const [index, item] of items.entries()) {
      const chars = Math.floor(count / items.length) + Number(index < count % items.length);
      item.state.additionalInfo = character.repeat(chars);
    }
    items[0].state.additionalInfo += ".".repeat(space % charBytes);

    const save = { draft, currency: "USD", guestDraftId: id, expectedVersion: 2147483647 };
    assert.equal(Buffer.byteLength(JSON.stringify(draft)), budget);
    assert.ok(Buffer.byteLength(JSON.stringify(save)) < ORDER_DRAFT_API_MAX_BODY_BYTES);
    assert.ok(SaveInput.safeParse(save).success);
    assert.ok(CreateInput.safeParse({ draft, currency: "USD" }).success);

    draft.jobTitle += " "; // Counts on the wire, even though the title will be trimmed.
    assert.equal(Buffer.byteLength(JSON.stringify(draft)), budget + 1);
    assert.ok(Buffer.byteLength(JSON.stringify(save)) < ORDER_DRAFT_API_MAX_BODY_BYTES);
    for (const op of ["save", "new"] as const) {
      const payload = op === "save" ? save : { draft, currency: "USD" };
      const parsed = (op === "save" ? SaveInput : CreateInput).safeParse(payload);
      assert.ok(!parsed.success);
      assert.deepEqual(
        parsed.error.issues.map((issue) => issue.message),
        [GUEST_DRAFT_SIZE_ERROR],
      );
      const response = await guestDraftRequest(request(payload), op, deps);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { code: "invalid_input", message: GUEST_DRAFT_SIZE_ERROR });
    }
  });
}

test("maximum individual fields can exceed the wire limit; schema and streaming reader report their respective budgets", async () => {
  const items = Array.from({ length: 50 }, () => ({
    clientItemId: randomUUID(),
    state: {
      roomName: "я".repeat(200),
      furnitureStyle: "я".repeat(200),
      additionalInfo: "😀".repeat(2500),
      selectedAddons: [...STAGING_ADDON_IDS],
    },
  }));
  const payload = { currency: "USD", draft: { ...raw, items } };
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) > ORDER_DRAFT_API_MAX_BODY_BYTES);
  const parsed = CreateInput.safeParse(payload);
  assert.ok(!parsed.success);
  assert.equal(parsed.error.issues[0].message, GUEST_DRAFT_SIZE_ERROR);
  const response = await guestDraftRequest(request(payload), "new", deps);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    code: "invalid_input",
    message: "The request body must be at most 262144 bytes.",
  });
});

test("300 guest quotes match the approved calculator across currencies, volume tiers and per-item options", () => {
  for (const currency of ["USD", "EUR", "CAD"] as const) {
    for (let count = 1; count <= 50; count++) {
      for (const global of [true, false]) {
        const items = Array.from({ length: count }, (_, i) => ({
          clientItemId: randomUUID(),
          state: { ...raw.items[0].state, selectedAddons: global || i === 0 ? STAGING_ADDON_IDS : [] },
        }));
        const quote = calculateOrderQuote({
          serviceType: "virtual-staging",
          currency,
          items: items.map((i) => i.state),
        });
        assert.deepEqual(guestQuote(buildGuestState({ ...raw, items }), currency), {
          nonAuthoritative: true,
          preview: {
            currency,
            pricingVersion: quote.pricingVersion,
            itemCount: count,
            totalCents: quote.totalCents,
            customQuote: quote.customQuote,
          },
        });
        if (count === 50) assert.equal(quote.totalCents, null);
      }
    }
  }
  for (const [both, total] of [
    [true, 4740],
    [false, 4270],
  ] as const) {
    const items = [0, 1].map((i) => ({
      clientItemId: randomUUID(),
      state: {
        ...raw.items[0].state,
        selectedAddons: both || i === 0 ? (["image-enhancement", "day-to-dusk"] as const) : [],
      },
    }));
    const state = buildGuestState(CreateInput.parse({ ...input, draft: { ...raw, items } }).draft);
    assert.equal(guestQuote(state, "USD")?.preview.totalCents, total);
  }
});

test("cookie authenticates all components, has a shorter lifetime than the DB and cannot be duplicated", () => {
  const now = Date.now();
  const token = newToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(tokenHash(token), /^[a-f0-9]{64}$/);
  const r = new Response();
  setToken(r, token, secret, new Date(now + 120000).toISOString(), now);
  const header = r.headers.get("set-cookie")!;
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Max-Age=60/);
  const cookie = header.split(";")[0];
  const get = (v: string, at = now) => readToken(request({}, { cookie: v }), secret, at);
  assert.equal(get(cookie), token);
  assert.equal(get(cookie, now + 60000), null);
  assert.equal(get(cookie.replace(token, newToken())), null);
  assert.equal(get(cookie.replace(".v1", ".v2").replace("=v1", "=v2")), null);
  assert.equal(get(cookie.replace(/\.\d+\./, ".9999999999.")), null);
  assert.equal(get(cookie + "; " + cookie), null);
  assert.equal(readToken(request({}), secret), undefined);
  assert.equal(readToken(request({}, { cookie }), secret + "changed"), null);
});

test("disabled and misconfigured feature short-circuits all four handlers", async () => {
  delete process.env.GUEST_ORDER_DRAFTS_ENABLED;
  for (const op of ["get", "save", "claim", "new"] as const) {
    const r = await guestDraftRequest(request({}), op, { ...deps, limit: unused });
    assert.equal(r.status, 404);
    assert.equal(r.headers.get("cache-control"), "no-store");
  }
  process.env.GUEST_ORDER_DRAFTS_ENABLED = "1";
  process.env.GUEST_DRAFT_COOKIE_SECRET = "short";
  assert.equal((await guestDraftRequest(request({}), "save", deps)).status, 503);
  process.env.GUEST_DRAFT_COOKIE_SECRET = secret;
});

test("wrong Origin, null, same-site and cross-site fail before rate limiting or auth", async () => {
  for (const op of ["claim", "save", "new"] as const) {
    for (const [key, value] of [
      ["Origin", "null"],
      ["Origin", "https://evil.invalid"],
      ["Sec-Fetch-Site", "same-site"],
      ["Sec-Fetch-Site", "cross-site"],
    ]) {
      assert.equal(
        (await guestDraftRequest(request({}, { [key]: value }), op, { ...deps, limit: unused })).status,
        403,
      );
    }
    for (const h of [
      { Origin: origin, "Sec-Fetch-Site": "same-origin" },
      { "Sec-Fetch-Site": "none" },
      {},
    ]) {
      assert.equal(
        (await guestDraftRequest(request({}, h as Record<string, string>), op, deps)).status,
        400,
      );
    }
  }
});

test("bad JSON, bytes over 256 KiB, unsupported type, wrong version or binding never reach storage", async () => {
  const cases = [
    request({ guestDraftId: id }),
    request({ guestDraftId: "bad", expectedVersion: 1 }),
    request({ guestDraftId: id, expectedVersion: 1.5 }),
    request({ guestDraftId: id, expectedVersion: 1, user_id: userId }),
    request(input, { "Content-Type": "text/plain" }),
    request("é".repeat(131072)),
    new Request(origin, { method: "POST", body: "{", headers: { "Content-Type": "application/json" } }),
  ];
  for (const r of cases) assert.equal((await guestDraftRequest(r, "claim", deps)).status, 400);
  for (const key of [
    { guestDraftId: id },
    { expectedVersion: 1 },
    { expectedVersion: 1, guestDraftId: id },
  ]) {
    for (const op of ["save", "new"] as const)
      assert.equal((await guestDraftRequest(request({ ...input, ...key }), op, deps)).status, 400);
  }
  assert.equal(
    (await guestDraftRequest(request(input, { cookie: "picchu_guest_vs_draft=" }), "save", deps)).status,
    401,
  );
});

test("missing Upstash, untrusted identity, Redis rejection or timeout fail closed; quota returns 429", async (t) => {
  // The fetch stub prevents any request to a live Redis, even with inherited env.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  let calls = 0;
  const guard = {
    db: () => {
      calls++;
      return unused();
    },
    user: async () => ({ id: userId }),
    limit: checkRateLimit,
  };
  for (const op of ["claim", "save", "new"] as const) {
    const r = await guestDraftRequest(request(input), op, guard);
    assert.equal(r.status, 503);
    assert.equal(r.headers.get("Retry-After"), "30");
    assert.equal(r.headers.get("set-cookie"), null);
  }
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "local-only";
  process.env.VERCEL = "1";
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("synthetic refusal");
  });
  assert.equal((await guestDraftRequest(request(input), "save", guard)).status, 503);
  assert.equal(fetchMock.mock.callCount(), 0);
  const r = () => request(input, { "x-vercel-forwarded-for": "192.0.2.2" });
  assert.equal((await guestDraftRequest(r(), "save", guard)).status, 503);
  assert.ok(fetchMock.mock.callCount() > 0);
  fetchMock.mock.mockImplementation(() => new Promise<never>(() => {}));
  assert.equal((await guestDraftRequest(r(), "new", guard)).status, 503);
  for (const limit of [async () => 42, async (_: Request, key: string) => (key === "user" ? 42 : 0)]) {
    const r = await guestDraftRequest(request({ guestDraftId: id, expectedVersion: 1 }), "claim", {
      ...guard,
      limit,
    });
    assert.equal(r.status, 429);
    assert.equal(r.headers.get("Retry-After"), "42");
  }
  assert.equal(calls, 0);
});

test("Upstash SDK uses the five configured quotas and sends only keyed identity hashes", async (t) => {
  process.env.VERCEL = "1";
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "local-only";
  const ip = "192.0.2.50";
  const calls: Array<{ key: string; count: number; window: number }> = [];
  let blocked = false;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const [command] = JSON.parse(String(init.body));
    const [count, , window] = command.slice(-4);
    assert.equal(command[0], "evalsha");
    assert.ok(!JSON.stringify(command).includes(ip) && !JSON.stringify(command).includes(userId));
    calls.push({ key: command[3], count, window });
    return Response.json([{ result: [blocked ? -1 : count - 1, count] }]);
  });
  const req = request({}, { "x-vercel-forwarded-for": ip });
  for (const action of ["save", "claim", "user", "new"] as const) {
    assert.equal(await checkRateLimit(req, action, secret, action === "user" ? userId : undefined), 0);
  }
  const expected = [
    ["save", 30, 60000],
    ["hourly", 200, 3600000],
    ["claim", 20, 60000],
    ["user", 10, 60000],
    ["new", 10, 3600000],
  ] as const;
  assert.equal(calls.length, expected.length);
  for (const [quota, count, window] of expected) {
    const hash = createHmac("sha256", secret)
      .update("guest-drafts\0" + (quota === "user" ? userId : ip))
      .digest("hex");
    const call = calls.find((call) => call.key.includes(":" + quota + ":" + hash + ":"));
    assert.equal(call?.count, count);
    assert.equal(call?.window, window);
  }
  blocked = true;
  assert.ok((await checkRateLimit(req, "claim", secret)) > 0);
});

test("claim distinguishes confirmed abort of this attempt from unknown outcomes and never sets cookies on errors", async () => {
  const response = new Response();
  setToken(response, newToken(), secret, new Date(Date.now() + 86400000).toISOString());
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const cases: Array<[unknown, number, string, number]> = [
    ...["08007", "40003", "08006", "PGRST000", ""].map((code): [unknown, number, string, number] => [
      { code, message: "private" },
      500,
      "unknown",
      503,
    ]),
    ...["23503", "P0001", "40001", "57014"].map((code): [unknown, number, string, number] => [
      { code, message: "private" },
      400,
      "rolled_back",
      500,
    ]),
    [{ result_code: "unrecognized" }, 200, "unknown", 503],
    [
      { result_code: "claimed", draft_id: id, draft_version: 1, draft_status: "active" },
      200,
      "unknown",
      503,
    ],
    [null, 0, "unknown", 503],
  ];
  for (const [body, status, outcome, expected] of cases) {
    const db = createClient(origin, "synthetic", {
      global: {
        fetch: async () => {
          if (!status) throw new Error("lost response");
          return Response.json(body, { status });
        },
      },
    });
    const r = await guestDraftRequest(
      request({ guestDraftId: id, expectedVersion: 1 }, { cookie }),
      "claim",
      { ...deps, db: () => db, user: async () => ({ id: userId }) },
    );
    assert.equal(r.status, expected);
    assert.equal(r.headers.get("set-cookie"), null);
    assert.deepEqual(await r.json(), {
      code: expected === 503 ? "write_outcome_unknown" : "database_error",
      outcome,
    });
  }
});
