import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPropertyLeadEmailPayload,
  normalizeInternationalWhatsAppPhone,
} from "../../lib/email/property-lead-email-template.ts";
import type { PropertyLeadNotificationInput } from "./property-leads.ts";
import { costaBlancaDemo } from "./registry.ts";
import type { PropertyShowcase } from "./types.ts";

function property(): PropertyShowcase {
  const result = structuredClone(costaBlancaDemo);
  result.slug = "sea-view-residence";
  result.reference = "PS-001";
  result.title = { en: "Sea View Residence" };
  return result;
}

function notificationInput(
  overrides: Partial<PropertyLeadNotificationInput["applicant"]> = {},
  propertyOverride = property(),
): PropertyLeadNotificationInput {
  return {
    leadId: "00000000-0000-4000-8000-000000000002",
    property: propertyOverride,
    applicant: {
      propertySlug: "sea-view-residence",
      locale: "en",
      name: "Alex Morgan",
      email: "alex@example.com",
      phone: "+34 600 123 456",
      preferredDate: "2026-09-18",
      preferredTime: "11:30",
      message: "We would like to visit while in Altea.",
      website: "",
      turnstileToken: "verified-token",
      ...overrides,
    },
    recipientEmail: "listings@example.com",
    publicUrl: "https://attacker.example/property/wrong",
    receivedAt: "2026-08-05T10:00:00.000Z",
  };
}

function build(
  input = notificationInput(),
) {
  return buildPropertyLeadEmailPayload(input, {
    from: "PicchuSpot Property Leads <leads@picchuspot.com>",
    recipientEmail: "listings@example.com",
    ccEmail: "operations@picchuspot.com",
  });
}

test("complete viewing request renders compact HTML, plain text, actions, Reply-To and CC", () => {
  const exact = property();
  exact.location = {
    displayAddress: { en: "46 Calle San Pablo, Altea" },
    streetAddress: "46 Calle San Pablo",
    city: "Altea",
    region: "Alicante",
    postalCode: "03590",
    country: "Spain",
    privacyMode: "exact",
    showMap: true,
    latitude: 38.603912,
    longitude: -0.045316,
  };
  const payload = build(notificationInput({}, exact));
  const canonicalUrl = "https://picchuspot.com/property/sea-view-residence";

  assert.equal(
    payload.subject,
    "New viewing request: Sea View Residence — Alex Morgan",
  );
  assert.equal(payload.replyTo, "alex@example.com");
  assert.equal(payload.cc, "operations@picchuspot.com");
  assert.equal(payload.to, "listings@example.com");
  assert.match(payload.html, /Picchu<span[^>]*>Spot<\/span>/);
  assert.match(payload.html, /New viewing request/);
  assert.match(payload.html, /46 Calle San Pablo, Altea, Alicante, 03590, Spain/);
  assert.match(payload.html, /PS-001/);
  assert.match(payload.html, /Alex Morgan/);
  assert.match(payload.html, /alex@example\.com/);
  assert.match(payload.html, /\+34 600 123 456/);
  assert.match(payload.html, /18 September 2026 \(visitor local date\)/);
  assert.match(payload.html, /11:30 \(visitor local time\)/);
  assert.match(payload.html, /We would like to visit while in Altea\./);
  assert.match(payload.html, /05 Aug 2026, 10:00 UTC/);
  assert.equal(payload.html.includes("2026-08-05T10:00:00.000Z"), false);
  assert.equal(payload.html.includes(canonicalUrl), true);
  assert.equal(payload.html.includes("https://attacker.example"), false);
  assert.match(payload.html, /href="mailto:alex%40example\.com"/);
  assert.match(payload.html, /href="tel:\+34600123456"/);
  assert.match(payload.html, /https:\/\/wa\.me\/34600123456\?text=/);

  for (const essential of [
    "Sea View Residence",
    canonicalUrl,
    "46 Calle San Pablo, Altea, Alicante, 03590, Spain",
    "PS-001",
    "Alex Morgan",
    "alex@example.com",
    "+34 600 123 456",
    "18 September 2026 (visitor local date)",
    "11:30 (visitor local time)",
    "We would like to visit while in Altea.",
    "mailto:alex%40example.com",
    "tel:+34600123456",
    "https://wa.me/34600123456?text=",
    "UTC",
  ]) {
    assert.equal(payload.text.includes(essential), true, essential);
  }
});

test("optional phone and its call and WhatsApp actions are omitted cleanly", () => {
  const payload = build(notificationInput({ phone: "" }));

  assert.doesNotMatch(payload.html, />Phone</);
  assert.doesNotMatch(payload.html, /Call applicant/);
  assert.doesNotMatch(payload.html, /Message applicant on WhatsApp/);
  assert.doesNotMatch(payload.text, /^Phone:/m);
  assert.doesNotMatch(payload.text, /Call applicant:/);
  assert.doesNotMatch(payload.text, /Message applicant on WhatsApp:/);
});

test("requested viewing section is omitted without a preferred date or time", () => {
  const payload = build(
    notificationInput({ preferredDate: "", preferredTime: "" }),
  );

  assert.doesNotMatch(payload.html, /Requested viewing/);
  assert.doesNotMatch(payload.html, /Preferred date/);
  assert.doesNotMatch(payload.html, /Preferred time/);
  assert.doesNotMatch(payload.text, /REQUESTED VIEWING/);
});

test("message section is omitted without an applicant message", () => {
  const payload = build(notificationInput({ message: "" }));

  assert.doesNotMatch(payload.html, />Message<\/h2>/);
  assert.doesNotMatch(payload.text, /^MESSAGE$/m);
});

test("approximate location uses only the configured public area label", () => {
  const approximate = property();
  approximate.location = {
    displayAddress: { en: "123 Private Parcel Road" },
    streetAddress: "123 Private Parcel Road",
    city: "Private City",
    region: "Private Region",
    postalCode: "03590",
    country: "Spain",
    approximateLabel: { en: "Public Altea Hills area" },
    privacyMode: "approximate",
    showMap: true,
    latitude: 38.603912,
    longitude: -0.045316,
    approximateLatitude: 38.72,
    approximateLongitude: -0.12,
    approximateRadiusMeters: 2600,
    mapExternalUrl: "https://maps.example/private-parcel",
  };
  const payload = build(notificationInput({}, approximate));
  const combined = `${payload.html}\n${payload.text}`;

  assert.equal(combined.includes("Public Altea Hills area"), true);
  for (const privateValue of [
    "123 Private Parcel Road",
    "Private City",
    "Private Region",
    "38.603912",
    "-0.045316",
    "38.72",
    "-0.12",
    "2600",
    "private-parcel",
  ]) {
    assert.equal(combined.includes(privateValue), false, privateValue);
  }
});

test("hidden location is omitted without leaking address or coordinates", () => {
  const hidden = property();
  hidden.location = {
    displayAddress: { en: "88 Hidden Estate" },
    streetAddress: "88 Hidden Estate",
    city: "Hidden City",
    approximateLabel: { en: "Hidden district" },
    privacyMode: "hidden",
    showMap: false,
    latitude: 38.688771,
    longitude: 0.134412,
    approximateLatitude: 38.7,
    approximateLongitude: 0.1,
  };
  const payload = build(notificationInput({}, hidden));
  const combined = `${payload.html}\n${payload.text}`;

  assert.doesNotMatch(combined, /Public location/);
  for (const privateValue of [
    "88 Hidden Estate",
    "Hidden City",
    "Hidden district",
    "38.688771",
    "0.134412",
    "38.7",
  ]) {
    assert.equal(combined.includes(privateValue), false, privateValue);
  }
});

test("WhatsApp action requires an explicit E.164-compatible international phone", () => {
  assert.equal(
    normalizeInternationalWhatsAppPhone("+34 (600) 123-456"),
    "34600123456",
  );
  for (const ambiguous of [
    "600 123 456",
    "0034 600 123 456",
    "+0123456789",
    "+34 600 123 456 ext 2",
  ]) {
    assert.equal(normalizeInternationalWhatsAppPhone(ambiguous), undefined);
  }

  const localOnly = build(notificationInput({ phone: "600 123 456" }));
  assert.match(localOnly.html, /href="tel:600123456"/);
  assert.doesNotMatch(localOnly.html, /wa\.me/);
  assert.doesNotMatch(localOnly.text, /Message applicant on WhatsApp:/);
});

test("untrusted applicant content is escaped in HTML and stripped of header newlines", () => {
  const payload = build(
    notificationInput({
      name: "Alex\r\nBcc: attacker@example.com <script>alert(1)</script>",
      message: "<img src=x onerror=alert(1)>\nPlease call & confirm.",
    }),
  );

  assert.equal(payload.subject.includes("\r"), false);
  assert.equal(payload.subject.includes("\n"), false);
  assert.equal(payload.html.includes("<script>alert(1)</script>"), false);
  assert.equal(payload.html.includes("<img src=x onerror=alert(1)>"), false);
  assert.match(payload.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(payload.html, /&lt;img src=x onerror=alert\(1\)&gt;<br>Please call &amp; confirm\./);
});
