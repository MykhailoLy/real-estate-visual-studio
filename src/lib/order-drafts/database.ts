import { z } from "zod";
import { calculateActiveDraftExpiry } from "./constants.ts";
import {
  CreateOrderDraftInputSchema,
  OrderDraftFileKindSchema,
  OrderDraftFileStatusSchema,
  OrderDraftStatusSchema,
  PricingPreviewSchema,
  RegionCodeSchema,
  ServiceTypeSchema,
  TransactionalCurrencySchema,
  UuidSchema,
} from "./schema.ts";
import { normalizeJsonValue } from "./serialization.ts";
import type {
  CreateOrderDraftInput,
  JsonObject,
  OrderDraftFileRow,
  OrderDraftRepositoryResult,
  OrderDraftRow,
  OrderDraftSummary,
  PricingPreview,
} from "./types.ts";

export const ORDER_DRAFT_COLUMNS = [
  "id",
  "user_id",
  "service_type",
  "sub_service",
  "route",
  "title",
  "current_step",
  "state",
  "state_schema_version",
  "pricing_preview",
  "pricing_version_seen",
  "currency",
  "region",
  "status",
  "version",
  "finalization_key",
  "converted_order_id",
  "created_at",
  "updated_at",
  "last_autosaved_at",
  "expires_at",
  "converted_at",
  "deleted_at",
] as const;

export const ORDER_DRAFT_SUMMARY_COLUMNS = [
  "id",
  "service_type",
  "sub_service",
  "route",
  "title",
  "current_step",
  "status",
  "version",
  "updated_at",
  "expires_at",
  "converted_order_id",
] as const;

export const ORDER_DRAFT_FILE_COLUMNS = [
  "id",
  "draft_id",
  "item_client_id",
  "item_index",
  "kind",
  "bucket",
  "storage_path",
  "original_filename",
  "file_size",
  "mime_type",
  "content_hash",
  "upload_status",
  "created_at",
  "updated_at",
  "deleted_at",
  "moved_at",
] as const;

export const ORDER_DRAFT_SELECT = ORDER_DRAFT_COLUMNS.join(", ");
export const ORDER_DRAFT_SUMMARY_SELECT = ORDER_DRAFT_SUMMARY_COLUMNS.join(", ");
export const ORDER_DRAFT_FILE_SELECT = ORDER_DRAFT_FILE_COLUMNS.join(", ");

const ISO_DATE_SCHEMA = z.string().datetime();

export interface OrderDraftDatabaseRow {
  id: string;
  user_id: string;
  service_type: string;
  sub_service: string | null;
  route: string;
  title: string | null;
  current_step: string;
  state: unknown;
  state_schema_version: number;
  pricing_preview: unknown | null;
  pricing_version_seen: string | null;
  currency: string;
  region: string | null;
  status: string;
  version: number;
  finalization_key: string | null;
  converted_order_id: string | null;
  created_at: string;
  updated_at: string;
  last_autosaved_at: string | null;
  expires_at: string;
  converted_at: string | null;
  deleted_at: string | null;
}

export type OrderDraftSummaryDatabaseRow = Pick<
  OrderDraftDatabaseRow,
  | "id"
  | "service_type"
  | "sub_service"
  | "route"
  | "title"
  | "current_step"
  | "status"
  | "version"
  | "updated_at"
  | "expires_at"
  | "converted_order_id"
>;

export interface OrderDraftFileDatabaseRow {
  id: string;
  draft_id: string;
  item_client_id: string;
  item_index: number | null;
  kind: string;
  bucket: string;
  storage_path: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  content_hash: string | null;
  upload_status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  moved_at: string | null;
}

export interface OrderDraftInsertPayload {
  user_id: string;
  service_type: string;
  sub_service: string | null;
  route: string;
  title: string | null;
  current_step: string;
  state: JsonObject;
  state_schema_version: number;
  pricing_preview: PricingPreview | null;
  pricing_version_seen: string | null;
  currency: string;
  region: string | null;
  status: "active";
  version: 1;
  finalization_key: null;
  converted_order_id: null;
  created_at: string;
  updated_at: string;
  last_autosaved_at: string;
  expires_at: string;
  converted_at: null;
  deleted_at: null;
}

const DraftDatabaseRowSchema = z.object({
  id: UuidSchema,
  user_id: UuidSchema,
  service_type: ServiceTypeSchema,
  sub_service: z.string().nullable(),
  route: z.string(),
  title: z.string().nullable(),
  current_step: z.string(),
  state: z.unknown(),
  state_schema_version: z.number().int().min(1),
  pricing_preview: z.unknown().nullable(),
  pricing_version_seen: z.string().nullable(),
  currency: TransactionalCurrencySchema,
  region: RegionCodeSchema.nullable(),
  status: OrderDraftStatusSchema,
  version: z.number().int().min(1),
  finalization_key: UuidSchema.nullable(),
  converted_order_id: UuidSchema.nullable(),
  created_at: ISO_DATE_SCHEMA,
  updated_at: ISO_DATE_SCHEMA,
  last_autosaved_at: ISO_DATE_SCHEMA.nullable(),
  expires_at: ISO_DATE_SCHEMA,
  converted_at: ISO_DATE_SCHEMA.nullable(),
  deleted_at: ISO_DATE_SCHEMA.nullable(),
});

const DraftSummaryDatabaseRowSchema = DraftDatabaseRowSchema.pick({
  id: true,
  service_type: true,
  sub_service: true,
  route: true,
  title: true,
  current_step: true,
  status: true,
  version: true,
  updated_at: true,
  expires_at: true,
  converted_order_id: true,
});

const DraftFileDatabaseRowSchema = z.object({
  id: UuidSchema,
  draft_id: UuidSchema,
  item_client_id: UuidSchema,
  item_index: z.number().int().nullable(),
  kind: OrderDraftFileKindSchema,
  bucket: z.string(),
  storage_path: z.string(),
  original_filename: z.string(),
  file_size: z.number().int().positive(),
  mime_type: z.string(),
  content_hash: z.string().nullable(),
  upload_status: OrderDraftFileStatusSchema,
  created_at: ISO_DATE_SCHEMA,
  updated_at: ISO_DATE_SCHEMA,
  deleted_at: ISO_DATE_SCHEMA.nullable(),
  moved_at: ISO_DATE_SCHEMA.nullable(),
});

function success<T>(data: T): OrderDraftRepositoryResult<T> {
  return { ok: true, data };
}

export function invalidInput<T = never>(
  message = "Invalid order draft input.",
): OrderDraftRepositoryResult<T> {
  return { ok: false, code: "invalid_input", message };
}

export function notFound<T = never>(): OrderDraftRepositoryResult<T> {
  return { ok: false, code: "not_found", message: "Draft was not found." };
}

export function databaseError<T = never>(
  message = "Order draft database operation failed.",
): OrderDraftRepositoryResult<T> {
  return { ok: false, code: "database_error", message };
}

function normalizeJsonObject(value: unknown, path: string): JsonObject {
  const normalized = normalizeJsonValue(value);
  if (normalized === null || typeof normalized !== "object" || Array.isArray(normalized)) {
    throw new Error(`${path} must be a JSON object.`);
  }
  return normalized;
}

function normalizePricingPreview(value: unknown | null): PricingPreview | null {
  if (value === null || value === undefined) return null;
  const normalized = normalizeJsonObject(value, "pricing_preview");
  return PricingPreviewSchema.parse(normalized);
}

export function mapOrderDraftDatabaseRow(row: unknown): OrderDraftRow {
  const parsed = DraftDatabaseRowSchema.parse(row);
  return {
    id: parsed.id,
    userId: parsed.user_id,
    serviceType: parsed.service_type,
    subService: parsed.sub_service,
    route: parsed.route,
    title: parsed.title,
    currentStep: parsed.current_step,
    state: normalizeJsonObject(parsed.state, "state"),
    stateSchemaVersion: parsed.state_schema_version,
    pricingPreview: normalizePricingPreview(parsed.pricing_preview),
    pricingVersionSeen: parsed.pricing_version_seen,
    currency: parsed.currency,
    region: parsed.region,
    status: parsed.status,
    version: parsed.version,
    finalizationKey: parsed.finalization_key,
    convertedOrderId: parsed.converted_order_id,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
    lastAutosavedAt: parsed.last_autosaved_at,
    expiresAt: parsed.expires_at,
    convertedAt: parsed.converted_at,
    deletedAt: parsed.deleted_at,
  };
}

export function mapOrderDraftSummary(row: unknown): OrderDraftSummary {
  const parsed = DraftSummaryDatabaseRowSchema.parse(row);
  return {
    id: parsed.id,
    serviceType: parsed.service_type,
    subService: parsed.sub_service,
    route: parsed.route,
    title: parsed.title,
    currentStep: parsed.current_step,
    status: parsed.status,
    version: parsed.version,
    updatedAt: parsed.updated_at,
    expiresAt: parsed.expires_at,
    convertedOrderId: parsed.converted_order_id,
  };
}

export function mapOrderDraftFileDatabaseRow(row: unknown): OrderDraftFileRow {
  const parsed = DraftFileDatabaseRowSchema.parse(row);
  return {
    id: parsed.id,
    draftId: parsed.draft_id,
    itemClientId: parsed.item_client_id,
    itemIndex: parsed.item_index,
    kind: parsed.kind,
    bucket: parsed.bucket,
    storagePath: parsed.storage_path,
    originalFilename: parsed.original_filename,
    fileSize: parsed.file_size,
    mimeType: parsed.mime_type,
    contentHash: parsed.content_hash,
    uploadStatus: parsed.upload_status,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
    deletedAt: parsed.deleted_at,
    movedAt: parsed.moved_at,
  };
}

export function normalizeDraftListLimit(limit?: number): number {
  if (limit === undefined) return 20;
  if (!Number.isFinite(limit)) return 20;
  const integerLimit = Math.floor(limit);
  if (integerLimit < 1) return 1;
  if (integerLimit > 100) return 100;
  return integerLimit;
}

export function buildCreateOrderDraftInsertPayload(
  userId: string,
  input: unknown,
  now = new Date(),
): OrderDraftRepositoryResult<OrderDraftInsertPayload> {
  const userIdResult = UuidSchema.safeParse(userId);
  if (!userIdResult.success) return invalidInput("Invalid authenticated user.");

  const inputResult = CreateOrderDraftInputSchema.safeParse(input);
  if (!inputResult.success) return invalidInput("Invalid order draft input.");

  const parsed = inputResult.data satisfies CreateOrderDraftInput;
  if (parsed.currentStep && parsed.currentStep !== parsed.state.currentStep) {
    return invalidInput("currentStep must match state.currentStep when both are provided.");
  }

  try {
    const normalizedState = normalizeJsonObject(parsed.state, "state");
    const normalizedPricingPreview = normalizePricingPreview(
      parsed.pricingPreview ?? null,
    );
    const nowIso = now.toISOString();
    const title = parsed.title?.trim() || parsed.state.jobTitle.trim() || null;

    return success({
      user_id: userIdResult.data,
      service_type: parsed.serviceType,
      sub_service: parsed.subService ?? null,
      route: parsed.route,
      title,
      current_step: parsed.currentStep ?? parsed.state.currentStep,
      state: normalizedState,
      state_schema_version: parsed.state.schemaVersion,
      pricing_preview: normalizedPricingPreview,
      pricing_version_seen: parsed.pricingVersionSeen ?? null,
      currency: parsed.currency,
      region: parsed.region ?? null,
      status: "active",
      version: 1,
      finalization_key: null,
      converted_order_id: null,
      created_at: nowIso,
      updated_at: nowIso,
      last_autosaved_at: nowIso,
      expires_at: calculateActiveDraftExpiry(now).toISOString(),
      converted_at: null,
      deleted_at: null,
    });
  } catch {
    return invalidInput("Order draft JSON fields are not valid.");
  }
}
