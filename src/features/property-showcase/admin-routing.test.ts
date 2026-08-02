import assert from "node:assert/strict";
import test from "node:test";
import {
  propertyCardActions,
  propertyMediaHref,
  propertyPreviewHref,
  resolvePropertySelection,
} from "./admin-routing.ts";
import { costaBlancaDemo } from "./registry.ts";
import type { PropertyShowcaseAdminRecord } from "./admin-types.ts";

function record(id: string, slug: string): PropertyShowcaseAdminRecord {
  return {
    id,
    slug,
    published: false,
    publishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    property: {
      ...structuredClone(costaBlancaDemo),
      slug,
    },
  };
}

test("propertyMediaHref points to the exact selected media record", () => {
  assert.equal(
    propertyMediaHref("b6602f70-dacd-45b8-b1fb-6fc8967404af"),
    "/admin/properties/media?property=b6602f70-dacd-45b8-b1fb-6fc8967404af",
  );
});

test("propertyPreviewHref points to the protected admin preview route", () => {
  assert.equal(
    propertyPreviewHref("b6602f70-dacd-45b8-b1fb-6fc8967404af"),
    "/admin/properties/b6602f70-dacd-45b8-b1fb-6fc8967404af/preview",
  );
});

test("property card actions always include the selected record media action", () => {
  const draft = record("first", "first-home");
  const published = { ...record("second", "second-home"), published: true };

  const draftActions = propertyCardActions(draft);
  const publishedActions = propertyCardActions(published);

  assert.deepEqual(
    draftActions.map((action) => action.label),
    ["Preview", "Edit details", "Photos & floor plans", "Delete"],
  );
  assert.deepEqual(
    publishedActions.map((action) => action.label),
    ["Open", "Edit details", "Photos & floor plans", "Delete"],
  );
  assert.equal(
    draftActions[2].href,
    "/admin/properties/media?property=first",
  );
  assert.equal(
    publishedActions[2].href,
    "/admin/properties/media?property=second",
  );
});

test("resolvePropertySelection initializes from the route parameter", () => {
  const records = [record("first", "first-home"), record("second", "second-home")];
  const selection = resolvePropertySelection(records, "", "second");

  assert.equal(selection.selected?.id, "second");
  assert.equal(selection.missingRequestedProperty, false);
});

test("resolvePropertySelection does not silently switch when route id is missing", () => {
  const records = [record("first", "first-home")];
  const selection = resolvePropertySelection(records, "", "missing");

  assert.equal(selection.selected, null);
  assert.equal(selection.requestedId, "missing");
  assert.equal(selection.missingRequestedProperty, true);
});
