import assert from "node:assert/strict";
import test from "node:test";
import { STAGING_ADDONS } from "../data/order-options.ts";
import { getOrderServiceCatalogEntry } from "./order-service-catalog.ts";
import {
  SUPPORT_ORDER_PREFILL_STORAGE_KEY,
  SUPPORT_ORDER_PREFILL_TTL_MS,
  consumeSupportOrderPrefill,
  parseSupportOrderPrefill,
  resolveSupportOrderRecommendation,
  writeSupportOrderPrefill,
} from "./support-order-prefill.ts";

class MemoryStorage {
  entries = new Map<string, string>();
  failGet = false;
  failSet = false;
  failRemove = false;

  getItem(key: string): string | null {
    if (this.failGet) throw new Error("get failed");
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failSet) throw new Error("set failed");
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    if (this.failRemove) throw new Error("remove failed");
    this.entries.delete(key);
  }
}

test("supported recommendation resolves to Virtual Staging plus Image Enhancement only", () => {
  assert.deepEqual(
    resolveSupportOrderRecommendation("virtual-staging-image-enhancement"),
    {
      serviceId: "virtual-staging",
      addOnIds: ["image-enhancement"],
    },
  );
});

test("the recommended add-on exists in STAGING_ADDONS", () => {
  assert.equal(
    STAGING_ADDONS.some((addOn) => addOn.id === "image-enhancement"),
    true,
  );
});

test("the recommended service route resolves canonically", () => {
  assert.equal(
    getOrderServiceCatalogEntry("virtual-staging")?.route,
    "/dashboard/orders/new/virtual-staging",
  );
});

test("unknown recommendation IDs return null", () => {
  assert.equal(resolveSupportOrderRecommendation("unknown"), null);
});

test("the recommendation cannot override the main service", () => {
  assert.equal(
    resolveSupportOrderRecommendation(
      "virtual-staging-image-enhancement",
      "image-enhancement",
    ),
    null,
  );
});

test("arbitrary model-provided add-on arrays are ignored by the resolver", () => {
  assert.deepEqual(
    resolveSupportOrderRecommendation("virtual-staging-image-enhancement"),
    {
      serviceId: "virtual-staging",
      addOnIds: ["image-enhancement"],
    },
  );
});

test("returned recommendation objects are fresh", () => {
  const first = resolveSupportOrderRecommendation(
    "virtual-staging-image-enhancement",
  );
  assert.notEqual(first, null);
  first!.addOnIds.push("day-to-dusk");

  assert.deepEqual(
    resolveSupportOrderRecommendation("virtual-staging-image-enhancement"),
    {
      serviceId: "virtual-staging",
      addOnIds: ["image-enhancement"],
    },
  );
});

test("valid prefill writes and consumes once", () => {
  const storage = new MemoryStorage();
  assert.equal(
    writeSupportOrderPrefill(
      storage,
      { serviceId: "virtual-staging", addOnIds: ["image-enhancement"] },
      1000,
    ),
    true,
  );

  assert.deepEqual(consumeSupportOrderPrefill(storage, "virtual-staging", 1000), {
    serviceId: "virtual-staging",
    addOnIds: ["image-enhancement"],
  });
  assert.equal(consumeSupportOrderPrefill(storage, "virtual-staging", 1000), null);
});

test("stored payload contains only approved fields", () => {
  const storage = new MemoryStorage();
  writeSupportOrderPrefill(
    storage,
    {
      serviceId: "virtual-staging",
      addOnIds: ["image-enhancement"],
      href: "javascript:alert(1)",
      price: 1,
      currency: "USD",
      quantity: 99,
      message: "customer text",
      orderId: "order",
      draftId: "draft",
    } as never,
    1000,
  );

  const rawPayload = storage.entries.get(SUPPORT_ORDER_PREFILL_STORAGE_KEY);
  assert.ok(rawPayload);
  assert.deepEqual(Object.keys(JSON.parse(rawPayload)).sort(), [
    "addOnIds",
    "createdAt",
    "serviceId",
    "version",
  ]);
  assert.equal(/href|price|currency|quantity|message|orderId|draftId/.test(rawPayload), false);
});

test("expired payload is removed and TTL boundary is deterministic", () => {
  const storage = new MemoryStorage();
  writeSupportOrderPrefill(
    storage,
    { serviceId: "virtual-staging", addOnIds: ["image-enhancement"] },
    1000,
  );
  assert.notEqual(
    consumeSupportOrderPrefill(
      storage,
      "virtual-staging",
      1000 + SUPPORT_ORDER_PREFILL_TTL_MS,
    ),
    null,
  );

  writeSupportOrderPrefill(
    storage,
    { serviceId: "virtual-staging", addOnIds: ["image-enhancement"] },
    1000,
  );
  assert.equal(
    consumeSupportOrderPrefill(
      storage,
      "virtual-staging",
      1001 + SUPPORT_ORDER_PREFILL_TTL_MS,
    ),
    null,
  );
  assert.equal(storage.entries.has(SUPPORT_ORDER_PREFILL_STORAGE_KEY), false);
});

test("malformed payload is removed", () => {
  const storage = new MemoryStorage();
  storage.entries.set(SUPPORT_ORDER_PREFILL_STORAGE_KEY, "{not-json");

  assert.equal(consumeSupportOrderPrefill(storage, "virtual-staging"), null);
  assert.equal(storage.entries.has(SUPPORT_ORDER_PREFILL_STORAGE_KEY), false);
});

test("wrong service payload is removed", () => {
  const storage = new MemoryStorage();
  writeSupportOrderPrefill(
    storage,
    { serviceId: "virtual-staging", addOnIds: ["image-enhancement"] },
    1000,
  );

  assert.equal(consumeSupportOrderPrefill(storage, "image-enhancement", 1000), null);
  assert.equal(storage.entries.has(SUPPORT_ORDER_PREFILL_STORAGE_KEY), false);
});

test("unknown and extra add-ons are rejected", () => {
  assert.equal(
    parseSupportOrderPrefill({
      version: 1,
      createdAt: 1000,
      serviceId: "virtual-staging",
      addOnIds: ["image-enhancement", "day-to-dusk"],
    }),
    null,
  );
  assert.equal(
    parseSupportOrderPrefill({
      version: 1,
      createdAt: 1000,
      serviceId: "virtual-staging",
      addOnIds: ["unknown"],
    }),
    null,
  );
});

test("duplicate add-ons are normalized", () => {
  assert.deepEqual(
    parseSupportOrderPrefill({
      version: 1,
      createdAt: 1000,
      serviceId: "virtual-staging",
      addOnIds: ["image-enhancement", "image-enhancement"],
    }),
    {
      version: 1,
      createdAt: 1000,
      serviceId: "virtual-staging",
      addOnIds: ["image-enhancement"],
    },
  );
});

test("storage read and write failures are safe", () => {
  const storage = new MemoryStorage();
  storage.failSet = true;
  assert.equal(
    writeSupportOrderPrefill(
      storage,
      { serviceId: "virtual-staging", addOnIds: ["image-enhancement"] },
      1000,
    ),
    false,
  );

  storage.failSet = false;
  writeSupportOrderPrefill(
    storage,
    { serviceId: "virtual-staging", addOnIds: ["image-enhancement"] },
    1000,
  );
  storage.failGet = true;
  assert.equal(consumeSupportOrderPrefill(storage, "virtual-staging", 1000), null);
});

test("storage remove failure returns null and does not throw", () => {
  const storage = new MemoryStorage();
  writeSupportOrderPrefill(
    storage,
    { serviceId: "virtual-staging", addOnIds: ["image-enhancement"] },
    1000,
  );
  storage.failRemove = true;

  let consumed: ReturnType<typeof consumeSupportOrderPrefill> | undefined;
  assert.doesNotThrow(() => {
    consumed = consumeSupportOrderPrefill(storage, "virtual-staging", 1000);
  });
  assert.equal(consumed, null);
  assert.equal(storage.entries.has(SUPPORT_ORDER_PREFILL_STORAGE_KEY), true);
});

test("cleanup failures for malformed payloads remain best-effort", () => {
  const storage = new MemoryStorage();
  storage.entries.set(SUPPORT_ORDER_PREFILL_STORAGE_KEY, "{not-json");
  storage.failGet = false;
  storage.failRemove = true;

  assert.equal(consumeSupportOrderPrefill(storage, "virtual-staging", 1000), null);
  assert.equal(storage.entries.has(SUPPORT_ORDER_PREFILL_STORAGE_KEY), true);
});
