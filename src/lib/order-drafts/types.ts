import type { ServiceType, TransactionalOrderCurrency } from "../server-validation.ts";
import type { RegionCode } from "../currency.ts";
import type {
  ORDER_DRAFT_FILE_KINDS,
  ORDER_DRAFT_FILE_STATUSES,
  ORDER_DRAFT_STATUSES,
} from "./constants.ts";

export type OrderDraftStatus = (typeof ORDER_DRAFT_STATUSES)[number];
export type OrderDraftFileStatus = (typeof ORDER_DRAFT_FILE_STATUSES)[number];
export type OrderDraftFileKind = (typeof ORDER_DRAFT_FILE_KINDS)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface DraftFileReference {
  draftFileId: string;
  kind: OrderDraftFileKind;
  originalFilename?: string;
}

export interface BaseDraftItem<TState extends JsonObject = JsonObject> {
  clientItemId: string;
  state: TState;
  files?: {
    original?: DraftFileReference | null;
    reference?: DraftFileReference | null;
  };
}

export interface BaseDraftStateEnvelope<
  TItemState extends JsonObject = JsonObject,
  TMetadata extends JsonObject = JsonObject,
> {
  schemaVersion: number;
  jobTitle: string;
  currentStep: string;
  items: Array<BaseDraftItem<TItemState>>;
  notes?: string;
  termsUi?: JsonObject;
  metadata?: TMetadata;
}

export type SerializedDraftState = BaseDraftStateEnvelope;

export interface PricingPreview {
  nonAuthoritative: true;
  preview: JsonObject;
}

export interface OrderDraftRow {
  id: string;
  userId: string;
  serviceType: ServiceType;
  subService: string | null;
  route: string;
  title: string | null;
  currentStep: string;
  state: JsonObject;
  stateSchemaVersion: number;
  pricingPreview: PricingPreview | null;
  pricingVersionSeen: string | null;
  currency: TransactionalOrderCurrency;
  region: RegionCode | null;
  status: OrderDraftStatus;
  version: number;
  finalizationKey: string | null;
  convertedOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  lastAutosavedAt: string | null;
  expiresAt: string;
  convertedAt: string | null;
  deletedAt: string | null;
}

export interface OrderDraftFileRow {
  id: string;
  draftId: string;
  itemClientId: string;
  itemIndex: number | null;
  kind: OrderDraftFileKind;
  bucket: string;
  storagePath: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  contentHash: string | null;
  uploadStatus: OrderDraftFileStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  movedAt: string | null;
}

export interface OrderDraftSummary {
  id: string;
  serviceType: ServiceType;
  subService: string | null;
  route: string;
  title: string | null;
  currentStep: string;
  status: OrderDraftStatus;
  version: number;
  updatedAt: string;
  expiresAt: string;
  convertedOrderId: string | null;
}

export interface CreateOrderDraftInput<
  TState extends BaseDraftStateEnvelope = BaseDraftStateEnvelope,
> {
  // Ownership comes from the verified server session. Future repository
  // shape: createOrderDraftForUser(userId, input). Timestamps, lifecycle
  // status, expiry, and version fields are set by trusted server/database
  // code, never by browser/request payloads.
  serviceType: ServiceType;
  subService?: string | null;
  route: string;
  title?: string | null;
  currentStep?: string;
  state: TState;
  pricingPreview?: PricingPreview | null;
  pricingVersionSeen?: string | null;
  currency: TransactionalOrderCurrency;
  region?: RegionCode | null;
}

export interface UpdateOrderDraftInput<
  TState extends BaseDraftStateEnvelope = BaseDraftStateEnvelope,
> {
  // Ownership, draft identity, timestamps, lifecycle status, and version
  // increments are trusted server/repository concerns. The repository/database
  // update owns last_autosaved_at and version increments. Future repository
  // shape: updateOrderDraftForUser(userId, draftId, input).
  expectedVersion: number;
  currentStep?: string;
  title?: string | null;
  state?: TState;
  pricingPreview?: PricingPreview | null;
  pricingVersionSeen?: string | null;
  currency?: TransactionalOrderCurrency;
  region?: RegionCode | null;
}

export interface OrderDraftStatusTransition {
  // Trusted internal lifecycle transition input only; generic editable
  // autosave/update payloads must not accept status changes.
  status: OrderDraftStatus;
  expectedVersion: number;
}

export type DraftUpdatePublicErrorCode =
  | "not_found"
  | "version_conflict"
  | "invalid_status"
  | "database_error";

export type DraftUpdateInternalDiagnostic =
  | DraftUpdatePublicErrorCode
  | "ownership_mismatch";

export type DraftUpdateResult<T = OrderDraftRow> =
  | { ok: true; draft: T; version: number }
  | {
      ok: false;
      code: DraftUpdatePublicErrorCode;
      message: string;
      internalDiagnostic?: DraftUpdateInternalDiagnostic;
    };

export type DraftUpdateDataAccessOutcome<T = OrderDraftRow> =
  | { kind: "updated"; draft: T; version: number }
  | { kind: "not_found_or_ownership_mismatch" }
  | { kind: "version_conflict" }
  | { kind: "invalid_status"; status: string }
  | { kind: "database_error"; message: string };

export type OrderDraftRepositoryErrorCode =
  | "not_found"
  | "invalid_input"
  | "database_error";

export type OrderDraftRepositoryResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: OrderDraftRepositoryErrorCode;
      message: string;
    };
