import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateActiveDraftExpiry,
  isInsideDraftExpiryWarningWindow,
  ORDER_DRAFT_FILE_KINDS,
  ORDER_DRAFT_FILE_STATUSES,
  ORDER_DRAFT_STATUSES,
} from "./constants.ts";
import {
  BaseDraftStateEnvelopeSchema,
  CreateOrderDraftInputSchema,
  DraftJobTitleSchema,
  DraftFileReferenceSchema,
  OrderDraftFileKindSchema,
  OrderDraftFileStatusSchema,
  OrderDraftStatusSchema,
  PricingPreviewSchema,
  UpdateOrderDraftInputSchema,
  UuidSchema,
} from "./schema.ts";
import {
  buildCreateOrderDraftInsertPayload,
  mapOrderDraftDatabaseRow,
  mapOrderDraftFileDatabaseRow,
  mapOrderDraftSummary,
  normalizeDraftListLimit,
  notFound,
} from "./database.ts";
import {
  createDraftClientItemId,
  mapDraftUpdateOutcome,
} from "./utils.ts";
import {
  JsonNormalizationError,
  normalizeJsonValue,
  stableStringifyJson,
} from "./serialization.ts";
import {
  buildOrderDraftFilePath,
  ORDER_FILES_BUCKET,
  sanitizeOrderDraftFilename,
} from "./storage-paths.ts";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

function validEnvelope() {
  return {
    schemaVersion: 1,
    jobTitle: "123 Main Street",
    currentStep: "configure",
    notes: "Client notes",
    termsUi: { expanded: false },
    metadata: { source: "unit-test" },
    items: [
      {
        clientItemId: UUID_A,
        state: { room: "Living Room", count: 1, enabled: true },
        files: {
          original: {
            draftFileId: UUID_B,
            kind: "original",
            originalFilename: "photo.jpg",
          },
          reference: null,
        },
      },
    ],
  };
}

function validCreateInput() {
  return {
    serviceType: "virtual-staging",
    route: "/dashboard/orders/new/virtual-staging",
    title: "",
    currentStep: "configure",
    state: validEnvelope(),
    pricingPreview: {
      nonAuthoritative: true,
      preview: { totalCents: 1200, currency: "USD" },
    },
    pricingVersionSeen: "pricing-v1",
    currency: "USD",
    region: "US",
  };
}

function validUpdateInput() {
  return {
    expectedVersion: 1,
    currentStep: "configure",
    title: "12",
    state: validEnvelope(),
    pricingPreview: {
      nonAuthoritative: true,
      preview: { totalCents: 1200 },
    },
    pricingVersionSeen: "pricing-v1",
    currency: "USD",
    region: "US",
  };
}

function draftDatabaseRow() {
  return {
    id: UUID_B,
    user_id: UUID_A,
    service_type: "virtual-staging",
    sub_service: null,
    route: "/dashboard/orders/new/virtual-staging",
    title: "123 Main Street",
    current_step: "configure",
    state: validEnvelope(),
    state_schema_version: 1,
    pricing_preview: {
      nonAuthoritative: true,
      preview: { totalCents: 1200 },
    },
    pricing_version_seen: "pricing-v1",
    currency: "USD",
    region: "US",
    status: "active",
    version: 1,
    finalization_key: null,
    converted_order_id: null,
    created_at: "2026-06-26T10:00:00.000Z",
    updated_at: "2026-06-26T10:00:00.000Z",
    last_autosaved_at: "2026-06-26T10:00:00.000Z",
    expires_at: "2026-07-26T10:00:00.000Z",
    converted_at: null,
    deleted_at: null,
  };
}

function draftFileDatabaseRow() {
  return {
    id: UUID_C,
    draft_id: UUID_B,
    item_client_id: UUID_A,
    item_index: 0,
    kind: "original",
    bucket: "order-files",
    storage_path: "drafts/user/draft/file/photo.jpg",
    original_filename: "photo.jpg",
    file_size: 12345,
    mime_type: "image/jpeg",
    content_hash: null,
    upload_status: "uploaded",
    created_at: "2026-06-26T10:00:00.000Z",
    updated_at: "2026-06-26T10:00:00.000Z",
    deleted_at: null,
    moved_at: null,
  };
}

test("allowed status constants match schemas", () => {
  for (const status of ORDER_DRAFT_STATUSES) {
    assert.equal(OrderDraftStatusSchema.parse(status), status);
  }
  for (const status of ORDER_DRAFT_FILE_STATUSES) {
    assert.equal(OrderDraftFileStatusSchema.parse(status), status);
  }
  for (const kind of ORDER_DRAFT_FILE_KINDS) {
    assert.equal(OrderDraftFileKindSchema.parse(kind), kind);
  }
});

test("draft state schema accepts valid JSON-safe state", () => {
  const parsed = BaseDraftStateEnvelopeSchema.parse(validEnvelope());
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.items[0]?.clientItemId, UUID_A);
});

test("draft state requires at least one item", () => {
  assert.equal(
    BaseDraftStateEnvelopeSchema.safeParse({
      ...validEnvelope(),
      items: [],
    }).success,
    false,
  );
});

test("draft job title allows empty and partial values", () => {
  assert.equal(DraftJobTitleSchema.parse(""), "");
  assert.equal(DraftJobTitleSchema.parse("A"), "A");
  assert.equal(DraftJobTitleSchema.parse("AB"), "AB");
  assert.equal(DraftJobTitleSchema.parse("  123 Main Street  "), "123 Main Street");
});

test("draft job title rejects values over 120 characters", () => {
  assert.equal(DraftJobTitleSchema.safeParse("a".repeat(120)).success, true);
  assert.equal(DraftJobTitleSchema.safeParse("a".repeat(121)).success, false);
});

test("create input rejects browser-controlled ownership", () => {
  const result = CreateOrderDraftInputSchema.safeParse({
    ...validCreateInput(),
    userId: UUID_A,
  });
  assert.equal(result.success, false);
});

test("update input rejects trusted ownership, route, and lifecycle fields", () => {
  for (const field of ["userId", "draftId", "status", "lastAutosavedAt"] as const) {
    const result = UpdateOrderDraftInputSchema.safeParse({
      ...validUpdateInput(),
      [field]: field === "draftId" ? UUID_A : "active",
    });
    assert.equal(result.success, false, `${field} should be rejected`);
  }
});

test("editable input schemas accept only editable draft fields", () => {
  assert.equal(CreateOrderDraftInputSchema.safeParse(validCreateInput()).success, true);
  assert.equal(UpdateOrderDraftInputSchema.safeParse(validUpdateInput()).success, true);
});

test("pricing preview must be explicitly non-authoritative", () => {
  assert.equal(
    PricingPreviewSchema.safeParse({
      nonAuthoritative: true,
      preview: { totalCents: 1200 },
    }).success,
    true,
  );
  assert.equal(
    CreateOrderDraftInputSchema.safeParse({
      ...validCreateInput(),
      pricingPreview: { totalCents: 1200 },
    }).success,
    false,
  );
  assert.equal(
    UpdateOrderDraftInputSchema.safeParse({
      ...validUpdateInput(),
      pricingPreview: { nonAuthoritative: false, preview: {} },
    }).success,
    false,
  );
});

test("create insert payload uses trusted ownership and server fields", () => {
  const payload = buildCreateOrderDraftInsertPayload(
    UUID_A,
    {
      ...validCreateInput(),
      state: {
        ...validEnvelope(),
        metadata: { userId: UUID_B },
      },
    },
    new Date("2026-06-26T10:00:00.000Z"),
  );

  assert.equal(payload.ok, true);
  if (!payload.ok) return;
  assert.equal(payload.data.user_id, UUID_A);
  assert.equal(payload.data.status, "active");
  assert.equal(payload.data.version, 1);
  assert.equal(payload.data.last_autosaved_at, "2026-06-26T10:00:00.000Z");
  assert.equal(payload.data.expires_at, "2026-07-26T10:00:00.000Z");
});

test("create insert payload rejects contradictory currentStep values", () => {
  const payload = buildCreateOrderDraftInsertPayload(UUID_A, {
    ...validCreateInput(),
    currentStep: "review",
  });
  assert.equal(payload.ok, false);
  if (payload.ok) return;
  assert.equal(payload.code, "invalid_input");
});

test("create insert payload title falls back to state jobTitle", () => {
  const payload = buildCreateOrderDraftInsertPayload(UUID_A, {
    ...validCreateInput(),
    title: "",
    state: {
      ...validEnvelope(),
      jobTitle: "  Draft fallback title  ",
    },
  });
  assert.equal(payload.ok, true);
  if (!payload.ok) return;
  assert.equal(payload.data.title, "Draft fallback title");
});

test("create insert payload stores null title for empty draft title", () => {
  const payload = buildCreateOrderDraftInsertPayload(UUID_A, {
    ...validCreateInput(),
    title: "",
    state: {
      ...validEnvelope(),
      jobTitle: "",
    },
  });
  assert.equal(payload.ok, true);
  if (!payload.ok) return;
  assert.equal(payload.data.title, null);
});

test("create insert payload keeps pricing preview marked non-authoritative", () => {
  const payload = buildCreateOrderDraftInsertPayload(UUID_A, validCreateInput());
  assert.equal(payload.ok, true);
  if (!payload.ok) return;
  assert.deepEqual(payload.data.pricing_preview, {
    nonAuthoritative: true,
    preview: { totalCents: 1200, currency: "USD" },
  });
});

test("snake_case draft row maps to camelCase domain row", () => {
  const mapped = mapOrderDraftDatabaseRow(draftDatabaseRow());
  assert.equal(mapped.userId, UUID_A);
  assert.equal(mapped.currentStep, "configure");
  assert.equal(mapped.stateSchemaVersion, 1);
  assert.equal(mapped.pricingPreview?.nonAuthoritative, true);
  assert.equal(mapped.lastAutosavedAt, "2026-06-26T10:00:00.000Z");
});

test("snake_case file row maps to camelCase file row", () => {
  const mapped = mapOrderDraftFileDatabaseRow(draftFileDatabaseRow());
  assert.equal(mapped.draftId, UUID_B);
  assert.equal(mapped.itemClientId, UUID_A);
  assert.equal(mapped.storagePath, "drafts/user/draft/file/photo.jpg");
  assert.equal(mapped.uploadStatus, "uploaded");
});

test("summary mapping excludes state payload", () => {
  const mapped = mapOrderDraftSummary(draftDatabaseRow());
  assert.equal(mapped.id, UUID_B);
  assert.equal("state" in mapped, false);
  assert.equal("pricingPreview" in mapped, false);
});

test("list limit normalization uses defaults and bounds", () => {
  assert.equal(normalizeDraftListLimit(), 20);
  assert.equal(normalizeDraftListLimit(0), 1);
  assert.equal(normalizeDraftListLimit(-10), 1);
  assert.equal(normalizeDraftListLimit(10.8), 10);
  assert.equal(normalizeDraftListLimit(200), 100);
});

test("public not-found result hides ownership mismatch detail", () => {
  const result = notFound();
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "not_found");
  assert.equal(result.message.includes("ownership"), false);
});

test("UUID validation accepts IDs and rejects non-UUID values", () => {
  assert.equal(UuidSchema.parse(UUID_A), UUID_A);
  assert.throws(() => UuidSchema.parse("not-a-uuid"));
  assert.equal(DraftFileReferenceSchema.parse({
    draftFileId: UUID_B,
    kind: "reference",
  }).draftFileId, UUID_B);
});

test("stable item ID generation returns unique UUID strings", () => {
  const ids = Array.from({ length: 100 }, () => createDraftClientItemId());
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.equal(UuidSchema.safeParse(id).success, true);
  }
});

test("object undefined properties are omitted", () => {
  assert.deepEqual(normalizeJsonValue({ a: 1, b: undefined }), { a: 1 });
});

test("array undefined entries are rejected", () => {
  assert.throws(
    () => normalizeJsonValue([1, undefined]),
    (error) =>
      error instanceof JsonNormalizationError &&
      error.path === "$[1]",
  );
});

test("unsupported runtime values are rejected", () => {
  for (const value of [
    Number.NaN,
    Infinity,
    -Infinity,
    BigInt(1),
    Symbol("x"),
    () => null,
    new Date("2026-06-26T00:00:00.000Z"),
    new Map(),
    new Set(),
    new Uint8Array([1]),
    new (class DraftState {})(),
  ]) {
    assert.throws(() => normalizeJsonValue(value), JsonNormalizationError);
  }
});

test("circular references are rejected", () => {
  const value: Record<string, unknown> = {};
  value.self = value;
  assert.throws(
    () => normalizeJsonValue(value),
    (error) =>
      error instanceof JsonNormalizationError &&
      error.path === "$.self",
  );
});

test("error paths identify nested failures", () => {
  assert.throws(
    () => normalizeJsonValue({ items: [{ file: new Date() }] }),
    (error) =>
      error instanceof JsonNormalizationError &&
      error.path === "$.items[0].file",
  );
});

test("stable serialization sorts object keys recursively", () => {
  const left = { z: 1, a: { d: true, c: false } };
  const right = { a: { c: false, d: true }, z: 1 };
  assert.equal(stableStringifyJson(left), stableStringifyJson(right));
});

test("stable serialization preserves array order", () => {
  assert.notEqual(
    stableStringifyJson({ items: [1, 2] }),
    stableStringifyJson({ items: [2, 1] }),
  );
});

test("filename sanitization handles common and hostile names", () => {
  const cases = [
    ["photo.jpg", "photo.jpg"],
    ["front elevation final.JPG", "front_elevation_final.jpg"],
    ["casa ñandú.png", "casa_nandu.png"],
    ["living.room.v2.jpeg", "living.room.v2.jpeg"],
    ["floorplan", "floorplan"],
    [".hidden", "hidden"],
    ["../../secret.jpg", "secret.jpg"],
    ["C:\\fakepath\\photo.JPG", "photo.jpg"],
    ["a/b\\c.png", "c.png"],
    ["bad\u0000name.jpg", "badname.jpg"],
    ["***.jpg", "file.jpg"],
  ] as const;

  for (const [input, expected] of cases) {
    assert.equal(sanitizeOrderDraftFilename(input), expected);
  }
});

test("filename sanitization caps long names and strips separators", () => {
  const sanitized = sanitizeOrderDraftFilename(`${"a".repeat(200)}.JPG`);
  assert.equal(sanitized.length, 100);
  assert.match(sanitized, /\.jpg$/);
  assert.equal(sanitized.includes("/"), false);
  assert.equal(sanitized.includes("\\"), false);
});

test("draft storage path output is deterministic and scoped", () => {
  const input = {
    userId: UUID_A,
    draftId: UUID_B,
    fileId: UUID_C,
    originalFilename: "C:\\fakepath\\Front Photo.JPG",
  };
  const expected =
    "drafts/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/Front_Photo.jpg";
  assert.equal(ORDER_FILES_BUCKET, "order-files");
  assert.equal(buildOrderDraftFilePath(input), expected);
  assert.equal(buildOrderDraftFilePath(input), expected);
});

test("draft storage path validates UUID segments", () => {
  assert.throws(() =>
    buildOrderDraftFilePath({
      userId: "not-a-uuid",
      draftId: UUID_B,
      fileId: UUID_C,
      originalFilename: "photo.jpg",
    }),
  );
});

test("30-day expiry calculation is UTC-millisecond deterministic", () => {
  const from = new Date("2026-06-26T00:00:00.000Z");
  assert.equal(
    calculateActiveDraftExpiry(from).toISOString(),
    "2026-07-26T00:00:00.000Z",
  );
});

test("7-day warning calculation uses supplied now", () => {
  const expiresAt = new Date("2026-07-26T00:00:00.000Z");
  assert.equal(
    isInsideDraftExpiryWarningWindow(
      expiresAt,
      new Date("2026-07-18T23:59:59.999Z"),
    ),
    false,
  );
  assert.equal(
    isInsideDraftExpiryWarningWindow(
      expiresAt,
      new Date("2026-07-19T00:00:00.000Z"),
    ),
    true,
  );
});

test("optimistic concurrency result mapping is safe", () => {
  const draft = { id: UUID_A };
  assert.deepEqual(mapDraftUpdateOutcome({ kind: "updated", draft, version: 2 }), {
    ok: true,
    draft,
    version: 2,
  });
  assert.deepEqual(mapDraftUpdateOutcome({ kind: "not_found_or_ownership_mismatch" }), {
    ok: false,
    code: "not_found",
    message: "Draft was not found.",
    internalDiagnostic: "not_found",
  });
  assert.equal(
    mapDraftUpdateOutcome({ kind: "version_conflict" }).code,
    "version_conflict",
  );
  assert.equal(
    mapDraftUpdateOutcome({ kind: "invalid_status", status: "converted" }).code,
    "invalid_status",
  );
  assert.equal(
    mapDraftUpdateOutcome({ kind: "database_error", message: "boom" }).code,
    "database_error",
  );
});
