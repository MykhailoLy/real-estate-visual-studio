import assert from "node:assert/strict";
import test from "node:test";
import { getActivePropertyBranding } from "./branding.ts";
import { costaBlancaDemo } from "./registry.ts";
import { PropertyShowcaseSchema } from "./schema.ts";
import type { PropertyShowcase } from "./types.ts";

function cloneProperty(): PropertyShowcase {
  return structuredClone(costaBlancaDemo);
}

test("unbranded properties retain the default PicchuSpot presentation", () => {
  const property = cloneProperty();
  property.translations = undefined;
  assert.equal(getActivePropertyBranding(property), null);
  assert.equal(PropertyShowcaseSchema.safeParse(property).success, true);
});

test("custom branding is parsed safely and retains the existing agent contact model", () => {
  const property = cloneProperty();
  property.translations = undefined;
  property.branding = {
    enabled: true,
    brandName: "Costa Blanca Luxury Homes",
    logoUrl: "/property-demo/terrace.svg",
    websiteUrl: "https://example.com/listings",
    primaryColor: "#0B1F3A",
    accentColor: "#B88A44",
    showPicchuSpotCredit: false,
  };

  const parsed = PropertyShowcaseSchema.safeParse(property);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const branding = getActivePropertyBranding(parsed.data);
  assert.deepEqual(branding, {
    brandName: "Costa Blanca Luxury Homes",
    logoUrl: "/property-demo/terrace.svg",
    websiteUrl: "https://example.com/listings",
    primaryColor: "#0B1F3A",
    accentColor: "#B88A44",
    showPicchuSpotCredit: false,
  });
  assert.equal(parsed.data.agent.agentName, "Costa Blanca Property Team");
  assert.equal(parsed.data.agent.phone, "+34 600 000 000");
});

test("branding rejects arbitrary CSS, unsafe websites, and untrusted logo URLs", () => {
  const property = cloneProperty();
  property.translations = undefined;
  property.branding = {
    enabled: true,
    brandName: "Safe Brand",
    primaryColor: "var(--unsafe)",
    accentColor: "#fff",
    websiteUrl: "javascript:alert(1)",
    logoUrl: "https://evil.example/logo.png",
  };

  const parsed = PropertyShowcaseSchema.safeParse(property);
  assert.equal(parsed.success, false);
  if (parsed.success) return;
  const messages = parsed.error.issues.map((issue) => issue.message).join(" ");
  assert.match(messages, /#RRGGBB/);
  assert.match(messages, /http or https/);

  property.branding = {
    enabled: true,
    brandName: "Safe Brand",
    primaryColor: "#0B1F3A",
    accentColor: "#B88A44",
    websiteUrl: "https://example.com",
    logoUrl: "https://evil.example/logo.png",
  };
  const invalidLogo = PropertyShowcaseSchema.safeParse(property);
  assert.equal(invalidLogo.success, false);
  if (!invalidLogo.success) {
    assert.match(
      invalidLogo.error.issues.map((issue) => issue.message).join(" "),
      /public media URL/,
    );
  }
});

test("custom branding uses the existing agency logo when no branding-specific logo is set", () => {
  const property = cloneProperty();
  property.agent.logoUrl = "/property-demo/exterior.svg";
  property.branding = {
    enabled: true,
    brandName: "Alicante Prime Realty",
  };

  assert.equal(
    getActivePropertyBranding(property)?.logoUrl,
    "/property-demo/exterior.svg",
  );
  assert.equal(
    getActivePropertyBranding(property)?.showPicchuSpotCredit,
    true,
  );
});

test("custom branding remains name-first when no safe agency logo is available", () => {
  const property = cloneProperty();
  property.agent.logoUrl = "https://untrusted.example/agency-logo.png";
  property.branding = {
    enabled: true,
    brandName: "Alicante Prime Realty",
    websiteUrl: "https://example.com",
  };

  const branding = getActivePropertyBranding(property);
  assert.equal(branding?.brandName, "Alicante Prime Realty");
  assert.equal(branding?.logoUrl, undefined);
  assert.equal(branding?.websiteUrl, "https://example.com/");
  assert.equal(branding?.showPicchuSpotCredit, true);
  assert.equal(property.agent.agentName, "Costa Blanca Property Team");
  assert.equal(property.agent.phone, "+34 600 000 000");
});
