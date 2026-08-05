import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  handlePropertyLeadRequest,
  propertyLeadWhatsAppUrl,
  type PropertyLeadDependencies,
} from "./property-leads.ts";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    propertySlug: "sea-view-residence",
    locale: "en",
    name: "Alex Morgan",
    email: "Alex@example.com",
    phone: "+34 600 123 456",
    preferredDate: "2026-09-18",
    preferredTime: "11:30",
    message: "We would like to visit while in Altea.",
    website: "",
    turnstileToken: "verified-token",
    ...overrides,
  };
}

function request(body: unknown) {
  return new Request("https://picchuspot.com/api/property-leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function dependencies(
  overrides: Partial<PropertyLeadDependencies> = {},
): PropertyLeadDependencies {
  return {
    checkRateLimit: async () => ({ allowed: true }),
    verifySpam: async () => "valid",
    findPublishedProperty: async () => ({
      id: "00000000-0000-4000-8000-000000000001",
      property: structuredClone(costaBlancaDemo),
    }),
    insertLead: async () => ({ id: "00000000-0000-4000-8000-000000000002" }),
    updateNotification: async () => undefined,
    sendNotification: async () => ({ status: "sent" }),
    now: () => new Date("2026-08-05T10:00:00.000Z"),
    ...overrides,
  };
}

test("a valid lead is stored before notification and recipient is resolved server-side", async () => {
  const calls: string[] = [];
  let inserted: unknown;
  let notifiedRecipient: string | undefined;
  const response = await handlePropertyLeadRequest(
    request(validBody()),
    dependencies({
      insertLead: async (lead) => {
        calls.push("insert");
        inserted = lead;
        return { id: "lead-1" };
      },
      sendNotification: async (notification) => {
        calls.push("notify");
        notifiedRecipient = notification.recipientEmail;
        return { status: "sent" };
      },
      updateNotification: async () => {
        calls.push("update");
      },
    }),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(calls, ["insert", "notify", "update"]);
  assert.equal(notifiedRecipient, "listings@example.com");
  assert.deepEqual(inserted, {
    propertyId: "00000000-0000-4000-8000-000000000001",
    propertySlug: "sea-view-residence",
    name: "Alex Morgan",
    email: "alex@example.com",
    phone: "+34 600 123 456",
    preferredDate: "2026-09-18",
    preferredTime: "11:30",
    message: "We would like to visit while in Altea.",
    locale: "en",
    source: "property-showcase",
    notificationEmailStatus: "pending",
  });
});

test("invalid, unknown and unpublished property submissions are rejected", async () => {
  let inserted = false;
  const invalid = await handlePropertyLeadRequest(
    request(validBody({ email: "not-an-email" })),
    dependencies({
      insertLead: async () => {
        inserted = true;
        return { id: "unexpected" };
      },
    }),
  );
  assert.equal(invalid.status, 400);
  assert.equal(inserted, false);

  const impossibleDate = await handlePropertyLeadRequest(
    request(validBody({ preferredDate: "2026-02-31" })),
    dependencies(),
  );
  assert.equal(impossibleDate.status, 400);

  const unknown = await handlePropertyLeadRequest(
    request(validBody()),
    dependencies({ findPublishedProperty: async () => null }),
  );
  assert.equal(unknown.status, 404);
});

test("browser-supplied property identity or recipient fields are rejected", async () => {
  const response = await handlePropertyLeadRequest(
    request(
      validBody({
        propertyId: "forged-property",
        recipientEmail: "attacker@example.com",
      }),
    ),
    dependencies(),
  );
  assert.equal(response.status, 400);
});

test("email failure retains the stored lead and returns an honest accepted result", async () => {
  const calls: string[] = [];
  let recordedStatus = "";
  const response = await handlePropertyLeadRequest(
    request(validBody()),
    dependencies({
      insertLead: async () => {
        calls.push("insert");
        return { id: "lead-1" };
      },
      sendNotification: async () => {
        calls.push("notify");
        return { status: "failed", error: "provider unavailable" };
      },
      updateNotification: async (update) => {
        calls.push("update");
        recordedStatus = update.status;
      },
    }),
  );
  const body = (await response.json()) as { notificationStatus: string };

  assert.equal(response.status, 202);
  assert.equal(body.notificationStatus, "failed");
  assert.equal(recordedStatus, "failed");
  assert.deepEqual(calls, ["insert", "notify", "update"]);
});

test("rate limiting and spam protection stop storage", async () => {
  let inserted = false;
  const blocked = await handlePropertyLeadRequest(
    request(validBody()),
    dependencies({
      checkRateLimit: async () => ({ allowed: false, retryAfterSeconds: 90 }),
      insertLead: async () => {
        inserted = true;
        return { id: "unexpected" };
      },
    }),
  );
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "90");
  assert.equal(inserted, false);

  const spam = await handlePropertyLeadRequest(
    request(validBody()),
    dependencies({
      verifySpam: async () => "invalid",
      insertLead: async () => {
        inserted = true;
        return { id: "unexpected" };
      },
    }),
  );
  assert.equal(spam.status, 400);
  assert.equal(inserted, false);
});

test("WhatsApp handoff is localized, manual and absent without a configured number", async () => {
  assert.equal(
    propertyLeadWhatsAppUrl({
      applicantName: "Alex Morgan",
      propertyTitle: "Sea View Residence",
      publicUrl: "https://picchuspot.com/property/sea-view-residence",
      locale: "en",
    }),
    undefined,
  );
  const url = propertyLeadWhatsAppUrl({
    whatsapp: "+34 600 123 456",
    applicantName: "Alex Morgan",
    propertyTitle: "Sea View Residence",
    publicUrl: "https://picchuspot.com/property/sea-view-residence",
    preferredDate: "2026-09-18",
    preferredTime: "11:30",
    locale: "en",
  });
  assert.match(url ?? "", /^https:\/\/wa\.me\/34600123456\?text=/);
  assert.equal(decodeURIComponent(url ?? "").includes("Alex"), true);
  assert.equal(decodeURIComponent(url ?? "").includes("2026-09-18 11:30"), true);
});

test("property leads migration exposes no browser read or insert policy", () => {
  const migration = readFileSync(
    new URL("../../../supabase/add-property-leads.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.property_leads from anon/i);
  assert.match(migration, /revoke all on table public\.property_leads from authenticated/i);
  assert.doesNotMatch(migration, /create policy[\s\S]+property_leads/i);
  assert.match(migration, /grant select, insert, update, delete[\s\S]+service_role/i);
});
