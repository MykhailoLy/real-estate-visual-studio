import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const analyticsPageSource = readFileSync(
  new URL(
    "../../app/(default)/(public)/admin/properties/[id]/analytics/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const analyticsDashboardSource = readFileSync(
  new URL(
    "../../app/(default)/(public)/admin/properties/[id]/analytics/PropertyAnalyticsDashboard.tsx",
    import.meta.url,
  ),
  "utf8",
);
const showcaseViewSource = readFileSync(
  new URL(
    "../../app/(default)/(showcase)/property/PropertyShowcaseView.tsx",
    import.meta.url,
  ),
  "utf8",
);
const analyticsClientSource = readFileSync(
  new URL("./property-analytics-client.ts", import.meta.url),
  "utf8",
);

test("per-property analytics admin route authenticates before property access and is noindex", () => {
  assert.equal(analyticsPageSource.includes('redirect("/admin/login")'), true);
  assert.equal(
    analyticsPageSource.indexOf("isAdminAuthenticated") <
      analyticsPageSource.indexOf("getPropertyShowcaseForAdminById"),
    true,
  );
  assert.equal(analyticsPageSource.includes("index: false"), true);
  assert.equal(analyticsPageSource.includes("follow: false"), true);
  assert.equal(analyticsPageSource.includes("force-dynamic"), true);
});

test("analytics dashboard keeps periods, funnel, trusted enquiry copy, and safe unavailable states", () => {
  for (const expected of [
    "7 days",
    "30 days",
    "90 days",
    "All time",
    "Conversion funnel",
    "Authoritative count from property leads",
    "No analytics data yet.",
    "Property analytics storage is not available yet.",
    "Daily page views and enquiries",
  ]) {
    assert.equal(analyticsDashboardSource.includes(expected), true, expected);
  }
});

test("public showcase events are client-side and preview mode is excluded", () => {
  assert.equal(showcaseViewSource.includes('trackEvent("property_page_viewed")'), true);
  assert.equal(showcaseViewSource.includes("shouldTrackPropertyAnalytics(previewMode)"), true);
  assert.equal(showcaseViewSource.includes('trackEvent("request_viewing_opened")'), true);
  assert.equal(showcaseViewSource.includes('trackEvent("gallery_opened")'), true);
  assert.equal(showcaseViewSource.includes('trackEvent("agent_whatsapp_clicked")'), true);
  assert.equal(showcaseViewSource.includes('trackEvent("agent_phone_clicked")'), true);
  assert.equal(showcaseViewSource.includes('trackEvent("agent_email_clicked")'), true);
  assert.equal(analyticsClientSource.includes("propertyId"), false);
  assert.equal(analyticsClientSource.includes("email"), false);
  assert.equal(analyticsClientSource.includes("phone"), false);
});
