import assert from "node:assert/strict";
import test from "node:test";
import {
  getOrderAssistantGoals,
  getOrderAssistantQuestion,
  getOrderAssistantRecommendation,
  getOrderAssistantService,
  getOrderAssistantServices,
  isOrderAssistantOrderHref,
} from "./support-order-assistant.ts";

const expectedOrderHrefs = new Set([
  "/dashboard/orders/new/virtual-staging",
  "/dashboard/orders/new/virtual-renovation",
  "/dashboard/orders/new/item-removal-virtual-cleaning",
  "/dashboard/orders/new/day-to-dusk",
  "/dashboard/orders/new/image-enhancement",
  "/dashboard/orders/new/photo-editing",
  "/dashboard/orders/new/3d-floor-plans",
]);

test("every supported initial goal has English and Spanish labels", () => {
  const english = getOrderAssistantGoals("en");
  const spanish = getOrderAssistantGoals("es");

  assert.equal(english.length, spanish.length);
  assert.equal(english.length > 0, true);

  for (const [index, goal] of english.entries()) {
    assert.equal(goal.label.trim().length > 0, true);
    assert.equal(spanish[index]?.label.trim().length > 0, true);
  }
});

test("every terminal goal resolves to one valid service", () => {
  for (const goal of getOrderAssistantGoals("en")) {
    if (goal.nextQuestionId) continue;

    const recommendation = getOrderAssistantRecommendation(goal.id);
    assert.notEqual(recommendation, null);
    assert.equal(typeof recommendation?.id, "string");
  }
});

test("every service has an existing canonical order href", () => {
  for (const service of getOrderAssistantServices()) {
    assert.equal(expectedOrderHrefs.has(service.orderHref), true, service.id);
  }
});

test("no service order href points to an API route", () => {
  for (const service of getOrderAssistantServices()) {
    assert.equal(service.orderHref.startsWith("/api/"), false, service.id);
    assert.equal(service.orderHref.includes("/api/"), false, service.id);
  }
});

test("order hrefs remain under the existing dashboard New Order route structure", () => {
  for (const service of getOrderAssistantServices()) {
    assert.equal(isOrderAssistantOrderHref(service.orderHref), true, service.id);
    assert.equal(service.orderHref.includes("?"), false, service.id);
  }
});

test("public detail hrefs are localized where available", () => {
  const services = getOrderAssistantServices();
  const withDetail = services.filter((service) => service.detailHref);

  assert.equal(withDetail.length >= 1, true);

  for (const service of withDetail) {
    assert.equal(service.detailHref?.en.startsWith("/pricing/"), true, service.id);
    assert.equal(
      service.detailHref?.es.startsWith("/es/pricing/"),
      true,
      service.id,
    );
  }
});

test("empty or unknown goal ids return no recommendation safely", () => {
  assert.equal(getOrderAssistantRecommendation(""), null);
  assert.equal(getOrderAssistantRecommendation("does-not-exist"), null);
});

test("a second-step goal cannot produce a recommendation before its answer", () => {
  assert.equal(getOrderAssistantRecommendation("improve-existing-photo"), null);
});

test("valid second-step answers produce the correct recommendations", () => {
  assert.equal(
    getOrderAssistantRecommendation(
      "improve-existing-photo",
      "improve-brightness-colour-presentation",
    )?.id,
    "image-enhancement",
  );
  assert.equal(
    getOrderAssistantRecommendation(
      "improve-existing-photo",
      "request-specific-photo-edit",
    )?.id,
    "photo-editing",
  );
});

test("Image Enhancement and Photo Editing remain distinct services", () => {
  const imageEnhancement = getOrderAssistantService("image-enhancement");
  const photoEditing = getOrderAssistantService("photo-editing");

  assert.notEqual(imageEnhancement, null);
  assert.notEqual(photoEditing, null);
  assert.notEqual(imageEnhancement?.id, photoEditing?.id);
  assert.notEqual(imageEnhancement?.orderHref, photoEditing?.orderHref);
});

test("Floor Plans uses the current canonical floor-plan flow", () => {
  assert.equal(
    getOrderAssistantRecommendation("create-floor-plan")?.orderHref,
    "/dashboard/orders/new/3d-floor-plans",
  );
});

test("catalog values contain no pricing fields", () => {
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
  assert.equal(fresh?.labels.en, "Virtual Staging");
  assert.equal(
    fresh?.detailHref?.en,
    "/pricing/virtual-staging",
  );
});

test("English and Spanish goal ordering is stable", () => {
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
      "improve-existing-photo",
      "turn-daytime-exterior-to-dusk",
      "create-floor-plan",
    ],
  );
});

test("opening the chooser itself has no support API action", () => {
  const firstQuestion = getOrderAssistantQuestion("en");

  assert.notEqual(firstQuestion, null);
  assert.equal(JSON.stringify(firstQuestion).includes("/api/support"), false);
  assert.equal(JSON.stringify(getOrderAssistantServices()).includes("/api/support"), false);
});

function hasPricingKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/price|pricing|currency|amount/i.test(key)) return true;
    if (hasPricingKey(child)) return true;
  }

  return false;
}
