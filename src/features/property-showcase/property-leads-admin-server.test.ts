import assert from "node:assert/strict";
import test from "node:test";
import {
  isMissingPropertyLeadsSchemaError,
  resolvePropertyLeadsForAdmin,
  sortPropertyLeadsNewestFirst,
  type AdminPropertyLead,
} from "./property-leads-admin.ts";

function lead(overrides: Partial<AdminPropertyLead> = {}): AdminPropertyLead {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    propertySlug: "sea-view-residence",
    name: "Alex Morgan",
    email: "alex@example.com",
    phone: null,
    preferredDate: null,
    preferredTime: null,
    message: null,
    locale: "en",
    source: "property-showcase",
    createdAt: "2026-08-07T12:00:00.000Z",
    notificationEmailStatus: "sent",
    ...overrides,
  };
}

test("admin property leads are ordered newest first", () => {
  const ordered = sortPropertyLeadsNewestFirst([
    lead({ id: "older", createdAt: "2026-08-06T12:00:00.000Z" }),
    lead({ id: "newer", createdAt: "2026-08-07T12:00:00.000Z" }),
  ]);

  assert.deepEqual(ordered.map((item) => item.id), ["newer", "older"]);
});

test("admin property leads safely handle missing configuration and schema failures", () => {
  const unconfigured = resolvePropertyLeadsForAdmin({ configured: false });
  const missingSchema = resolvePropertyLeadsForAdmin({
    configured: true,
    response: { data: null, error: { code: "42P01" } },
  });
  const unavailable = resolvePropertyLeadsForAdmin({
    configured: true,
    response: { data: null, error: { code: "42501" } },
  });

  assert.deepEqual(unconfigured, { state: "unconfigured", leads: [] });
  assert.deepEqual(missingSchema, { state: "unavailable", leads: [] });
  assert.deepEqual(unavailable, { state: "unavailable", leads: [] });
  assert.equal(isMissingPropertyLeadsSchemaError({ code: "42P01" }), true);
  assert.equal(isMissingPropertyLeadsSchemaError({ code: "42501" }), false);
});
