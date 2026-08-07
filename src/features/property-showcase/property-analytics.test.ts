import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  handlePropertyAnalyticsRequest,
  shouldTrackPropertyAnalytics,
  type PropertyAnalyticsDependencies,
} from "./property-analytics.ts";
import { postPropertyAnalyticsEvent } from "./property-analytics-client.ts";
import {
  getPropertyAnalyticsSummary,
  resolvePropertyAnalyticsPeriod,
  type PropertyAnalyticsRepository,
} from "./property-analytics-dashboard.ts";

function request(body: unknown) {
  return new Request("https://picchuspot.com/api/property-analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function dependencies(
  overrides: Partial<PropertyAnalyticsDependencies> = {},
): PropertyAnalyticsDependencies {
  return {
    checkRateLimit: async () => ({ allowed: true }),
    findPublishedProperty: async () => ({
      id: "00000000-0000-4000-8000-000000000001",
      slug: "sea-view-residence",
    }),
    insertEvent: async () => undefined,
    ...overrides,
  };
}

test("allowlisted analytics events are normalized and resolve property identity server-side", async () => {
  let inserted: unknown;
  const response = await handlePropertyAnalyticsRequest(
    request({
      propertySlug: "SEA-VIEW-RESIDENCE",
      event: "property_page_viewed",
    }),
    dependencies({
      insertEvent: async (event) => {
        inserted = event;
      },
    }),
  );

  assert.equal(response.status, 202);
  assert.deepEqual(inserted, {
    propertyId: "00000000-0000-4000-8000-000000000001",
    propertySlug: "sea-view-residence",
    event: "property_page_viewed",
  });
});

test("unsupported events and browser-supplied property IDs are rejected before storage", async () => {
  let inserted = false;
  const unsupported = await handlePropertyAnalyticsRequest(
    request({ propertySlug: "sea-view-residence", event: "scroll_depth" }),
    dependencies({
      insertEvent: async () => {
        inserted = true;
      },
    }),
  );
  assert.equal(unsupported.status, 400);

  const forgedIdentity = await handlePropertyAnalyticsRequest(
    request({
      propertySlug: "sea-view-residence",
      event: "property_page_viewed",
      propertyId: "attacker-chosen-id",
    }),
    dependencies({
      insertEvent: async () => {
        inserted = true;
      },
    }),
  );
  assert.equal(forgedIdentity.status, 400);
  assert.equal(inserted, false);
});

test("unpublished or nonexistent properties cannot accept analytics events", async () => {
  let inserted = false;
  const response = await handlePropertyAnalyticsRequest(
    request({
      propertySlug: "unpublished-home",
      event: "gallery_opened",
    }),
    dependencies({
      findPublishedProperty: async () => null,
      insertEvent: async () => {
        inserted = true;
      },
    }),
  );

  assert.equal(response.status, 404);
  assert.equal(inserted, false);
});

test("analytics payload is bounded and contains no personal information fields", async () => {
  const response = await handlePropertyAnalyticsRequest(
    request({
      propertySlug: "sea-view-residence",
      event: "property_page_viewed",
      email: "visitor@example.com",
    }),
    dependencies(),
  );
  assert.equal(response.status, 400);

  const tooLarge = await handlePropertyAnalyticsRequest(
    request({
      propertySlug: "sea-view-residence",
      event: "property_page_viewed",
      padding: "x".repeat(600),
    }),
    dependencies(),
  );
  assert.equal(tooLarge.status, 413);

  let payload: unknown;
  await postPropertyAnalyticsEvent(
    {
      propertySlug: "sea-view-residence",
      event: "gallery_opened",
    },
    async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return new Response(null, { status: 202 });
    },
  );
  assert.deepEqual(payload, {
    propertySlug: "sea-view-residence",
    event: "gallery_opened",
  });
});

test("client analytics failures are swallowed and preview mode never tracks", async () => {
  await assert.doesNotReject(
    postPropertyAnalyticsEvent(
      { propertySlug: "sea-view-residence", event: "property_page_viewed" },
      async () => {
        throw new Error("network unavailable");
      },
    ),
  );
  assert.equal(shouldTrackPropertyAnalytics(false), true);
  assert.equal(shouldTrackPropertyAnalytics(true), false);
});

function repository(
  calls: Array<Record<string, unknown>>,
): PropertyAnalyticsRepository {
  return {
    countEvent: async (input) => {
      calls.push({ kind: "event", ...input });
      return input.event === "property_page_viewed" ? 12 : 2;
    },
    countEnquiries: async (input) => {
      calls.push({ kind: "enquiry-count", ...input });
      return 3;
    },
    listPageViewCreatedAt: async (input) => {
      calls.push({ kind: "page-view-days", ...input });
      return ["2026-08-07T12:00:00.000Z", "2026-08-07T17:00:00.000Z"];
    },
    listEnquiryCreatedAt: async (input) => {
      calls.push({ kind: "enquiry-days", ...input });
      return ["2026-08-07T19:00:00.000Z"];
    },
  };
}

test("admin analytics stays property-specific and applies deterministic UTC periods", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const summary = await getPropertyAnalyticsSummary({
    configured: true,
    propertyId: "property-a",
    period: "7d",
    now: new Date("2026-08-08T12:00:00.000Z"),
    repository: repository(calls),
  });

  assert.equal(summary.state, "ready");
  if (summary.state !== "ready") return;
  assert.equal(summary.range.startAt, "2026-08-01T12:00:00.000Z");
  assert.equal(summary.eventCounts.property_page_viewed, 12);
  assert.equal(summary.enquiryCount, 3);
  assert.deepEqual(summary.activity, [
    { date: "2026-08-07", pageViews: 2, enquiries: 1 },
  ]);
  assert.equal(calls.every((call) => call.propertyId === "property-a"), true);
  assert.equal(calls.some((call) => call.kind === "enquiry-count"), true);
  assert.equal(calls.some((call) => call.propertyId === "property-b"), false);
});

test("analytics summaries safely handle missing configuration and schema/query failures", async () => {
  const unconfigured = await getPropertyAnalyticsSummary({
    configured: false,
    propertyId: "property-a",
  });
  assert.deepEqual(unconfigured, { state: "unconfigured" });

  const unavailable = await getPropertyAnalyticsSummary({
    configured: true,
    propertyId: "property-a",
    repository: {
      countEvent: async () => {
        throw new Error("42P01");
      },
      countEnquiries: async () => 0,
      listPageViewCreatedAt: async () => [],
      listEnquiryCreatedAt: async () => [],
    },
  });
  assert.deepEqual(unavailable, { state: "unavailable" });

  assert.deepEqual(
    resolvePropertyAnalyticsPeriod("unexpected", new Date("2026-08-08T12:00:00.000Z")),
    {
      key: "30d",
      label: "30 days",
      startAt: "2026-07-09T12:00:00.000Z",
    },
  );
});

test("analytics migration grants only service-role access and stores no visitor data columns", () => {
  const migration = readFileSync(
    new URL("../../../supabase/add-property-showcase-analytics.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.property_analytics_events from anon/i);
  assert.match(migration, /revoke all on table public\.property_analytics_events from authenticated/i);
  assert.doesNotMatch(migration, /create policy[\s\S]+property_analytics_events/i);
  const tableDefinition = migration.match(
    /create table if not exists public\.property_analytics_events \(([\s\S]+?)\n\);/i,
  )?.[1] ?? "";
  assert.doesNotMatch(
    tableDefinition,
    /^\s*(?:ip_address|user_agent|visitor_id|email|phone|message)\s/m,
  );
  assert.match(migration, /grant select, insert, update, delete[\s\S]+service_role/i);
});
