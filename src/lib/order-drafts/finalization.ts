import { z } from "zod";
import {
  FloorPlanItemSchema,
  PhotoEditItemSchema,
  PricingExpectationSchema,
  RenovationItemSchema,
  StagingItemSchema,
  type FloorPlanItem,
  type PhotoEditItem,
  type PricingExpectationData,
  type RenovationItem,
  type StagingItem,
} from "../server-validation.ts";
import type { PricingSnapshot } from "../pricing/types.ts";
import {
  ORDER_FILES_BUCKET,
  buildFinalPath,
  getFileExtension,
  type UploadKind,
} from "../upload-config.ts";
import {
  PHOTO_EDITING_DRAFT_ROUTE,
  PHOTO_EDITING_DRAFT_STATE_SCHEMA_VERSION,
  PhotoEditingDraftStateSchema,
  type PhotoEditingDraftState,
} from "./photo-editing.ts";
import {
  FLOOR_PLANS_DRAFT_ROUTE,
  FLOOR_PLANS_DRAFT_STATE_SCHEMA_VERSION,
  FloorPlansDraftStateSchema,
  type FloorPlansDraftState,
} from "./floor-plans.ts";
import {
  VIRTUAL_STAGING_DRAFT_ROUTE,
  VIRTUAL_STAGING_DRAFT_STATE_SCHEMA_VERSION,
  VirtualStagingDraftStateSchema,
  type VirtualStagingDraftState,
} from "./virtual-staging.ts";
import {
  VIRTUAL_RENOVATION_DRAFT_ROUTE,
  VIRTUAL_RENOVATION_DRAFT_STATE_SCHEMA_VERSION,
  VirtualRenovationDraftStateSchema,
  normalizeLegacyVirtualRenovationDraftState,
  type VirtualRenovationDraftState,
} from "./virtual-renovation.ts";
import { UuidSchema } from "./schema.ts";
import type {
  JsonObject,
  OrderDraftFileRow,
  OrderDraftRow,
} from "./types.ts";

export const DraftFinalizationBodySchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    finalizationKey: UuidSchema,
    pricingExpectation: PricingExpectationSchema.optional(),
  })
  .strict();

export type DraftFinalizationBody = z.infer<
  typeof DraftFinalizationBodySchema
>;

export type DraftFinalizationPublicErrorCode =
  | "invalid_input"
  | "unauthenticated"
  | "profile_incomplete"
  | "not_found"
  | "version_conflict"
  | "invalid_status"
  | "finalization_conflict"
  | "missing_original"
  | "file_mismatch"
  | "pricing_changed"
  | "client_upgrade_required"
  | "storage_error"
  | "database_error"
  | "finalization_incomplete"
  | "unexpected_error";

export type DraftFinalizationClaimResultCode =
  | "claimed"
  | "already_claimed"
  | "already_converted"
  | "not_found"
  | "version_conflict"
  | "invalid_status"
  | "finalization_conflict";

export type DraftFinalizationReleaseResultCode =
  | "released"
  | "not_found"
  | "invalid_status"
  | "finalization_conflict"
  | "order_exists"
  | "already_converted";

export type DraftFinalizationCompleteResultCode =
  | "completed"
  | "not_found"
  | "invalid_status"
  | "finalization_conflict"
  | "invalid_moved_files"
  | "duplicate_moved_files";

export interface ParsedFinalizationRpcResult<TCode extends string> {
  code: TCode;
  draftId: string | null;
  convertedOrderId: string | null;
}

export type StrictFinalizationRpcResult<TCode extends string> =
  | {
      ok: true;
      result: ParsedFinalizationRpcResult<TCode>;
    }
  | {
      ok: false;
      reason: "malformed_response";
    };

export type DraftFinalizationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: DraftFinalizationPublicErrorCode;
      message: string;
      currentPricingSnapshot?: PricingSnapshot;
      // Set only after a definitive pre-commit failure and confirmed draft release.
      draftReleased?: true;
    };

export interface BrowserFileMetadata {
  name: string;
  size: number;
  type?: string;
}

export interface UploadedDraftFileMetadata {
  id: string;
  itemClientId: string;
  kind: "original" | "reference";
  originalFilename: string;
  fileSize: number;
  mimeType: string;
}

export interface NormalizedDraftReferenceIdentity {
  itemClientId: string;
  referenceId: string;
  position: number;
  storagePath: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
}

const VERIFIED_STORAGE_NAMESPACE_FILE_ID = Symbol(
  "verifiedStorageNamespaceFileId",
);

type FinalizationDraftFileRow = OrderDraftFileRow & {
  [VERIFIED_STORAGE_NAMESPACE_FILE_ID]?: string;
};

export interface VirtualStagingDraftSubmissionDecisionItem {
  localOriginal: BrowserFileMetadata | null;
  localReference?: BrowserFileMetadata | null;
  uploadedOriginal?: UploadedDraftFileMetadata | null;
  uploadedReference?: UploadedDraftFileMetadata | null;
}

export type VirtualStagingDraftSubmissionDecision =
  | { mode: "draft_finalization" }
  | { mode: "local_upload_fallback"; reason: string }
  | { mode: "local_upload_fallback_unavailable"; reason: string }
  | { mode: "not_ready"; reason: string };

export const STALE_DRAFT_FINALIZATION_CLAIM_MINUTES = 15;

const STALE_DRAFT_FINALIZATION_CLAIM_MS =
  STALE_DRAFT_FINALIZATION_CLAIM_MINUTES * 60 * 1000;

export interface VirtualStagingFinalizationSlot {
  clientItemId: string;
  itemIndex: number;
  original: OrderDraftFileRow;
  reference: OrderDraftFileRow | null;
}

export type DraftFinalizationSlot = VirtualStagingFinalizationSlot;
export type PhotoEditingFinalizationSlot = DraftFinalizationSlot & {
  reference: null;
};
export type VirtualRenovationFinalizationSlot = DraftFinalizationSlot;
export type FloorPlansFinalizationSlot = DraftFinalizationSlot;

export interface VirtualStagingFinalizationFileDescriptor {
  draftFileId: string;
  bucket: typeof ORDER_FILES_BUCKET;
  path: string;
  originalFilename: string;
  size: number;
  mimeType: string;
}

export interface VirtualStagingFinalizationItemFiles {
  clientItemId: string;
  original: VirtualStagingFinalizationFileDescriptor;
  reference: VirtualStagingFinalizationFileDescriptor | null;
}

export type DraftFinalizationFileDescriptor =
  VirtualStagingFinalizationFileDescriptor;
export type DraftFinalizationItemFiles = VirtualStagingFinalizationItemFiles;

export interface TrustedMovedDraftFile {
  fileId: string;
  finalPath: string;
}

export interface VirtualStagingFinalizationRetryContext {
  draftId: string;
  expectedVersion: number;
  finalizationKey: string;
}

export type DraftPricingExpectation = PricingExpectationData;

export type DraftFinalizationRetryContext =
  VirtualStagingFinalizationRetryContext;

export type DraftFinalizationStatusCode =
  | "active"
  | "finalization_in_progress"
  | "reconciliation_required"
  | "already_converted"
  | "not_found";

export type DraftFinalizationStatusDto =
  | {
      status: "active" | "finalization_in_progress" | "not_found";
      draftId: string;
      expectedVersion?: number;
    }
  | {
      status: "reconciliation_required" | "already_converted";
      draftId: string;
      expectedVersion: number;
      orderId: string;
      orderNumber: string;
    };

export const VIRTUAL_STAGING_FINALIZATION_RETRY_STORAGE_PREFIX =
  "picchuspot:virtual-staging-finalization:";
export const ORDER_DRAFT_FINALIZATION_RETRY_STORAGE_PREFIX =
  "picchuspot:order-draft-finalization:";

const CLAIM_CODES = [
  "claimed",
  "already_claimed",
  "already_converted",
  "not_found",
  "version_conflict",
  "invalid_status",
  "finalization_conflict",
] as const satisfies readonly DraftFinalizationClaimResultCode[];

const RELEASE_CODES = [
  "released",
  "not_found",
  "invalid_status",
  "finalization_conflict",
  "order_exists",
  "already_converted",
] as const satisfies readonly DraftFinalizationReleaseResultCode[];

const COMPLETE_CODES = [
  "completed",
  "not_found",
  "invalid_status",
  "finalization_conflict",
  "invalid_moved_files",
  "duplicate_moved_files",
] as const satisfies readonly DraftFinalizationCompleteResultCode[];

export function parseClaimFinalizationRpcResult(
  data: unknown,
): ParsedFinalizationRpcResult<DraftFinalizationClaimResultCode> {
  return parseFinalizationRpcResult(data, CLAIM_CODES, "invalid_status");
}

export function buildVirtualStagingFinalizationRetryStorageKey(
  draftId: string,
): string {
  return `${VIRTUAL_STAGING_FINALIZATION_RETRY_STORAGE_PREFIX}${draftId}`;
}

export function buildOrderDraftFinalizationRetryStorageKey(
  draftId: string,
): string {
  return `${ORDER_DRAFT_FINALIZATION_RETRY_STORAGE_PREFIX}${draftId}`;
}

export function serializeVirtualStagingFinalizationRetryContext(
  context: VirtualStagingFinalizationRetryContext,
): string {
  return JSON.stringify({
    draftId: context.draftId,
    expectedVersion: context.expectedVersion,
    finalizationKey: context.finalizationKey,
  });
}

export const serializeDraftFinalizationRetryContext =
  serializeVirtualStagingFinalizationRetryContext;

export function parseVirtualStagingFinalizationRetryContext(
  value: string,
  expectedDraftId?: string,
): VirtualStagingFinalizationRetryContext | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== 3 ||
    !keys.includes("draftId") ||
    !keys.includes("expectedVersion") ||
    !keys.includes("finalizationKey")
  ) {
    return null;
  }
  const expectedVersion = record.expectedVersion;
  if (
    typeof record.draftId !== "string" ||
    typeof record.finalizationKey !== "string" ||
    typeof expectedVersion !== "number" ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1 ||
    !UuidSchema.safeParse(record.draftId).success ||
    !UuidSchema.safeParse(record.finalizationKey).success
  ) {
    return null;
  }
  if (expectedDraftId && record.draftId !== expectedDraftId) {
    return null;
  }

  return {
    draftId: record.draftId,
    expectedVersion,
    finalizationKey: record.finalizationKey,
  };
}

export const parseDraftFinalizationRetryContext =
  parseVirtualStagingFinalizationRetryContext;

export function parseStrictClaimFinalizationRpcResult(
  data: unknown,
): StrictFinalizationRpcResult<DraftFinalizationClaimResultCode> {
  return parseStrictFinalizationRpcResult(data, CLAIM_CODES);
}

export function parseReleaseFinalizationRpcResult(
  data: unknown,
): ParsedFinalizationRpcResult<DraftFinalizationReleaseResultCode> {
  return parseFinalizationRpcResult(data, RELEASE_CODES, "invalid_status");
}

export function parseCompleteFinalizationRpcResult(
  data: unknown,
): ParsedFinalizationRpcResult<DraftFinalizationCompleteResultCode> {
  return parseFinalizationRpcResult(data, COMPLETE_CODES, "invalid_status");
}

export function parseStrictCompleteFinalizationRpcResult(
  data: unknown,
): StrictFinalizationRpcResult<DraftFinalizationCompleteResultCode> {
  return parseStrictFinalizationRpcResult(data, COMPLETE_CODES);
}

export function mapClaimCodeToPublicError(
  code: DraftFinalizationClaimResultCode,
): DraftFinalizationPublicErrorCode | null {
  switch (code) {
    case "claimed":
    case "already_claimed":
    case "already_converted":
      return null;
    case "not_found":
      return "not_found";
    case "version_conflict":
      return "version_conflict";
    case "invalid_status":
      return "invalid_status";
    case "finalization_conflict":
      return "finalization_conflict";
  }
}

export function isOwnershipSafeFinalizationNotFound(
  code: DraftFinalizationPublicErrorCode,
): boolean {
  return code === "not_found";
}

export function validateVirtualStagingDraftForFinalization(
  draft: Pick<
    OrderDraftRow,
    | "serviceType"
    | "route"
    | "state"
    | "stateSchemaVersion"
    | "currency"
    | "status"
  >,
): DraftFinalizationResult<VirtualStagingDraftState> {
  if (draft.serviceType !== "virtual-staging") {
    return finalizationError(
      "invalid_status",
      "Draft is not a Virtual Staging draft.",
    );
  }
  if (draft.route !== VIRTUAL_STAGING_DRAFT_ROUTE) {
    return finalizationError(
      "invalid_status",
      "Draft belongs to a different route.",
    );
  }
  if (draft.stateSchemaVersion !== VIRTUAL_STAGING_DRAFT_STATE_SCHEMA_VERSION) {
    return finalizationError(
      "invalid_status",
      "Draft schema version is not supported.",
    );
  }
  if (draft.status !== "converting" && draft.status !== "converted") {
    return finalizationError("invalid_status", "Draft is not claimed.");
  }

  const parsed = VirtualStagingDraftStateSchema.safeParse(draft.state);
  if (!parsed.success) {
    return finalizationError("invalid_status", "Draft state is invalid.");
  }
  if (!parsed.data.termsUi.accepted) {
    return finalizationError(
      "invalid_status",
      "Terms must be accepted before finalization.",
    );
  }
  if (!parsed.data.termsUi.earlyPerformanceRequested) {
    return finalizationError(
      "invalid_status",
      "The start-of-service request is required before finalization.",
    );
  }

  return { ok: true, data: parsed.data };
}

export function validatePhotoEditingDraftForFinalization(
  draft: Pick<
    OrderDraftRow,
    | "serviceType"
    | "subService"
    | "route"
    | "state"
    | "stateSchemaVersion"
    | "currency"
    | "status"
  >,
): DraftFinalizationResult<PhotoEditingDraftState> {
  if (draft.serviceType !== "photo-editing" || draft.subService !== null) {
    return finalizationError(
      "invalid_status",
      "Draft is not the generic Photo Editing draft.",
    );
  }
  if (draft.route !== PHOTO_EDITING_DRAFT_ROUTE) {
    return finalizationError(
      "invalid_status",
      "Draft belongs to a different route.",
    );
  }
  if (draft.stateSchemaVersion !== PHOTO_EDITING_DRAFT_STATE_SCHEMA_VERSION) {
    return finalizationError(
      "invalid_status",
      "Draft schema version is not supported.",
    );
  }
  if (draft.status !== "converting" && draft.status !== "converted") {
    return finalizationError("invalid_status", "Draft is not claimed.");
  }

  const parsed = PhotoEditingDraftStateSchema.safeParse(draft.state);
  if (!parsed.success) {
    return finalizationError("invalid_status", "Draft state is invalid.");
  }
  if (!parsed.data.termsUi.accepted) {
    return finalizationError(
      "invalid_status",
      "Terms must be accepted before finalization.",
    );
  }
  if (!parsed.data.termsUi.earlyPerformanceRequested) {
    return finalizationError(
      "invalid_status",
      "The start-of-service request is required before finalization.",
    );
  }

  return { ok: true, data: parsed.data };
}

export function validateVirtualRenovationDraftForFinalization(
  draft: Pick<
    OrderDraftRow,
    | "serviceType"
    | "subService"
    | "route"
    | "state"
    | "stateSchemaVersion"
    | "currency"
    | "status"
  >,
): DraftFinalizationResult<VirtualRenovationDraftState> {
  if (draft.serviceType !== "virtual-renovation" || draft.subService !== null) {
    return finalizationError(
      "invalid_status",
      "Draft is not the generic Virtual Renovation draft.",
    );
  }
  if (draft.route !== VIRTUAL_RENOVATION_DRAFT_ROUTE) {
    return finalizationError(
      "invalid_status",
      "Draft belongs to a different route.",
    );
  }
  if (
    draft.stateSchemaVersion !==
    VIRTUAL_RENOVATION_DRAFT_STATE_SCHEMA_VERSION
  ) {
    return finalizationError(
      "invalid_status",
      "Draft schema version is not supported.",
    );
  }
  if (draft.status !== "converting" && draft.status !== "converted") {
    return finalizationError("invalid_status", "Draft is not claimed.");
  }

  const parsed = VirtualRenovationDraftStateSchema.safeParse(
    normalizeLegacyVirtualRenovationDraftState(draft.state),
  );
  if (!parsed.success) {
    return finalizationError("invalid_status", "Draft state is invalid.");
  }
  if (!parsed.data.termsUi.accepted) {
    return finalizationError(
      "invalid_status",
      "Terms must be accepted before finalization.",
    );
  }
  if (!parsed.data.termsUi.earlyPerformanceRequested) {
    return finalizationError(
      "invalid_status",
      "The start-of-service request is required before finalization.",
    );
  }

  return { ok: true, data: parsed.data };
}

export function validateFloorPlansDraftForFinalization(
  draft: Pick<
    OrderDraftRow,
    | "serviceType"
    | "subService"
    | "route"
    | "state"
    | "stateSchemaVersion"
    | "currency"
    | "status"
  >,
): DraftFinalizationResult<FloorPlansDraftState> {
  if (draft.serviceType !== "3d-floor-plans" || draft.subService !== null) {
    return finalizationError(
      "invalid_status",
      "Draft is not the Floor Plans order draft.",
    );
  }
  if (draft.route !== FLOOR_PLANS_DRAFT_ROUTE) {
    return finalizationError(
      "invalid_status",
      "Draft belongs to a different route.",
    );
  }
  if (draft.stateSchemaVersion !== FLOOR_PLANS_DRAFT_STATE_SCHEMA_VERSION) {
    return finalizationError(
      "invalid_status",
      "Draft schema version is not supported.",
    );
  }
  if (draft.status !== "converting" && draft.status !== "converted") {
    return finalizationError("invalid_status", "Draft is not claimed.");
  }

  const parsed = FloorPlansDraftStateSchema.safeParse(draft.state);
  if (!parsed.success) {
    return finalizationError("invalid_status", "Draft state is invalid.");
  }
  if (!parsed.data.termsUi.accepted) {
    return finalizationError(
      "invalid_status",
      "Terms must be accepted before finalization.",
    );
  }
  if (!parsed.data.termsUi.earlyPerformanceRequested) {
    return finalizationError(
      "invalid_status",
      "The start-of-service request is required before finalization.",
    );
  }

  return { ok: true, data: parsed.data };
}

export function mapVirtualStagingDraftStateToProductionItems(
  state: VirtualStagingDraftState,
): DraftFinalizationResult<StagingItem[]> {
  const items: StagingItem[] = [];
  for (const item of state.items) {
    const parsed = StagingItemSchema.safeParse({
      roomName: item.state.roomName,
      furnitureStyle: item.state.furnitureStyle,
      fileSizeLimit: item.state.fileSizeLimit,
      disclaimerText: item.state.disclaimerText,
      referenceLink: item.state.referenceLink,
      additionalInfo: item.state.additionalInfo,
      selectedAddons: item.state.selectedAddons,
    });
    if (!parsed.success) {
      return finalizationError(
        "invalid_status",
        "Draft item is not ready for order submission.",
      );
    }
    items.push(parsed.data);
  }
  return { ok: true, data: items };
}

export function mapPhotoEditingDraftStateToProductionItems(
  state: PhotoEditingDraftState,
): DraftFinalizationResult<PhotoEditItem[]> {
  const items: PhotoEditItem[] = [];
  for (const item of state.items) {
    const parsed = PhotoEditItemSchema.safeParse({
      selectedOptions: item.state.selectedOptions,
      fileSizeLimit: item.state.fileSizeLimit,
      disclaimerText: item.state.disclaimerText,
      additionalInfo: item.state.additionalInfo,
    });
    if (!parsed.success) {
      return finalizationError(
        "invalid_status",
        "Photo Editing draft item is not ready for order submission.",
      );
    }
    items.push(parsed.data);
  }
  return { ok: true, data: items };
}

export function mapVirtualRenovationDraftStateToProductionItems(
  state: VirtualRenovationDraftState,
): DraftFinalizationResult<RenovationItem[]> {
  const items: RenovationItem[] = [];
  for (const item of state.items) {
    const parsed = RenovationItemSchema.safeParse({
      selectedInternal: item.state.selectedInternal,
      selectedExternal: item.state.selectedExternal,
      room: item.state.room,
      presentationStyle: item.state.presentationStyle,
      fileSizeLimit: item.state.fileSizeLimit,
      disclaimerText: item.state.disclaimerText,
      referenceLink: item.state.referenceLink,
      additionalInfo: item.state.additionalInfo,
    });
    if (!parsed.success) {
      return finalizationError(
        "invalid_status",
        "Virtual Renovation draft item is not ready for order submission.",
      );
    }
    items.push(parsed.data);
  }
  return { ok: true, data: items };
}

export function mapFloorPlansDraftStateToProductionItems(
  state: FloorPlansDraftState,
): DraftFinalizationResult<FloorPlanItem[]> {
  const items: FloorPlanItem[] = [];
  for (const item of state.items) {
    const parsed = FloorPlanItemSchema.safeParse({
      planType: item.state.planType,
      numberOfFloors: item.state.numberOfFloors,
      style3d: item.state.style3d,
      planView3d: item.state.planView3d,
      pageOrientation: item.state.pageOrientation,
      planOrientation: item.state.planOrientation,
      flooringByRoom: item.state.flooringByRoom,
      showAddress: item.state.showAddress,
      streetAddress: item.state.streetAddress,
      showTitle: item.state.showTitle,
      projectTitle: item.state.projectTitle,
      disclaimerOption: item.state.disclaimerOption,
      customDisclaimer: item.state.customDisclaimer,
      referenceLink: item.state.referenceLink,
      additionalInfo: item.state.additionalInfo,
      fileSizeLimit: item.state.fileSizeLimit,
      disclaimerText: item.state.disclaimerText,
    });
    if (!parsed.success) {
      return finalizationError(
        "invalid_status",
        "Floor Plans draft item is not ready for order submission.",
      );
    }
    items.push(parsed.data);
  }
  return { ok: true, data: items };
}

export function reconcileLegacyDraftReferenceFileIdentities(input: {
  verifiedUserId: string;
  draftId: string;
  files: OrderDraftFileRow[];
  normalizedReferences: NormalizedDraftReferenceIdentity[];
}): DraftFinalizationResult<OrderDraftFileRow[]> {
  const normalizedByItem = new Map<
    string,
    NormalizedDraftReferenceIdentity[]
  >();

  for (const reference of input.normalizedReferences) {
    if (
      !UuidSchema.safeParse(reference.itemClientId).success ||
      !UuidSchema.safeParse(reference.referenceId).success ||
      !Number.isInteger(reference.position) ||
      reference.position < 0 ||
      !isExactDraftStoragePathForFile({
        path: reference.storagePath,
        verifiedUserId: input.verifiedUserId,
        draftId: input.draftId,
        fileId: reference.referenceId,
      })
    ) {
      return finalizationError(
        "file_mismatch",
        "Saved reference file identity could not be verified.",
      );
    }

    const current = normalizedByItem.get(reference.itemClientId) ?? [];
    if (
      current.some(
        (candidate) =>
          candidate.position === reference.position ||
          candidate.referenceId === reference.referenceId ||
          candidate.storagePath === reference.storagePath,
      )
    ) {
      return finalizationError(
        "file_mismatch",
        "Saved reference file identity is duplicated.",
      );
    }
    current.push(reference);
    normalizedByItem.set(reference.itemClientId, current);
  }

  const reconciled: OrderDraftFileRow[] = [];
  for (const file of input.files) {
    if (file.kind !== "reference") {
      reconciled.push(file);
      continue;
    }

    const normalized = normalizedByItem.get(file.itemClientId) ?? [];
    if (normalized.length === 0) {
      // Legacy-only references keep the original exact-ID namespace contract.
      reconciled.push(file);
      continue;
    }

    const positionZero = normalized.find((reference) => reference.position === 0);
    if (!positionZero) {
      return finalizationError(
        "file_mismatch",
        "Saved reference files are missing the primary reference.",
      );
    }

    if (
      file.storagePath !== positionZero.storagePath ||
      file.originalFilename !== positionZero.originalFilename ||
      file.fileSize !== positionZero.fileSize ||
      file.mimeType.toLowerCase() !== positionZero.mimeType.toLowerCase()
    ) {
      return finalizationError(
        "file_mismatch",
        "Legacy reference mirror does not match the saved primary reference.",
      );
    }

    const reconciledReference: FinalizationDraftFileRow = {
      ...file,
      // Preserve the real order_draft_files row id for the later atomic
      // moved-file update. The normalized reference id is a separate,
      // server-verified storage namespace identity used only for validation.
      [VERIFIED_STORAGE_NAMESPACE_FILE_ID]: positionZero.referenceId,
    };
    reconciled.push(reconciledReference);
  }

  return { ok: true, data: reconciled };
}

export function validateAndMatchVirtualStagingDraftFiles(input: {
  verifiedUserId: string;
  draftId: string;
  state: VirtualStagingDraftState;
  files: OrderDraftFileRow[];
}): DraftFinalizationResult<VirtualStagingFinalizationSlot[]> {
  const itemIndexByClientId = new Map<string, number>();
  input.state.items.forEach((item, index) => {
    itemIndexByClientId.set(item.clientItemId, index);
  });

  const slots = new Map<
    string,
    { original: OrderDraftFileRow | null; reference: OrderDraftFileRow | null }
  >();

  for (const file of input.files) {
    if (file.uploadStatus !== "uploaded" || file.deletedAt !== null) {
      return finalizationError(
        "file_mismatch",
        "Draft contains a non-live uploaded file.",
      );
    }
    if (file.bucket !== ORDER_FILES_BUCKET) {
      return finalizationError("file_mismatch", "Draft file bucket is invalid.");
    }
    if (!itemIndexByClientId.has(file.itemClientId)) {
      return finalizationError(
        "file_mismatch",
        "Draft contains a file for an unknown item.",
      );
    }
    if (
      !isExactDraftStoragePathForFile({
        path: file.storagePath,
        verifiedUserId: input.verifiedUserId,
        draftId: input.draftId,
        fileId: getVerifiedDraftStorageNamespaceFileId(file),
      })
    ) {
      return finalizationError(
        "file_mismatch",
        "Draft file path is not in the verified draft namespace.",
      );
    }

    const current = slots.get(file.itemClientId) ?? {
      original: null,
      reference: null,
    };
    if (file.kind === "original") {
      if (current.original) {
        return finalizationError(
          "file_mismatch",
          "Draft contains duplicate original files.",
        );
      }
      current.original = file;
    } else if (file.kind === "reference") {
      if (current.reference) {
        return finalizationError(
          "file_mismatch",
          "Draft contains duplicate reference files.",
        );
      }
      current.reference = file;
    } else {
      return finalizationError("file_mismatch", "Draft file kind is invalid.");
    }
    slots.set(file.itemClientId, current);
  }

  const matched: VirtualStagingFinalizationSlot[] = [];
  for (const item of input.state.items) {
    const slot = slots.get(item.clientItemId);
    if (!slot?.original) {
      return finalizationError(
        "missing_original",
        "Each Virtual Staging item needs one saved original image.",
      );
    }
    matched.push({
      clientItemId: item.clientItemId,
      itemIndex: itemIndexByClientId.get(item.clientItemId) ?? 0,
      original: slot.original,
      reference: slot.reference,
    });
  }

  return { ok: true, data: matched };
}

export function validateAndMatchPhotoEditingDraftFiles(input: {
  verifiedUserId: string;
  draftId: string;
  state: PhotoEditingDraftState;
  files: OrderDraftFileRow[];
}): DraftFinalizationResult<PhotoEditingFinalizationSlot[]> {
  const itemIndexByClientId = new Map<string, number>();
  input.state.items.forEach((item, index) => {
    itemIndexByClientId.set(item.clientItemId, index);
  });

  const originals = new Map<string, OrderDraftFileRow>();
  for (const file of input.files) {
    if (file.uploadStatus !== "uploaded" || file.deletedAt !== null) {
      return finalizationError(
        "file_mismatch",
        "Draft contains a non-live uploaded file.",
      );
    }
    if (
      file.kind !== "original" ||
      file.bucket !== ORDER_FILES_BUCKET ||
      !itemIndexByClientId.has(file.itemClientId) ||
      !isExactDraftStoragePathForFile({
        path: file.storagePath,
        verifiedUserId: input.verifiedUserId,
        draftId: input.draftId,
        fileId: getVerifiedDraftStorageNamespaceFileId(file),
      })
    ) {
      return finalizationError(
        "file_mismatch",
        "Photo Editing draft contains an invalid file slot.",
      );
    }
    if (originals.has(file.itemClientId)) {
      return finalizationError(
        "file_mismatch",
        "Photo Editing draft contains duplicate original files.",
      );
    }
    originals.set(file.itemClientId, file);
  }

  const matched: PhotoEditingFinalizationSlot[] = [];
  for (const item of input.state.items) {
    const original = originals.get(item.clientItemId);
    if (!original) {
      return finalizationError(
        "missing_original",
        "Each Photo Editing item needs one saved original image.",
      );
    }
    matched.push({
      clientItemId: item.clientItemId,
      itemIndex: itemIndexByClientId.get(item.clientItemId) ?? 0,
      original,
      reference: null,
    });
  }

  return { ok: true, data: matched };
}

export function validateAndMatchVirtualRenovationDraftFiles(input: {
  verifiedUserId: string;
  draftId: string;
  state: VirtualRenovationDraftState;
  files: OrderDraftFileRow[];
}): DraftFinalizationResult<VirtualRenovationFinalizationSlot[]> {
  const itemIndexByClientId = new Map<string, number>();
  input.state.items.forEach((item, index) => {
    itemIndexByClientId.set(item.clientItemId, index);
  });

  const slots = new Map<
    string,
    { original: OrderDraftFileRow | null; reference: OrderDraftFileRow | null }
  >();

  for (const file of input.files) {
    if (file.uploadStatus !== "uploaded" || file.deletedAt !== null) {
      return finalizationError(
        "file_mismatch",
        "Virtual Renovation draft contains a non-live uploaded file.",
      );
    }
    if (
      file.bucket !== ORDER_FILES_BUCKET ||
      !itemIndexByClientId.has(file.itemClientId) ||
      !isExactDraftStoragePathForFile({
        path: file.storagePath,
        verifiedUserId: input.verifiedUserId,
        draftId: input.draftId,
        fileId: getVerifiedDraftStorageNamespaceFileId(file),
      })
    ) {
      return finalizationError(
        "file_mismatch",
        "Virtual Renovation draft contains an invalid file slot.",
      );
    }

    const current = slots.get(file.itemClientId) ?? {
      original: null,
      reference: null,
    };
    if (file.kind === "original") {
      if (current.original) {
        return finalizationError(
          "file_mismatch",
          "Virtual Renovation draft contains duplicate original files.",
        );
      }
      current.original = file;
    } else if (file.kind === "reference") {
      if (current.reference) {
        return finalizationError(
          "file_mismatch",
          "Virtual Renovation draft contains duplicate reference files.",
        );
      }
      current.reference = file;
    } else {
      return finalizationError(
        "file_mismatch",
        "Virtual Renovation draft file kind is invalid.",
      );
    }
    slots.set(file.itemClientId, current);
  }

  const matched: VirtualRenovationFinalizationSlot[] = [];
  for (const item of input.state.items) {
    const slot = slots.get(item.clientItemId);
    if (!slot?.original) {
      return finalizationError(
        "missing_original",
        "Each Virtual Renovation item needs one saved original image.",
      );
    }
    matched.push({
      clientItemId: item.clientItemId,
      itemIndex: itemIndexByClientId.get(item.clientItemId) ?? 0,
      original: slot.original,
      reference: slot.reference,
    });
  }

  return { ok: true, data: matched };
}

export function validateAndMatchFloorPlansDraftFiles(input: {
  verifiedUserId: string;
  draftId: string;
  state: FloorPlansDraftState;
  files: OrderDraftFileRow[];
}): DraftFinalizationResult<FloorPlansFinalizationSlot[]> {
  const itemIndexByClientId = new Map<string, number>();
  input.state.items.forEach((item, index) => {
    itemIndexByClientId.set(item.clientItemId, index);
  });

  const slots = new Map<
    string,
    { original: OrderDraftFileRow | null; reference: OrderDraftFileRow | null }
  >();

  for (const file of input.files) {
    if (file.uploadStatus !== "uploaded" || file.deletedAt !== null) {
      return finalizationError(
        "file_mismatch",
        "Floor Plans draft contains a non-live uploaded file.",
      );
    }
    if (
      file.bucket !== ORDER_FILES_BUCKET ||
      !itemIndexByClientId.has(file.itemClientId) ||
      !isExactDraftStoragePathForFile({
        path: file.storagePath,
        verifiedUserId: input.verifiedUserId,
        draftId: input.draftId,
        fileId: getVerifiedDraftStorageNamespaceFileId(file),
      })
    ) {
      return finalizationError(
        "file_mismatch",
        "Floor Plans draft contains an invalid file slot.",
      );
    }

    const current = slots.get(file.itemClientId) ?? {
      original: null,
      reference: null,
    };
    if (file.kind === "original") {
      if (current.original) {
        return finalizationError(
          "file_mismatch",
          "Floor Plans draft contains duplicate original files.",
        );
      }
      current.original = file;
    } else if (file.kind === "reference") {
      if (current.reference) {
        return finalizationError(
          "file_mismatch",
          "Floor Plans draft contains duplicate reference files.",
        );
      }
      current.reference = file;
    } else {
      return finalizationError(
        "file_mismatch",
        "Floor Plans draft file kind is invalid.",
      );
    }
    slots.set(file.itemClientId, current);
  }

  const matched: FloorPlansFinalizationSlot[] = [];
  for (const item of input.state.items) {
    const slot = slots.get(item.clientItemId);
    if (!slot?.original) {
      return finalizationError(
        "missing_original",
        "Each Floor Plans item needs one saved original file.",
      );
    }
    matched.push({
      clientItemId: item.clientItemId,
      itemIndex: itemIndexByClientId.get(item.clientItemId) ?? 0,
      original: slot.original,
      reference: slot.reference,
    });
  }

  return { ok: true, data: matched };
}

export function buildVirtualStagingFinalizationItemFiles(
  slots: VirtualStagingFinalizationSlot[],
): VirtualStagingFinalizationItemFiles[] {
  return slots.map((slot) => ({
    clientItemId: slot.clientItemId,
    original: mapDraftFileDescriptor(slot.original),
    reference: slot.reference ? mapDraftFileDescriptor(slot.reference) : null,
  }));
}

export function buildPhotoEditingFinalizationItemFiles(
  slots: PhotoEditingFinalizationSlot[],
): DraftFinalizationItemFiles[] {
  return slots.map((slot) => ({
    clientItemId: slot.clientItemId,
    original: mapDraftFileDescriptor(slot.original),
    reference: null,
  }));
}

export function buildVirtualRenovationFinalizationItemFiles(
  slots: VirtualRenovationFinalizationSlot[],
): DraftFinalizationItemFiles[] {
  return slots.map((slot) => ({
    clientItemId: slot.clientItemId,
    original: mapDraftFileDescriptor(slot.original),
    reference: slot.reference ? mapDraftFileDescriptor(slot.reference) : null,
  }));
}

export function buildFloorPlansFinalizationItemFiles(
  slots: FloorPlansFinalizationSlot[],
): DraftFinalizationItemFiles[] {
  return slots.map((slot) => ({
    clientItemId: slot.clientItemId,
    original: mapDraftFileDescriptor(slot.original),
    reference: slot.reference ? mapDraftFileDescriptor(slot.reference) : null,
  }));
}

export function buildTrustedMovedDraftFiles(
  files: Array<{
    draftFileId?: string | null;
    finalPath: string;
  }>,
): TrustedMovedDraftFile[] {
  return files
    .filter(
      (file): file is { draftFileId: string; finalPath: string } =>
        typeof file.draftFileId === "string" && file.draftFileId.length > 0,
    )
    .map((file) => ({
      fileId: file.draftFileId,
      finalPath: file.finalPath,
    }));
}

export function buildTrustedFinalPathForDraftFile(input: {
  orderNumber: string;
  itemIndex: number;
  kind: UploadKind;
  sourcePath: string;
  originalFilename: string;
}): string {
  const ext =
    getFileExtension(input.sourcePath) ||
    getFileExtension(input.originalFilename);
  return buildFinalPath(input.orderNumber, input.itemIndex, input.kind, ext);
}

function getVerifiedDraftStorageNamespaceFileId(
  file: OrderDraftFileRow,
): string {
  return (
    (file as FinalizationDraftFileRow)[VERIFIED_STORAGE_NAMESPACE_FILE_ID] ??
    file.id
  );
}

export function isExactDraftStoragePathForFile(input: {
  path: string;
  verifiedUserId: string;
  draftId: string;
  fileId: string;
}): boolean {
  if (!UuidSchema.safeParse(input.verifiedUserId).success) return false;
  if (!UuidSchema.safeParse(input.draftId).success) return false;
  if (!UuidSchema.safeParse(input.fileId).success) return false;
  const prefix = `drafts/${input.verifiedUserId}/${input.draftId}/${input.fileId}/`;
  const filename = input.path.slice(prefix.length);
  return (
    input.path.startsWith(prefix) &&
    filename.length > 0 &&
    !filename.includes("/") &&
    !filename.includes("\\")
  );
}

export function selectVirtualStagingDraftSubmissionMode(
  items: VirtualStagingDraftSubmissionDecisionItem[],
): VirtualStagingDraftSubmissionDecision {
  if (items.length === 0) {
    return { mode: "not_ready", reason: "missing_items" };
  }

  let requiresLocalFallback = false;
  for (const item of items) {
    if (!item.localOriginal && !item.uploadedOriginal) {
      return { mode: "not_ready", reason: "missing_original" };
    }

    if (item.localOriginal) {
      if (!fileSummaryMatchesBrowserFile(item.uploadedOriginal, item.localOriginal)) {
        requiresLocalFallback = true;
      }
    }

    if (
      item.localReference &&
      !fileSummaryMatchesBrowserFile(item.uploadedReference, item.localReference)
    ) {
      requiresLocalFallback = true;
    }
  }

  if (requiresLocalFallback) {
    const canSubmitAllItemsLocally = items.every(
      (item) => item.localOriginal !== null,
    );
    return canSubmitAllItemsLocally
      ? { mode: "local_upload_fallback", reason: "current_file_not_persisted" }
      : {
          mode: "local_upload_fallback_unavailable",
          reason: "persisted_only_item_blocks_local_fallback",
        };
  }

  return { mode: "draft_finalization" };
}

export function isVirtualStagingSubmitReadyWithDraftFiles(
  items: Array<{
    file: File | null;
    uploadedOriginal?: UploadedDraftFileMetadata | null;
    roomName: string;
    furnitureStyle: string;
  }>,
): boolean {
  return (
    items.length > 0 &&
    items.every(
      (item) =>
        (item.file !== null || item.uploadedOriginal != null) &&
        item.roomName !== "" &&
        item.furnitureStyle !== "",
    )
  );
}

export function shouldApplyVirtualStagingFinalizationResult(input: {
  startedSession: number;
  currentSession: number;
  startedKey: string | null;
  currentKey: string | null;
}): boolean {
  return (
    input.startedSession === input.currentSession &&
    input.startedKey !== null &&
    input.startedKey === input.currentKey
  );
}

export function shouldAutomaticallyRetryVirtualStagingFinalization(): false {
  return false;
}

export function shouldPreserveVirtualStagingFinalizationKeyAfterFailure(input: {
  code: DraftFinalizationPublicErrorCode | "invalid_json" | "network_error";
  status: number;
  draftReleased?: boolean;
}): boolean {
  // Only a confirmed pre-commit Storage failure may unlock editing after a 500.
  // Missing confirmation keeps older responses and ambiguous outcomes retryable.
  if (
    input.code === "storage_error" &&
    input.status === 500 &&
    input.draftReleased === true
  ) {
    return false;
  }
  return (
    input.code === "network_error" ||
    input.code === "invalid_json" ||
    input.code === "finalization_incomplete" ||
    input.code === "finalization_conflict" ||
    input.code === "storage_error" ||
    input.code === "database_error" ||
    input.code === "unexpected_error" ||
    input.status === 0 ||
    input.status >= 500
  );
}

export const shouldPreserveDraftFinalizationKeyAfterFailure =
  shouldPreserveVirtualStagingFinalizationKeyAfterFailure;

export function resetVirtualStagingFinalizationIdentity(): {
  finalizationKey: null;
} {
  return { finalizationKey: null };
}

export function isStaleVirtualStagingFinalizationClaim(input: {
  updatedAt: string;
  now: Date;
}): boolean {
  const updatedAt = Date.parse(input.updatedAt);
  if (!Number.isFinite(updatedAt)) return false;
  return input.now.getTime() - updatedAt >= STALE_DRAFT_FINALIZATION_CLAIM_MS;
}

export function finalizationError<T = never>(
  code: DraftFinalizationPublicErrorCode,
  message: string,
  currentPricingSnapshot?: PricingSnapshot,
): DraftFinalizationResult<T> {
  return { ok: false, code, message, currentPricingSnapshot };
}

function mapDraftFileDescriptor(
  file: OrderDraftFileRow,
): VirtualStagingFinalizationFileDescriptor {
  return {
    draftFileId: file.id,
    bucket: ORDER_FILES_BUCKET,
    path: file.storagePath,
    originalFilename: file.originalFilename,
    size: file.fileSize,
    mimeType: file.mimeType,
  };
}

function fileSummaryMatchesBrowserFile(
  summary: UploadedDraftFileMetadata | null | undefined,
  file: BrowserFileMetadata,
): boolean {
  if (!summary) return false;
  if (summary.originalFilename !== file.name) return false;
  if (summary.fileSize !== file.size) return false;

  const fileMime = (file.type ?? "").trim().toLowerCase();
  const summaryMime = summary.mimeType.toLowerCase();
  if (fileMime && summaryMime && fileMime !== summaryMime) return false;

  return true;
}

function parseFinalizationRpcResult<TCode extends string>(
  data: unknown,
  allowedCodes: readonly TCode[],
  fallbackCode: TCode,
): ParsedFinalizationRpcResult<TCode> {
  const row = getSingleRpcRow(data);
  const rawCode = typeof row?.result_code === "string"
    ? row.result_code
    : null;
  const code = rawCode && allowedCodes.includes(rawCode as TCode)
    ? rawCode as TCode
    : fallbackCode;
  const draftId = getUuidLike(row, "draft_id");
  const convertedOrderId =
    getUuidLike(row, "converted_order_id") ??
    getUuidLike(row, "order_id");
  return { code, draftId, convertedOrderId };
}

function parseStrictFinalizationRpcResult<TCode extends string>(
  data: unknown,
  allowedCodes: readonly TCode[],
): StrictFinalizationRpcResult<TCode> {
  const row = getSingleRpcRow(data);
  const rawCode = typeof row?.result_code === "string"
    ? row.result_code
    : null;
  if (!rawCode || !allowedCodes.includes(rawCode as TCode)) {
    return { ok: false, reason: "malformed_response" };
  }
  const convertedOrderId =
    getUuidLike(row, "converted_order_id") ??
    getUuidLike(row, "order_id");
  return {
    ok: true,
    result: {
      code: rawCode as TCode,
      draftId: getUuidLike(row, "draft_id"),
      convertedOrderId,
    },
  };
}

function getSingleRpcRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row !== null && typeof row === "object" && !Array.isArray(row)
    ? row as Record<string, unknown>
    : null;
}

function getUuidLike(
  row: Record<string, unknown> | null,
  field: string,
): string | null {
  const value = row?.[field];
  return typeof value === "string" &&
    UuidSchema.safeParse(value).success
    ? value
    : null;
}

export function draftFinalizationMovedPayloadContainsOnlyTrustedFields(
  payload: TrustedMovedDraftFile[],
): boolean {
  return payload.every((entry) => {
    const keys = Object.keys(entry as unknown as JsonObject).sort();
    return keys.length === 2 && keys[0] === "fileId" && keys[1] === "finalPath";
  });
}
