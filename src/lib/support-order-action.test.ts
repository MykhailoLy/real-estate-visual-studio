import assert from "node:assert/strict";
import test from "node:test";
import { ORDER_SERVICE_CATALOG } from "./order-service-catalog.ts";
import {
  parseSupportOrderAction,
  resolveSupportOrderAction,
} from "./support-order-action.ts";

const activeServicesWithRoutes = ORDER_SERVICE_CATALOG.filter(
  (service) => service.availability === "active" && service.route !== null,
);

test("every active canonical online service resolves", () => {
  assert.equal(activeServicesWithRoutes.length > 0, true);

  for (const service of activeServicesWithRoutes) {
    assert.deepEqual(resolveSupportOrderAction(service.slug), {
      type: "start_order",
      serviceId: service.slug,
      href: service.route,
    });
  }
});

test("every resolved href comes from the canonical catalog", () => {
  for (const service of activeServicesWithRoutes) {
    assert.equal(resolveSupportOrderAction(service.slug)?.href, service.route);
  }
});

test("resolved routes remain under the dashboard new order route", () => {
  for (const service of activeServicesWithRoutes) {
    const resolved = resolveSupportOrderAction(service.slug);

    assert.notEqual(resolved, null, service.slug);
    assert.equal(
      resolved!.href === "/dashboard/orders/new" ||
        resolved!.href.startsWith("/dashboard/orders/new/"),
      true,
      service.slug,
    );
  }
});

test("resolved routes contain no query string", () => {
  for (const service of activeServicesWithRoutes) {
    const href = resolveSupportOrderAction(service.slug)?.href;

    assert.equal(href?.includes("?"), false, service.slug);
    assert.equal(href?.includes("#"), false, service.slug);
  }
});

test("coming-soon services do not resolve", () => {
  for (const service of ORDER_SERVICE_CATALOG.filter(
    (item) => item.availability === "coming-soon",
  )) {
    assert.equal(resolveSupportOrderAction(service.slug), null, service.slug);
  }
});

test("custom-quote services do not resolve", () => {
  for (const service of ORDER_SERVICE_CATALOG.filter(
    (item) => item.availability === "custom-quote",
  )) {
    assert.equal(resolveSupportOrderAction(service.slug), null, service.slug);
  }
});

test("unknown services do not resolve", () => {
  assert.equal(resolveSupportOrderAction("does-not-exist"), null);
});

test("hidden photo-editing service does not resolve", () => {
  assert.equal(resolveSupportOrderAction("photo-editing"), null);
});

test("an arbitrary href payload cannot override the canonical route", () => {
  const action = parseSupportOrderAction({
    type: "start_order",
    serviceId: "virtual-staging",
    href: "javascript:alert(1)",
  });
  const resolved = action ? resolveSupportOrderAction(action.serviceId) : null;

  assert.deepEqual(action, {
    type: "start_order",
    serviceId: "virtual-staging",
  });
  assert.equal(resolved?.href, "/dashboard/orders/new/virtual-staging");
});

test("returned objects do not mutate the canonical catalog", () => {
  const resolved = resolveSupportOrderAction("virtual-staging");
  assert.notEqual(resolved, null);

  resolved!.href = "/dashboard/orders/new/changed";
  resolved!.serviceId = "changed";

  assert.deepEqual(resolveSupportOrderAction("virtual-staging"), {
    type: "start_order",
    serviceId: "virtual-staging",
    href: "/dashboard/orders/new/virtual-staging",
  });
});
