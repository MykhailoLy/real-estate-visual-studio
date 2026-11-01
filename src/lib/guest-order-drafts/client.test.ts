import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  buildVirtualStagingDraftFingerprint,
  shouldApplyVirtualStagingSaveResult,
  type VirtualStagingFormDraftSource,
} from "../order-drafts/virtual-staging.ts";
import {
  claimGuestDraft,
  confirmationKey,
  getGuestDraft,
  guestErrorAction,
  guestReadAction,
  guestSaveBody,
  GuestRequestError,
  newGuestDraft,
  saveGuestDraft,
  singleFlight,
  type GuestSaved,
} from "./client.ts";
import { buildGuestState, guestQuote } from "./schema.ts";
import { guestEntryForDashboard, GUEST_ENTRY } from "./entry.ts";

const draftId = randomUUID();
const guestDraftId = randomUUID();
const state = buildGuestState({
  jobTitle: "Suite",
  defaultFurnitureStyle: "",
  items: [
    {
      clientItemId: randomUUID(),
      state: { furnitureStyle: "", roomName: "", additionalInfo: "", selectedAddons: [] },
    },
  ],
});
const snapshot: GuestSaved = {
  guestDraftId,
  version: 3,
  currency: "USD",
  state,
  expiresAt: "2099-01-01",
  quote: {
    nonAuthoritative: true,
    preview: {
      currency: "USD",
      pricingVersion: "1",
      customQuote: false,
      itemCount: 1,
      totalCents: 2000,
    },
  },
};
const source: VirtualStagingFormDraftSource = {
  jobTitle: "Suite",
  currency: "USD",
  defaultFurnitureStyle: "",
  orderTerms: state.termsUi,
  items: state.items.map(({ clientItemId, state: item }) => ({
    clientItemId,
    ...item,
    fileSizeLimit: "",
    disclaimerText: "",
    referenceLink: "",
    originalFilename: "private.jpg",
    file: { name: "private.jpg" },
  })),
};

test("auth gate redirects only a new Virtual Staging route when the flag is enabled", (t) => {
  const route = "/dashboard/orders/new/virtual-staging";
  const prior = process.env.GUEST_ORDER_DRAFTS_ENABLED;
  t.after(() => {
    if (prior === undefined) delete process.env.GUEST_ORDER_DRAFTS_ENABLED;
    else process.env.GUEST_ORDER_DRAFTS_ENABLED = prior;
  });
  for (const flag of ["false", "", "TRUE"]) {
    process.env.GUEST_ORDER_DRAFTS_ENABLED = flag;
    assert.equal(guestEntryForDashboard(route), null);
  }
  process.env.GUEST_ORDER_DRAFTS_ENABLED = "true";
  assert.equal(guestEntryForDashboard(route), GUEST_ENTRY);
  for (const path of [
    route + "?draft=" + draftId,
    route + "/extra",
    "/dashboard/orders/new/photo-editing",
  ]) {
    assert.equal(guestEntryForDashboard(path), null);
  }
});

test("a claim requires the confirmed ID, version, currency and server estimate", () => {
  const key = confirmationKey(snapshot);
  assert.equal(guestReadAction(snapshot, true, key, guestDraftId), "claim");
  assert.equal(guestReadAction(snapshot, false, key, guestDraftId), "edit");
  assert.equal(guestReadAction(snapshot, true, key, draftId), "different");
  assert.equal(guestReadAction(snapshot, true, null, guestDraftId), "confirm");
  for (const updated of [
    { ...snapshot, version: 4 },
    { ...snapshot, quote: null },
    {
      ...snapshot,
      quote: { ...snapshot.quote!, preview: { ...snapshot.quote!.preview, totalCents: 3000 } },
    },
  ])
    assert.equal(guestReadAction(updated, true, key, guestDraftId), "confirm");
  assert.equal(
    guestReadAction({ claimed: true, guestDraftId, draftId }, true, key, guestDraftId),
    "open",
  );
});

test("recoverable statuses keep conflicts, expired drafts, lost sessions and unknown outcomes distinct", () => {
  for (const [status, code, action] of [
    [409, "version_conflict", "reload"],
    [409, "guest_draft_claimed", "reload"],
    [409, "already_claimed", "reload"],
    [410, "guest_draft_expired", "expired"],
    [401, "guest_draft_unauthenticated", "absent"],
    [401, "unauthenticated", "login"],
    [404, "not_found", "missing"],
    [503, "write_outcome_unknown", "retry"],
  ] as const)
    assert.equal(guestErrorAction(new GuestRequestError(status, code)), action);
  assert.equal(guestErrorAction(new TypeError("network")), "retry");
});

test("double clicks share one claim and a response from an obsolete session cannot navigate", async () => {
  let session = 1;
  let calls = 0;
  const navigations: string[] = [];
  const { promise, resolve } = Promise.withResolvers<string>();
  const run = singleFlight<void>();
  const claim = async () => {
    const started = session;
    calls++;
    const id = await promise;
    if (shouldApplyVirtualStagingSaveResult(started, session)) navigations.push(id);
  };
  const first = run(claim);
  assert.equal(first, run(claim));
  await Promise.resolve();
  session++;
  resolve(draftId);
  await first;
  assert.equal(calls, 1);
  assert.deepEqual(navigations, []);
  await run(claim);
  assert.deepEqual(navigations, [draftId]);
});

test("all four client methods send same-origin requests, allowlist configuration and recover already_claimed", async (t) => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  t.mock.method(globalThis, "fetch", async (path: string, init?: RequestInit) => {
    calls.push({ path, init });
    return Response.json(
      path.endsWith("/claim")
        ? { draftId, alreadyClaimed: true }
        : { ...snapshot, quote: guestQuote(state, "USD") },
    );
  });
  await getGuestDraft();
  const binding = { guestDraftId, expectedVersion: snapshot.version };
  await saveGuestDraft(source, binding);
  await newGuestDraft(source);
  assert.deepEqual(await claimGuestDraft(snapshot), { draftId, alreadyClaimed: true });
  assert.deepEqual(
    calls.map(({ path, init }) => [path, init?.method]),
    [
      ["/api/guest-order-drafts", "GET"],
      ["/api/guest-order-drafts", "PUT"],
      ["/api/guest-order-drafts/new", "POST"],
      ["/api/guest-order-drafts/claim", "POST"],
    ],
  );
  assert.ok(calls.every(({ init }) => init?.credentials === "same-origin" && init.cache === "no-store"));
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { ...guestSaveBody(source), ...binding });
  assert.deepEqual(JSON.parse(String(calls[2].init?.body)).draft.items, state.items);
  assert.deepEqual(JSON.parse(String(calls[3].init?.body)), binding);
  assert.ok(!JSON.stringify(guestSaveBody(source)).includes("private.jpg"));
  assert.equal(
    buildVirtualStagingDraftFingerprint(source),
    buildVirtualStagingDraftFingerprint(structuredClone(source)),
  );
});
