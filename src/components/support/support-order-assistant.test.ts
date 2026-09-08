import assert from "node:assert/strict";
import test from "node:test";
import { ORDER_SERVICE_CATALOG } from "../../lib/order-service-catalog.ts";
import {
  getActiveOrderServiceCatalogEntries,
  getOrderAssistantGoals,
  getOrderAssistantQuestion,
  getOrderAssistantRecommendation,
  getOrderAssistantService,
  getOrderAssistantServices,
  isOrderAssistantOrderHref,
} from "./support-order-assistant.ts";

const canonicalServices = new Map(
  ORDER_SERVICE_CATALOG.map((service) => [service.slug, service]),
);

test("every supported initial goal has English and Spanish labels", () => {
  const english = getOrderAssistantGoals("en");
  const spanish = getOrderAssistantGoals("es");

  assert.equal(english.length, spanish.length);
  assert.equal(english.length > 0, true);

  for (const [index, goal] of english.entries()) {
    assert.equal(goal.label.trim().length > 0, true, goal.id);
    assert.equal(spanish[index]?.label.trim().length > 0, true, goal.id);
  }
});

test("English and Spanish goal ordering remains stable", () => {
  assert.deepEqual(
    getOrderAssistantGoals("en").map((goal) => goal.id),
    getOrderAssistantGoals("es").map((goal) => goal.id),
  );
  assert.deepEqual(
    getOrderAssistantGoals("en").map((goal) => goal.id),
    [
      "add-furniture-empty-rooms",
      "change-furniture-or-finishes",
      "remove-objects-or-clean-room",
      "improve-brightness-colour-presentation",
      "turn-daytime-exterior-to-dusk",
      "create-floor-plan",
    ],
  );
});

test("all supported goals retain both languages and a recommendable service", () => {
  const english = getOrderAssistantGoals("en");
  const spanish = getOrderAssistantGoals("es");

  for (const [index, goal] of english.entries()) {
    assert.equal(typeof goal.recommendedServiceId, "string", goal.id);
    assert.equal(goal.label.length > 0, true, goal.id);
    assert.equal(spanish[index]?.id, goal.id);
    assert.equal((spanish[index]?.label ?? "").length > 0, true, goal.id);
  }
});

test("every recommendation resolves to an active canonical New Order service", () => {
  for (const goal of getOrderAssistantGoals("en")) {
    const recommendation = getOrderAssistantRecommendation(goal.id);
    const canonical = recommendation
      ? canonicalServices.get(recommendation.id)
      : null;

    assert.notEqual(recommendation, null, goal.id);
    assert.notEqual(canonical, undefined, goal.id);
    assert.equal(canonical?.availability, "active", goal.id);
  }
});

test("every recommended service has a non-null canonical route", () => {
  for (const goal of getOrderAssistantGoals("en")) {
    const recommendation = getOrderAssistantRecommendation(goal.id);
    const canonical = recommendation
      ? canonicalServices.get(recommendation.id)
      : null;

    assert.equal(typeof canonical?.route, "string", goal.id);
    assert.equal(canonical?.route !== null, true, goal.id);
  }
});

test("chooser order routes come from the canonical registry", () => {
  for (const goal of getOrderAssistantGoals("en")) {
    const recommendation = getOrderAssistantRecommendation(goal.id);
    const canonical = recommendation
      ? canonicalServices.get(recommendation.id)
      : null;

    assert.equal(recommendation?.orderHref, canonical?.route, goal.id);
  }
});

test("photo-editing is not present in chooser services", () => {
  assert.equal(getOrderAssistantService("photo-editing"), null);
  assert.equal(
    getOrderAssistantServices().some((service: { id: string }) => service.id === "photo-editing"),
    false,
  );
});

test("the hidden legacy photo-editing route is not returned", () => {
  for (const service of getOrderAssistantServices()) {
    assert.notEqual(service.orderHref, "/dashboard/orders/new/photo-editing");
  }

  for (const goal of getOrderAssistantGoals("en")) {
    assert.notEqual(
      getOrderAssistantRecommendation(goal.id)?.orderHref,
      "/dashboard/orders/new/photo-editing",
      goal.id,
    );
  }
});

test("no coming-soon or custom-quote service is recommended", () => {
  for (const goal of getOrderAssistantGoals("en")) {
    const recommendation = getOrderAssistantRecommendation(goal.id);

    assert.notEqual(recommendation?.availability, "coming-soon", goal.id);
    assert.notEqual(recommendation?.availability, "custom-quote", goal.id);
  }
});

test("Improve brightness, colour and presentation recommends Image Enhancement directly", () => {
  assert.equal(
    getOrderAssistantRecommendation("improve-brightness-colour-presentation")
      ?.id,
    "image-enhancement",
  );
});

test("removed legacy second-step ids return null", () => {
  assert.equal(getOrderAssistantRecommendation("improve-existing-photo"), null);
  assert.equal(
    getOrderAssistantRecommendation("request-specific-photo-edit"),
    null,
  );
  assert.equal(
    getOrderAssistantRecommendation(
      "improve-existing-photo",
      "request-specific-photo-edit",
    ),
    null,
  );
  assert.equal(
    getOrderAssistantRecommendation(
      "improve-existing-photo",
      "improve-brightness-colour-presentation",
    ),
    null,
  );
});

test("unknown ids return null", () => {
  assert.equal(getOrderAssistantRecommendation(""), null);
  assert.equal(getOrderAssistantRecommendation("does-not-exist"), null);
  assert.equal(getOrderAssistantRecommendation("photo-editing-goal"), null);
});

test("a raw answer id cannot resolve as a standalone top-level goal", () => {
  assert.equal(getOrderAssistantRecommendation("request-specific-photo-edit"), null);
});

test("Floor Plans uses the canonical registry route", () => {
  const canonical = canonicalServices.get("floor-plans");

  assert.equal(
    getOrderAssistantRecommendation("create-floor-plan")?.orderHref,
    canonical?.route,
  );
});

test("every chooser order href remains under the dashboard New Order route", () => {
  for (const service of getOrderAssistantServices()) {
    assert.equal(isOrderAssistantOrderHref(service.orderHref), true, service.id);
    assert.equal(service.orderHref.includes("?"), false, service.id);
    assert.equal(service.orderHref.startsWith("/api/"), false, service.id);
    assert.equal(service.orderHref.includes("/api/"), false, service.id);
  }
});

test("public detail hrefs are localized only for known public pricing pages", () => {
  const itemRemoval = getOrderAssistantService("item-removal-virtual-cleaning");
  const services = getOrderAssistantServices();
  const servicesWithDetails = services.filter((service) => service.detailHref);

  assert.equal(servicesWithDetails.length, services.length);
  assert.equal(itemRemoval?.detailHref?.en, "/pricing/photo-editing");
  assert.equal(itemRemoval?.detailHref?.es, "/es/pricing/photo-editing");

  for (const service of servicesWithDetails) {
    assert.equal(service.detailHref?.en.startsWith("/pricing/"), true, service.id);
    assert.equal(
      service.detailHref?.es.startsWith("/es/pricing/"),
      true,
      service.id,
    );
  }
});

test("catalog values contain no pricing fields or values", () => {
  for (const service of getOrderAssistantServices()) {
    assert.equal(hasPricingKey(service), false, service.id);
  }
});

test("helpers do not mutate source catalog objects", () => {
  const service = getOrderAssistantService("virtual-staging");
  assert.notEqual(service, null);
  service!.labels.en = "Changed";
  service!.reasons.en = "Changed";
  service!.detailHref!.en = "/changed";

  const fresh = getOrderAssistantService("virtual-staging");
  assert.equal(fresh?.labels.en, canonicalServices.get("virtual-staging")?.title);
  assert.equal(fresh?.detailHref?.en, "/pricing/virtual-staging");
});

test("active catalog helper returns only active services with routes", () => {
  for (const service of getActiveOrderServiceCatalogEntries()) {
    assert.equal(service.availability, "active", service.slug);
    assert.notEqual(service.route, null, service.slug);
  }
});

test("opening the chooser itself has no support API action", () => {
  const firstQuestion = getOrderAssistantQuestion("en");

  assert.notEqual(firstQuestion, null);
  assert.equal(JSON.stringify(firstQuestion).includes("/api/support"), false);
  assert.equal(
    JSON.stringify(getOrderAssistantServices()).includes("/api/support"),
    false,
  );
});

function hasPricingKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/price|pricing|currency|amount/i.test(key)) return true;
    if (hasPricingKey(child)) return true;
  }

  return false;
}
