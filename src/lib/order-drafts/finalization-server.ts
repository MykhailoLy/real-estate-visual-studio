import "server-only";

import {
  getSupabaseAdminClient,
  SupabaseAdminConfigurationError,
} from "../supabase-admin.ts";
import type { ResolvedClientIdentity } from "../profile-completion.ts";
import { TERMS_VERSION } from "../order-terms.ts";
import { EARLY_PERFORMANCE_VERSION } from "../early-performance.ts";
import { ORDER_FILES_BUCKET } from "../upload-config.ts";
import {
  createProductionOrder,
  type TrustedOrderItemFiles,
  type ValidatedOrderItem,
} from "../orders/create-order-server.ts";
import {
  ORDER_DRAFT_FILE_SELECT,
  ORDER_DRAFT_SELECT,
  mapOrderDraftDatabaseRow,
  mapOrderDraftFileDatabaseRow,
} from "./database.ts";
import {
  getDraftStoragePathParts,
  verifyStoredDraftObject,
  type StoredDraftObjectInfo,
} from "./files.ts";
import {
  buildTrustedFinalPathForDraftFile,
  buildFloorPlansFinalizationItemFiles,
  buildPhotoEditingFinalizationItemFiles,
  buildVirtualRenovationFinalizationItemFiles,
  buildVirtualStagingFinalizationItemFiles,
  finalizationError,
  mapClaimCodeToPublicError,
  mapFloorPlansDraftStateToProductionItems,
  mapPhotoEditingDraftStateToProductionItems,
  mapVirtualRenovationDraftStateToProductionItems,
  mapVirtualStagingDraftStateToProductionItems,
  parseReleaseFinalizationRpcResult,
  parseStrictClaimFinalizationRpcResult,
  parseStrictCompleteFinalizationRpcResult,
  reconcileLegacyDraftReferenceFileIdentities,
  validateAndMatchFloorPlansDraftFiles,
  validateAndMatchPhotoEditingDraftFiles,
  validateAndMatchVirtualRenovationDraftFiles,
  validateAndMatchVirtualStagingDraftFiles,
  validateFloorPlansDraftForFinalization,
  validatePhotoEditingDraftForFinalization,
  validateVirtualRenovationDraftForFinalization,
  validateVirtualStagingDraftForFinalization,
  type DraftFinalizationClaimResultCode,
  type DraftFinalizationCompleteResultCode,
  type DraftFinalizationSlot,
  type DraftFinalizationResult,
  type DraftPricingExpectation,
  type ParsedFinalizationRpcResult,
  type TrustedMovedDraftFile,
} from "./finalization.ts";
import type { ServiceType } from "../server-validation.ts";
import { PHOTO_EDITING_DRAFT_ROUTE } from "./photo-editing.ts";
import { FLOOR_PLANS_DRAFT_ROUTE } from "./floor-plans.ts";
import { VIRTUAL_RENOVATION_DRAFT_ROUTE } from "./virtual-renovation.ts";
import { VIRTUAL_STAGING_DRAFT_ROUTE } from "./virtual-staging.ts";
import { UuidSchema } from "./schema.ts";
import type {
  OrderDraftFileRow,
  OrderDraftRow,
} from "./types.ts";

export interface SubmitOrderDraftInput {
  userId: string;
  draftId: string;
  expectedVersion: number;
  finalizationKey: string;
  pricingExpectation?: DraftPricingExpectation;
  clientIdentity: ResolvedClientIdentity;
}

export type SubmitVirtualStagingDraftInput = SubmitOrderDraftInput;

export interface SubmitOrderDraftSuccess {
  orderNumber: string;
  orderId: string;
  draftId: string;
  alreadyFinalized: boolean;
  confirmationEmailSent: boolean;
}

export type SubmitVirtualStagingDraftSuccess = SubmitOrderDraftSuccess;

interface TrustedDraftFinalizationContext {
  serviceType: Extract<
    ServiceType,
    | "virtual-staging"
    | "photo-editing"
    | "virtual-renovation"
    | "3d-floor-plans"
  >;
  jobTitle: string;
  itemCount: number;
  termsUi: {
    accepted: boolean;
    earlyPerformanceRequested: boolean;
    allowPortfolio: boolean;
  };
  items: ValidatedOrderItem[];
  matchFiles: (
    files: OrderDraftFileRow[],
  ) => DraftFinalizationResult<DraftFinalizationSlot[]>;
  buildItemFiles: (
    slots: DraftFinalizationSlot[],
  ) => Promise<DraftFinalizationResult<TrustedOrderItemFiles[]>>;
}

interface ProductionOrderLookup {
  id: string;
  orderNumber: string;
  serviceType: string;
  sourceDraftId: string | null;
  itemCount: number;
}

interface ProductionOrderItemPaths {
  itemIndex: number;
  originalPath: string | null;
  referencePath: string | null;
}

interface SupabaseStorageObject {
  name?: unknown;
  metadata?: unknown;
}

type ClaimDraftFinalizationResult =
  | ParsedFinalizationRpcResult<DraftFinalizationClaimResultCode>
  | {
      code: "database_error";
      draftId: null;
      convertedOrderId: null;
    };

type CompleteDraftFinalizationResult =
  | ParsedFinalizationRpcResult<DraftFinalizationCompleteResultCode>
  | {
      code: "database_error";
      draftId: null;
      convertedOrderId: null;
    };

export async function submitVirtualStagingDraftForUser(
  input: SubmitVirtualStagingDraftInput,
): Promise<DraftFinalizationResult<SubmitVirtualStagingDraftSuccess>> {
  return submitTrustedOrderDraftForUser(input, "virtual-staging");
}

export async function submitOrderDraftForUser(
  input: SubmitOrderDraftInput,
): Promise<DraftFinalizationResult<SubmitOrderDraftSuccess>> {
  return submitTrustedOrderDraftForUser(input);
}

async function submitTrustedOrderDraftForUser(
  input: SubmitOrderDraftInput,
  expectedServiceType?: TrustedDraftFinalizationContext["serviceType"],
): Promise<DraftFinalizationResult<SubmitOrderDraftSuccess>> {
  if (
    !UuidSchema.safeParse(input.userId).success ||
    !UuidSchema.safeParse(input.draftId).success ||
    !UuidSchema.safeParse(input.finalizationKey).success
  ) {
    return finalizationError("invalid_input", "Invalid draft finalization input.");
  }

  try {
    const trustedDraft = await loadClaimedDraft(input.userId, input.draftId);
    if (!trustedDraft) {
      return finalizationError("not_found", "Draft was not found.");
    }
    const trustedServiceType = getEnabledDraftFinalizationService(trustedDraft);
    if (!trustedServiceType) {
      return finalizationError(
        "invalid_status",
        "Draft service is not enabled for durable finalization.",
      );
    }
    if (expectedServiceType && trustedServiceType !== expectedServiceType) {
      return finalizationError(
        "invalid_status",
        "Draft belongs to a different order service.",
      );
    }

    const claim = await claimDraftFinalization(input);
    if (claim.code === "database_error") {
      return finalizationError(
        "database_error",
        "Draft finalization claim could not be confirmed. Please try again.",
      );
    }

    const claimError = mapClaimCodeToPublicError(claim.code);
    if (claimError) {
      return finalizationError(
        claimError,
        messageForFinalizationCode(claimError),
      );
    }

    const draft = await loadClaimedDraft(input.userId, input.draftId);
    if (!draft) {
      await releaseClaimBestEffort(input);
      return finalizationError("not_found", "Draft was not found.");
    }

    const contextResult = buildTrustedDraftFinalizationContext(input, draft);
    if (!contextResult.ok) {
      await releaseClaimBestEffort(input);
      return contextResult;
    }
    const context = contextResult.data;
    if (expectedServiceType && context.serviceType !== expectedServiceType) {
      await releaseClaimBestEffort(input);
      return finalizationError(
        "invalid_status",
        "Draft belongs to a different order service.",
      );
    }

    if (claim.code === "already_converted") {
      const existing = claim.convertedOrderId
        ? await loadProductionOrderById(input.userId, claim.convertedOrderId)
        : await loadProductionOrderBySourceDraft(input.userId, input.draftId);
      if (
        !existing ||
        !isProductionOrderForDraft(
          existing,
          input.draftId,
          context.serviceType,
        ) ||
        existing.itemCount !== context.itemCount
      ) {
        return finalizationError(
          "finalization_incomplete",
          "Draft conversion needs to be reconciled.",
        );
      }
      return {
        ok: true,
        data: {
          orderNumber: existing.orderNumber,
          orderId: existing.id,
          draftId: input.draftId,
          alreadyFinalized: true,
          confirmationEmailSent: false,
        },
      };
    }

    const existingOrder = claim.convertedOrderId
      ? await loadProductionOrderById(input.userId, claim.convertedOrderId)
      : await loadProductionOrderBySourceDraft(input.userId, input.draftId);

    const loadedFiles = await loadLiveUploadedDraftFiles(input.draftId);
    const reconciledFiles = await reconcileDraftReferenceFilesForSubmission({
      userId: input.userId,
      draftId: input.draftId,
      trustedServiceType: context.serviceType,
      files: loadedFiles,
    });
    if (!reconciledFiles.ok) {
      await releaseClaimBestEffort(input);
      return reconciledFiles;
    }
    const files = reconciledFiles.data;
    const slots = context.matchFiles(files);
    if (!slots.ok) {
      await releaseClaimBestEffort(input);
      return slots;
    }

    const storageVerification = await verifyDraftStorageObjects(files);
    if (!storageVerification.ok) {
      const draftReleased = await releaseClaimBestEffort(input);
      return storageVerification.code === "storage_error" && draftReleased
        ? { ...storageVerification, draftReleased: true }
        : storageVerification;
    }

    if (existingOrder) {
      return reconcileExistingDraftOrder({
        input,
        draft,
        order: existingOrder,
        context,
        slots: slots.data,
      });
    }

    const itemFiles = await context.buildItemFiles(slots.data);
    if (!itemFiles.ok) {
      const draftReleased = await releaseClaimBestEffort(input);
      return itemFiles.code === "storage_error" && draftReleased
        ? { ...itemFiles, draftReleased: true }
        : itemFiles;
    }
    const orderResult = await createProductionOrder({
      // The draft is editable after release; each attempt keeps its own snapshot.
      submissionId: input.finalizationKey,
      ownerUserId: input.userId,
      clientIdentity: input.clientIdentity,
      serviceType: context.serviceType,
      jobTitle: context.jobTitle,
      currency: draft.currency,
      items: context.items,
      itemFiles: itemFiles.data,
      termsAcceptance: {
        accepted: context.termsUi.accepted,
        version: TERMS_VERSION,
      },
      earlyPerformanceRequest: {
        requested: context.termsUi.earlyPerformanceRequested,
        version: EARLY_PERFORMANCE_VERSION,
      },
      pricingExpectation: input.pricingExpectation,
      portfolioPermission: {
        allowed: context.termsUi.allowPortfolio,
      },
      sourceDraftId: input.draftId,
      draftExpectedVersion: input.expectedVersion,
      draftFinalizationKey: input.finalizationKey,
      storageMode: "copy",
    });

    if (!orderResult.ok) {
      if (orderResult.code === "in_progress") {
        // A same-attempt handler still owns the submission lease. Keep its
        // draft claim and browser key instead of rotating to a new attempt.
        return finalizationError("finalization_conflict", orderResult.message);
      }
      if (orderResult.code === "source_draft_exists") {
        const sourceOrder = await loadProductionOrderBySourceDraft(
          input.userId,
          input.draftId,
        );
        if (sourceOrder) {
          return reconcileExistingDraftOrder({
            input,
            draft,
            order: sourceOrder,
            context,
            slots: slots.data,
          });
        }
      }

      const draftReleased = await releaseClaimBestEffort(input);
      const failure = finalizationError(
        orderResult.code === "storage_error"
          ? "storage_error"
          : orderResult.code === "pricing_changed"
            ? "pricing_changed"
          : orderResult.code === "client_upgrade_required"
            ? "client_upgrade_required"
          : orderResult.code === "database_error"
            ? "database_error"
            : "invalid_status",
        orderResult.message,
        orderResult.currentPricingSnapshot,
      );
      // Storage failures here precede commit. Only a confirmed release may
      // unlock editing; an unknown commit/release must keep the retry identity.
      return !failure.ok && orderResult.code === "storage_error" && draftReleased
        ? { ...failure, draftReleased: true }
        : failure;
    }

    return {
      ok: true,
      data: {
        orderNumber: orderResult.orderNumber,
        orderId: orderResult.orderId,
        draftId: input.draftId,
        alreadyFinalized: orderResult.replayed,
        confirmationEmailSent:
          orderResult.emailNotifications.clientConfirmation === true,
      },
    };
  } catch (error) {
    if (error instanceof SupabaseAdminConfigurationError) throw error;
    console.error(
      "[order-draft-finalization] submit failed:",
      error instanceof Error ? error.message : "UnknownError",
    );
    await releaseClaimBestEffort(input);
    return finalizationError(
      "unexpected_error",
      "Draft finalization failed. Please try again.",
    );
  }
}

function getEnabledDraftFinalizationService(
  draft: OrderDraftRow,
): TrustedDraftFinalizationContext["serviceType"] | null {
  if (
    draft.serviceType === "virtual-staging" &&
    draft.route === VIRTUAL_STAGING_DRAFT_ROUTE
  ) {
    return "virtual-staging";
  }
  if (
    draft.serviceType === "photo-editing" &&
    draft.subService === null &&
    draft.route === PHOTO_EDITING_DRAFT_ROUTE
  ) {
    return "photo-editing";
  }
  if (
    draft.serviceType === "virtual-renovation" &&
    draft.subService === null &&
    draft.route === VIRTUAL_RENOVATION_DRAFT_ROUTE
  ) {
    return "virtual-renovation";
  }
  if (
    draft.serviceType === "3d-floor-plans" &&
    draft.subService === null &&
    draft.route === FLOOR_PLANS_DRAFT_ROUTE
  ) {
    return "3d-floor-plans";
  }
  return null;
}

function buildTrustedDraftFinalizationContext(
  input: SubmitOrderDraftInput,
  draft: OrderDraftRow,
): DraftFinalizationResult<TrustedDraftFinalizationContext> {
  if (draft.serviceType === "virtual-staging") {
    const state = validateVirtualStagingDraftForFinalization(draft);
    if (!state.ok) return state;
    const items = mapVirtualStagingDraftStateToProductionItems(state.data);
    if (!items.ok) return items;
    return {
      ok: true,
      data: {
        serviceType: "virtual-staging",
        jobTitle: state.data.jobTitle,
        itemCount: state.data.items.length,
        termsUi: state.data.termsUi,
        items: items.data,
        matchFiles: (files) =>
          validateAndMatchVirtualStagingDraftFiles({
            verifiedUserId: input.userId,
            draftId: input.draftId,
            state: state.data,
            files,
          }),
        buildItemFiles: (slots) =>
          buildVirtualStagingTrustedItemFiles(input.draftId, slots),
      },
    };
  }

  if (draft.serviceType === "photo-editing") {
    const state = validatePhotoEditingDraftForFinalization(draft);
    if (!state.ok) return state;
    const items = mapPhotoEditingDraftStateToProductionItems(state.data);
    if (!items.ok) return items;
    return {
      ok: true,
      data: {
        serviceType: "photo-editing",
        jobTitle: state.data.jobTitle,
        itemCount: state.data.items.length,
        termsUi: state.data.termsUi,
        items: items.data,
        matchFiles: (files) =>
          validateAndMatchPhotoEditingDraftFiles({
            verifiedUserId: input.userId,
            draftId: input.draftId,
            state: state.data,
            files,
          }),
        buildItemFiles: async (slots) => ({
          ok: true,
          data: buildPhotoEditingFinalizationItemFiles(
            slots.map((slot) => ({ ...slot, reference: null })),
          ),
        }),
      },
    };
  }

  if (draft.serviceType === "virtual-renovation") {
    const state = validateVirtualRenovationDraftForFinalization(draft);
    if (!state.ok) return state;
    const items = mapVirtualRenovationDraftStateToProductionItems(state.data);
    if (!items.ok) return items;
    return {
      ok: true,
      data: {
        serviceType: "virtual-renovation",
        jobTitle: state.data.jobTitle,
        itemCount: state.data.items.length,
        termsUi: state.data.termsUi,
        items: items.data,
        matchFiles: (files) =>
          validateAndMatchVirtualRenovationDraftFiles({
            verifiedUserId: input.userId,
            draftId: input.draftId,
            state: state.data,
            files,
          }),
        buildItemFiles: (slots) =>
          buildVirtualRenovationTrustedItemFiles(input.draftId, slots),
      },
    };
  }

  if (draft.serviceType === "3d-floor-plans") {
    const state = validateFloorPlansDraftForFinalization(draft);
    if (!state.ok) return state;
    const items = mapFloorPlansDraftStateToProductionItems(state.data);
    if (!items.ok) return items;
    return {
      ok: true,
      data: {
        serviceType: "3d-floor-plans",
        jobTitle: state.data.jobTitle,
        itemCount: state.data.items.length,
        termsUi: state.data.termsUi,
        items: items.data,
        matchFiles: (files) =>
          validateAndMatchFloorPlansDraftFiles({
            verifiedUserId: input.userId,
            draftId: input.draftId,
            state: state.data,
            files,
          }),
        buildItemFiles: async (slots) => ({
          ok: true,
          data: buildFloorPlansFinalizationItemFiles(slots),
        }),
      },
    };
  }

  return finalizationError(
    "invalid_status",
    "Draft service is not enabled for durable finalization.",
  );
}

async function buildVirtualStagingTrustedItemFiles(
  draftId: string,
  slots: DraftFinalizationSlot[],
): Promise<DraftFinalizationResult<TrustedOrderItemFiles[]>> {
  return buildTrustedItemFilesWithNormalizedReferences(
    draftId,
    buildVirtualStagingFinalizationItemFiles(slots),
  );
}

async function buildVirtualRenovationTrustedItemFiles(
  draftId: string,
  slots: DraftFinalizationSlot[],
): Promise<DraftFinalizationResult<TrustedOrderItemFiles[]>> {
  return buildTrustedItemFilesWithNormalizedReferences(
    draftId,
    buildVirtualRenovationFinalizationItemFiles(slots),
  );
}

async function buildTrustedItemFilesWithNormalizedReferences(
  draftId: string,
  itemFiles: Array<TrustedOrderItemFiles & { clientItemId: string }>,
): Promise<DraftFinalizationResult<TrustedOrderItemFiles[]>> {
  const normalizedReferences = await loadLiveDraftReferenceFiles(draftId);
  const referenceVerification = await verifyNormalizedDraftReferenceObjects(
    normalizedReferences,
  );
  if (!referenceVerification.ok) return referenceVerification;

  return {
    ok: true,
    data: itemFiles.map((slot) => {
      const itemReferences = normalizedReferences.filter(
        (reference) => reference.itemClientId === slot.clientItemId,
      );
      const mirroredReference = itemReferences.find(
        (reference) => reference.storagePath === slot.reference?.path,
      );
      return {
        ...slot,
        reference:
          slot.reference && mirroredReference
            ? { ...slot.reference, referenceId: mirroredReference.referenceId }
            : slot.reference,
        references: itemReferences
          .filter((reference) => reference.storagePath !== slot.reference?.path)
          .map((reference) => ({
            bucket: ORDER_FILES_BUCKET,
            path: reference.storagePath,
            originalFilename: reference.originalFilename,
            size: reference.fileSize,
            mimeType: reference.mimeType,
            referenceId: reference.referenceId,
            position: reference.position,
          })),
      };
    }),
  };
}

async function claimDraftFinalization(
  input: SubmitVirtualStagingDraftInput,
): Promise<ClaimDraftFinalizationResult> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc(
    "claim_order_draft_finalization",
    {
      p_user_id: input.userId,
      p_draft_id: input.draftId,
      p_expected_version: input.expectedVersion,
      p_finalization_key: input.finalizationKey,
    },
  );
  if (error) {
    console.error("[order-draft-finalization] claim RPC failed:", error.message);
    return {
      code: "database_error" as const,
      draftId: null,
      convertedOrderId: null,
    };
  }
  const parsed = parseStrictClaimFinalizationRpcResult(data);
  if (!parsed.ok) {
    console.error("[order-draft-finalization] claim RPC returned malformed data");
    return {
      code: "database_error" as const,
      draftId: null,
      convertedOrderId: null,
    };
  }
  return parsed.result;
}

async function completeDraftFinalization(input: SubmitVirtualStagingDraftInput & {
  orderId: string;
  movedFiles: TrustedMovedDraftFile[];
}): Promise<CompleteDraftFinalizationResult> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc(
    "complete_order_draft_finalization",
    {
      p_user_id: input.userId,
      p_draft_id: input.draftId,
      p_finalization_key: input.finalizationKey,
      p_order_id: input.orderId,
      p_moved_files: input.movedFiles,
    },
  );
  if (error) {
    console.error("[order-draft-finalization] complete RPC failed:", error.message);
    return {
      code: "database_error" as const,
      draftId: null,
      convertedOrderId: null,
    };
  }
  const parsed = parseStrictCompleteFinalizationRpcResult(data);
  if (!parsed.ok) {
    console.error("[order-draft-finalization] complete RPC returned malformed data");
    return {
      code: "database_error" as const,
      draftId: null,
      convertedOrderId: null,
    };
  }
  return parsed.result;
}

async function releaseClaimBestEffort(
  input: SubmitVirtualStagingDraftInput,
): Promise<boolean> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc(
      "release_order_draft_finalization",
      {
        p_user_id: input.userId,
        p_draft_id: input.draftId,
        p_finalization_key: input.finalizationKey,
      },
    );
    if (error) {
      console.warn(
        "[order-draft-finalization] release RPC returned error:",
        error.message,
      );
      return false;
    }
    const result = parseReleaseFinalizationRpcResult(data);
    if (
      result.code !== "released" &&
      result.code !== "order_exists" &&
      result.code !== "already_converted"
    ) {
      console.warn(
        "[order-draft-finalization] release RPC did not release:",
        result.code,
      );
    }
    return (
      Array.isArray(data) && data.length === 1 &&
      result.code === "released" && result.draftId === input.draftId &&
      result.convertedOrderId === null
    );
  } catch (error) {
    console.warn("[order-draft-finalization] release RPC threw:", error);
    return false;
  }
}

async function loadClaimedDraft(
  userId: string,
  draftId: string,
): Promise<OrderDraftRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_drafts")
    .select(ORDER_DRAFT_SELECT)
    .eq("id", draftId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[order-draft-finalization] draft lookup failed:", error.message);
    return null;
  }
  return data ? mapOrderDraftDatabaseRow(data) : null;
}

async function reconcileDraftReferenceFilesForSubmission(input: {
  userId: string;
  draftId: string;
  trustedServiceType: TrustedDraftFinalizationContext["serviceType"];
  files: OrderDraftFileRow[];
}): Promise<DraftFinalizationResult<OrderDraftFileRow[]>> {
  if (
    input.trustedServiceType !== "virtual-staging" &&
    input.trustedServiceType !== "virtual-renovation"
  ) {
    return { ok: true, data: input.files };
  }

  try {
    const normalizedReferences = await loadLiveDraftReferenceFiles(input.draftId);
    return reconcileLegacyDraftReferenceFileIdentities({
      verifiedUserId: input.userId,
      draftId: input.draftId,
      files: input.files,
      normalizedReferences,
    });
  } catch (error) {
    console.error(
      "[order-draft-finalization] normalized reference reconciliation failed:",
      error,
    );
    return finalizationError(
      "database_error",
      "Saved reference files could not be verified. Please try again.",
    );
  }
}

async function loadLiveUploadedDraftFiles(
  draftId: string,
): Promise<OrderDraftFileRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_draft_files")
    .select(ORDER_DRAFT_FILE_SELECT)
    .eq("draft_id", draftId)
    .eq("upload_status", "uploaded")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(
      "[order-draft-finalization] draft file lookup failed:",
      error.message,
    );
    return [];
  }
  return (data ?? []).map(mapOrderDraftFileDatabaseRow);
}

interface NormalizedDraftReferenceRow {
  itemIndex: number;
  itemClientId: string;
  referenceId: string;
  position: number;
  storagePath: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
}

async function loadLiveDraftReferenceFiles(
  draftId: string,
): Promise<NormalizedDraftReferenceRow[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("order_draft_item_reference_files")
    .select("item_index, item_client_id, reference_id, position, storage_path, original_filename, file_size, mime_type")
    .eq("draft_id", draftId)
    .eq("upload_status", "uploaded")
    .is("deleted_at", null)
    .order("item_index")
    .order("position");
  if (error) {
    console.error("[order-draft-finalization] normalized reference lookup failed:", error.message);
    throw new Error("Normalized draft references could not be loaded.");
  }
  return (data ?? []).map((row) => ({
    itemIndex: Number(row.item_index),
    itemClientId: String(row.item_client_id),
    referenceId: String(row.reference_id),
    position: Number(row.position),
    storagePath: String(row.storage_path),
    originalFilename: String(row.original_filename),
    fileSize: Number(row.file_size),
    mimeType: String(row.mime_type),
  }));
}

async function verifyNormalizedDraftReferenceObjects(
  references: NormalizedDraftReferenceRow[],
): Promise<DraftFinalizationResult<true>> {
  for (const reference of references) {
    const object = await getStoredDraftObjectInfo(reference.storagePath);
    if (!object.ok) return object;
    if (
      !object.data ||
      object.data.size !== reference.fileSize ||
      object.data.contentType?.toLowerCase() !== reference.mimeType.toLowerCase()
    ) {
      return finalizationError(
        "file_mismatch",
        "A saved reference file could not be verified.",
      );
    }
  }
  return { ok: true, data: true };
}

async function loadProductionOrderBySourceDraft(
  userId: string,
  draftId: string,
): Promise<ProductionOrderLookup | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, service_type, source_draft_id, item_count")
    .eq("user_id", userId)
    .eq("source_draft_id", draftId)
    .maybeSingle();

  if (error) {
    console.error(
      "[order-draft-finalization] source order lookup failed:",
      error.message,
    );
    return null;
  }
  return data ? mapProductionOrderLookup(data) : null;
}

async function loadProductionOrderById(
  userId: string,
  orderId: string,
): Promise<ProductionOrderLookup | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, service_type, source_draft_id, item_count")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(
      "[order-draft-finalization] converted order lookup failed:",
      error.message,
    );
    return null;
  }
  return data ? mapProductionOrderLookup(data) : null;
}

async function loadProductionOrderItemPaths(
  orderId: string,
): Promise<ProductionOrderItemPaths[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("item_index, original_photo_path, reference_image_path")
    .eq("order_id", orderId)
    .order("item_index", { ascending: true });

  if (error) {
    console.error(
      "[order-draft-finalization] source order item lookup failed:",
      error.message,
    );
    return [];
  }

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      itemIndex: typeof record.item_index === "number" ? record.item_index : -1,
      originalPath:
        typeof record.original_photo_path === "string"
          ? record.original_photo_path
          : null,
      referencePath:
        typeof record.reference_image_path === "string"
          ? record.reference_image_path
          : null,
    };
  });
}

async function reconcileExistingDraftOrder(input: {
  input: SubmitOrderDraftInput;
  draft: OrderDraftRow;
  order: ProductionOrderLookup;
  context: TrustedDraftFinalizationContext;
  slots?: DraftFinalizationSlot[];
}): Promise<DraftFinalizationResult<SubmitOrderDraftSuccess>> {
  if (
    !isProductionOrderForDraft(
      input.order,
      input.input.draftId,
      input.context.serviceType,
    ) ||
    input.order.itemCount !== input.context.itemCount
  ) {
    return finalizationError(
      "finalization_incomplete",
      "Existing order could not be verified for this draft.",
    );
  }

  const slotsResult = input.slots
    ? { ok: true as const, data: input.slots }
    : input.context.matchFiles(
        await loadLiveUploadedDraftFiles(input.input.draftId),
      );
  if (!slotsResult.ok) {
    return finalizationError(
      "finalization_incomplete",
      "Existing order could not be reconciled with draft files.",
    );
  }

  const itemPaths = await loadProductionOrderItemPaths(input.order.id);
  if (!hasCompleteUniqueItemIndexes(itemPaths, input.context.itemCount)) {
    return finalizationError(
      "finalization_incomplete",
      "Existing order items could not be verified.",
    );
  }

  const pathByIndex = new Map(itemPaths.map((item) => [item.itemIndex, item]));
  const movedFiles: TrustedMovedDraftFile[] = [];

  for (const slot of slotsResult.data) {
    const paths = pathByIndex.get(slot.itemIndex);
    const expectedOriginalPath = buildTrustedFinalPathForDraftFile({
      orderNumber: input.order.orderNumber,
      itemIndex: slot.itemIndex,
      kind: "original",
      sourcePath: slot.original.storagePath,
      originalFilename: slot.original.originalFilename,
    });
    if (!paths?.originalPath || paths.originalPath !== expectedOriginalPath) {
      return finalizationError(
        "finalization_incomplete",
        "Existing order files could not be reconciled.",
      );
    }
    const originalObject = await verifyReconciledDestinationObject(
      slot.original,
      expectedOriginalPath,
    );
    if (!originalObject.ok) return originalObject;

    movedFiles.push({
      fileId: slot.original.id,
      finalPath: expectedOriginalPath,
    });
    if (slot.reference) {
      const expectedReferencePath = buildTrustedFinalPathForDraftFile({
        orderNumber: input.order.orderNumber,
        itemIndex: slot.itemIndex,
        kind: "reference",
        sourcePath: slot.reference.storagePath,
        originalFilename: slot.reference.originalFilename,
      });
      if (
        !paths.referencePath ||
        paths.referencePath !== expectedReferencePath
      ) {
        return finalizationError(
          "finalization_incomplete",
          "Existing reference files could not be reconciled.",
        );
      }
      const referenceObject = await verifyReconciledDestinationObject(
        slot.reference,
        expectedReferencePath,
      );
      if (!referenceObject.ok) return referenceObject;

      movedFiles.push({
        fileId: slot.reference.id,
        finalPath: expectedReferencePath,
      });
    } else if (paths.referencePath) {
      return finalizationError(
        "finalization_incomplete",
        "Existing order contains an unexpected reference file.",
      );
    }
  }

  if (!input.draft.finalizationKey) {
    return finalizationError(
      "finalization_incomplete",
      "Existing order conversion needs the original finalization claim.",
    );
  }

  const complete = await completeDraftFinalization({
    ...input.input,
    finalizationKey: input.draft.finalizationKey,
    orderId: input.order.id,
    movedFiles,
  });
  if (complete.code !== "completed") {
    return finalizationError(
      "finalization_incomplete",
      "Existing order conversion needs another retry.",
    );
  }

  await removeDraftSourcesBestEffort(
    slotsResult.data.flatMap((slot) => [
      slot.original.storagePath,
      ...(slot.reference ? [slot.reference.storagePath] : []),
    ]),
  );

  return {
    ok: true,
    data: {
      orderNumber: input.order.orderNumber,
      orderId: input.order.id,
      draftId: input.input.draftId,
      alreadyFinalized: true,
      confirmationEmailSent: false,
    },
  };
}

function isProductionOrderForDraft(
  order: ProductionOrderLookup,
  draftId: string,
  serviceType: TrustedDraftFinalizationContext["serviceType"],
): boolean {
  return (
    order.sourceDraftId === draftId &&
    order.serviceType === serviceType
  );
}

function hasCompleteUniqueItemIndexes(
  itemPaths: ProductionOrderItemPaths[],
  expectedCount: number,
): boolean {
  if (itemPaths.length !== expectedCount) return false;
  const seen = new Set<number>();
  for (const item of itemPaths) {
    if (
      !Number.isInteger(item.itemIndex) ||
      item.itemIndex < 0 ||
      item.itemIndex >= expectedCount ||
      seen.has(item.itemIndex)
    ) {
      return false;
    }
    seen.add(item.itemIndex);
  }
  return seen.size === expectedCount;
}

async function verifyReconciledDestinationObject(
  draftFile: OrderDraftFileRow,
  expectedPath: string,
): Promise<DraftFinalizationResult<true>> {
  const stored = await getStoredDraftObjectInfo(expectedPath);
  if (!stored.ok) return finalizationError(stored.code, stored.message);
  if (!stored.data) {
    return finalizationError(
      "finalization_incomplete",
      "Existing order file is missing from Storage.",
    );
  }

  const { basename } = getDraftStoragePathParts(expectedPath);
  if (stored.data.name !== basename) {
    return finalizationError(
      "finalization_incomplete",
      "Existing order file does not match the expected path.",
    );
  }
  if (stored.data.size !== null && stored.data.size !== draftFile.fileSize) {
    return finalizationError(
      "finalization_incomplete",
      "Existing order file size could not be verified.",
    );
  }
  if (
    stored.data.contentType &&
    stored.data.contentType.toLowerCase() !== draftFile.mimeType.toLowerCase()
  ) {
    return finalizationError(
      "finalization_incomplete",
      "Existing order file type could not be verified.",
    );
  }

  return { ok: true, data: true };
}

async function verifyDraftStorageObjects(
  files: OrderDraftFileRow[],
): Promise<DraftFinalizationResult<true>> {
  for (const file of files) {
    const stored = await getStoredDraftObjectInfo(file.storagePath);
    if (!stored.ok) return finalizationError(stored.code, stored.message);
    const verified = verifyStoredDraftObject(file, stored.data);
    if (!verified.ok) {
      return finalizationError("file_mismatch", verified.message);
    }
  }
  return { ok: true, data: true };
}

async function getStoredDraftObjectInfo(
  storagePath: string,
): Promise<DraftFinalizationResult<StoredDraftObjectInfo | null>> {
  try {
    const supabase = getSupabaseAdminClient();
    const { directory, basename } = getDraftStoragePathParts(storagePath);
    const { data, error } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .list(directory, { search: basename, limit: 100 });

    if (error) {
      console.error(
        "[order-draft-finalization] storage list failed:",
        error.message,
      );
      return finalizationError("storage_error", "Could not verify draft files.");
    }

    const object = (data ?? []).find((entry) => entry.name === basename) as
      | SupabaseStorageObject
      | undefined;

    return {
      ok: true,
      data: object ? mapStorageObjectInfo(object) : null,
    };
  } catch (error) {
    console.error("[order-draft-finalization] storage verification threw:", error);
    return finalizationError("storage_error", "Could not verify draft files.");
  }
}

function mapStorageObjectInfo(
  object: SupabaseStorageObject,
): StoredDraftObjectInfo {
  const metadata =
    object.metadata && typeof object.metadata === "object"
      ? object.metadata as Record<string, unknown>
      : {};
  return {
    name: typeof object.name === "string" ? object.name : "",
    size: getNumericMetadata(metadata, ["size", "contentLength"]),
    contentType: getStringMetadata(metadata, [
      "mimetype",
      "mimeType",
      "contentType",
      "content-type",
    ]),
  };
}

function getNumericMetadata(
  metadata: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function getStringMetadata(
  metadata: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return null;
}

async function removeDraftSourcesBestEffort(paths: string[]): Promise<void> {
  // Cleanup policy: completion is durable once draft-file rows point at final
  // production paths. These trusted source paths are retained in memory for one
  // best-effort deletion attempt; if deletion fails, the private draft objects
  // may remain as safe orphans and can be swept later by a storage lifecycle job.
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) return;

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .remove(uniquePaths);
    if (error) {
      console.warn(
        "[order-draft-finalization] source cleanup returned error:",
        error.message,
      );
    }
  } catch (error) {
    console.warn("[order-draft-finalization] source cleanup threw:", error);
  }
}

function mapProductionOrderLookup(row: unknown): ProductionOrderLookup | null {
  if (row === null || typeof row !== "object" || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  return typeof record.id === "string" &&
    typeof record.order_number === "string" &&
    typeof record.service_type === "string" &&
    typeof record.item_count === "number"
    ? {
        id: record.id,
        orderNumber: record.order_number,
        serviceType: record.service_type,
        sourceDraftId:
          typeof record.source_draft_id === "string"
            ? record.source_draft_id
            : null,
        itemCount: record.item_count,
      }
    : null;
}

function messageForFinalizationCode(
  code: Exclude<
    ReturnType<typeof mapClaimCodeToPublicError>,
    null
  >,
): string {
  switch (code) {
    case "not_found":
      return "Draft was not found.";
    case "version_conflict":
      return "Draft has changed since it was loaded.";
    case "invalid_status":
      return "Draft is not ready for finalization.";
    case "finalization_conflict":
      return "Draft is already being finalized.";
    default:
      return "Draft finalization failed.";
  }
}
