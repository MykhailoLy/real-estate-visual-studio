import assert from "node:assert/strict";
import test from "node:test";
import { listOrderDrafts, type OrderDraftClientResult } from "./client.ts";
import {
  buildSavedDraftResumeUrl,
  formatSavedDraftUpdatedAt,
  getSavedDraftTitle,
  resolveSavedDraftServiceName,
} from "./saved-drafts.ts";
import type { OrderDraftSummary } from "./types.ts";

const DRAFT_ID = "11111111-1111-4111-8111-111111111111";

const typedListOrderDrafts: (
  limit?: number,
  signal?: AbortSignal,
) => Promise<OrderDraftClientResult<OrderDraftSummary[]>> = listOrderDrafts;
void typedListOrderDrafts;

function summary(overrides: Partial<OrderDraftSummary> = {}): OrderDraftSummary {
  return {
    id: DRAFT_ID,
    serviceType: "virtual-staging",
    subService: null,
    route: "/dashboard/orders/new/virtual-staging",
    title: "Living room draft",
    currentStep: "virtual-staging-form",
    status: "active",
    version: 1,
    updatedAt: "2026-06-27T11:22:36.123456+00:00",
    expiresAt: "2026-07-27T11:22:36.123456+00:00",
    convertedOrderId: null,
    ...overrides,
  };
}

test("safe internal route creates the expected resume URL", () => {
  assert.equal(
    buildSavedDraftResumeUrl("/dashboard/orders/new/virtual-staging", DRAFT_ID),
    `/dashboard/orders/new/virtual-staging?draft=${DRAFT_ID}`,
  );
});

test("resume URL preserves unrelated query parameters", () => {
  assert.equal(
    buildSavedDraftResumeUrl(
      "/dashboard/orders/new/virtual-staging?campaign=spring&tab=form",
      DRAFT_ID,
    ),
    `/dashboard/orders/new/virtual-staging?campaign=spring&tab=form&draft=${DRAFT_ID}`,
  );
});

test("resume URL replaces an existing draft parameter", () => {
  assert.equal(
    buildSavedDraftResumeUrl(
      "/dashboard/orders/new/virtual-staging?draft=old&tab=form",
      DRAFT_ID,
    ),
    `/dashboard/orders/new/virtual-staging?draft=${DRAFT_ID}&tab=form`,
  );
});

test("resume URL rejects external absolute URLs", () => {
  assert.equal(
    buildSavedDraftResumeUrl("https://example.com/dashboard/orders/new/x", DRAFT_ID),
    null,
  );
});

test("resume URL rejects protocol-relative URLs", () => {
  assert.equal(
    buildSavedDraftResumeUrl("//example.com/dashboard/orders/new/x", DRAFT_ID),
    null,
  );
});

test("resume URL rejects routes outside new-order forms", () => {
  assert.equal(buildSavedDraftResumeUrl("/dashboard/jobs", DRAFT_ID), null);
});

test("resume URL removes hash fragments and encodes draft IDs", () => {
  assert.equal(
    buildSavedDraftResumeUrl(
      "/dashboard/orders/new/virtual-staging?tab=form#files",
      "draft/id",
    ),
    "/dashboard/orders/new/virtual-staging?tab=form&draft=draft%2Fid",
  );
});

test("whitespace-only title uses the localized fallback", () => {
  assert.equal(getSavedDraftTitle("   ", "Untitled draft"), "Untitled draft");
  assert.equal(getSavedDraftTitle(null, "Borrador sin título"), "Borrador sin título");
});

test("known service resolves from the central registry", () => {
  assert.equal(resolveSavedDraftServiceName(summary()), "Virtual Staging");
});

test("unknown service receives a safe fallback", () => {
  assert.equal(
    resolveSavedDraftServiceName(
      summary({
        serviceType: "unknown-service" as OrderDraftSummary["serviceType"],
        route: "/dashboard/orders/new/unknown-service",
      }),
    ),
    "Unknown Service",
  );
});

test("valid updated timestamp formatting does not throw", () => {
  const fallback = "Updated time unavailable";
  const formatted = formatSavedDraftUpdatedAt(
    "2026-06-27T11:22:36.123456+00:00",
    "en",
    fallback,
  );
  assert.notEqual(formatted, fallback);
  assert.equal(typeof formatted, "string");
});

test("invalid updated timestamp uses the fallback", () => {
  assert.equal(
    formatSavedDraftUpdatedAt("not-a-date", "es", "Hora de actualización no disponible"),
    "Hora de actualización no disponible",
  );
});
