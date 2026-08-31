import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  deleteOrderDraft,
  type OrderDraftClientResult,
} from "./client.ts";
import {
  removeDraftSummaryById,
  shouldRefreshDraftListAfterDeleteError,
} from "./drafts-page.ts";
import type { OrderDraftRow } from "./types.ts";

const typedDeleteOrderDraft: (
  draftId: string,
  expectedVersion: number,
  signal?: AbortSignal,
) => Promise<OrderDraftClientResult<{ draft: OrderDraftRow; version: number }>> =
  deleteOrderDraft;
void typedDeleteOrderDraft;

const SHARED_DELETE_SOURCE = readFileSync(
  "src/components/dashboard/ClientDraftsPage.tsx",
  "utf8",
);
const DASHBOARD_DRAFTS_SOURCE = readFileSync(
  "src/components/dashboard/SavedDraftsSection.tsx",
  "utf8",
);

const drafts = [
  { id: "draft-1", title: "One" },
  { id: "draft-2", title: "Two" },
  { id: "draft-3", title: "Three" },
] as const;

test("removing a target draft returns a new list without that draft", () => {
  const result = removeDraftSummaryById(drafts, "draft-2");
  assert.notEqual(result, drafts);
  assert.deepEqual(
    result.map((draft) => draft.id),
    ["draft-1", "draft-3"],
  );
});

test("unrelated drafts remain unchanged when removing a target draft", () => {
  const result = removeDraftSummaryById(drafts, "draft-2");
  assert.equal(result[0], drafts[0]);
  assert.equal(result[1], drafts[2]);
});

test("a missing ID leaves equivalent list content", () => {
  const result = removeDraftSummaryById(drafts, "missing");
  assert.notEqual(result, drafts);
  assert.deepEqual(result, [...drafts]);
});

test("version conflict delete errors require a list refresh", () => {
  assert.equal(shouldRefreshDraftListAfterDeleteError("version_conflict"), true);
});

test("not found delete errors require a list refresh", () => {
  assert.equal(shouldRefreshDraftListAfterDeleteError("not_found"), true);
});

test("invalid status delete errors require a list refresh", () => {
  assert.equal(shouldRefreshDraftListAfterDeleteError("invalid_status"), true);
});

test("network database and unexpected delete errors do not auto-refresh repeatedly", () => {
  assert.equal(shouldRefreshDraftListAfterDeleteError("network_error"), false);
  assert.equal(shouldRefreshDraftListAfterDeleteError("database_error"), false);
  assert.equal(shouldRefreshDraftListAfterDeleteError("unexpected_error"), false);
});

test("deleteOrderDraft remains typed with expectedVersion and optional signal", () => {
  assert.equal(typedDeleteOrderDraft, deleteOrderDraft);
});

test("dashboard drafts reuse the shared version-checked delete controller", () => {
  assert.match(DASHBOARD_DRAFTS_SOURCE, /useOrderDraftDeletion\(/);
  assert.match(SHARED_DELETE_SOURCE, /await deleteOrderDraft\(/);
  assert.match(SHARED_DELETE_SOURCE, /draft\.version/);
  assert.match(SHARED_DELETE_SOURCE, /shouldRefreshDraftListAfterDeleteError/);
  assert.match(SHARED_DELETE_SOURCE, /result\.code === "unauthenticated"/);
});

test("finishing drafts cannot enter or confirm the shared delete flow", () => {
  assert.match(
    SHARED_DELETE_SOURCE,
    /activeDeleteControllerRef\.current \|\|[\s\S]+isFinishingOrderDraft\(draft\)/,
  );
  assert.match(
    SHARED_DELETE_SOURCE,
    /const confirmDelete = async[\s\S]+if \(isFinishingOrderDraft\(draft\)\)/,
  );
  assert.match(DASHBOARD_DRAFTS_SOURCE, /deletable && !isFinishing && \(/);
});

test("dashboard draft deletion keeps the shared accessible confirmation dialog", () => {
  assert.match(DASHBOARD_DRAFTS_SOURCE, /OrderDraftDeletionDialog/);
  assert.match(SHARED_DELETE_SOURCE, /role="dialog"/);
  assert.match(SHARED_DELETE_SOURCE, /aria-modal="true"/);
  assert.match(SHARED_DELETE_SOURCE, /disabled=\{deletingDraftId === confirmDraft\.id\}/);
});
