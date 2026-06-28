import "server-only";

import {
  getSupabaseAdminClient,
  SupabaseAdminConfigurationError,
} from "../supabase-admin.ts";
import type { ResolvedClientIdentity } from "../profile-completion.ts";
import { TERMS_VERSION } from "../order-terms.ts";
import { ORDER_FILES_BUCKET } from "../upload-config.ts";
import {
  createProductionOrder,
  type FinalizedOrderItemFiles,
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
  buildTrustedMovedDraftFiles,
  buildVirtualStagingFinalizationItemFiles,
  finalizationError,
  mapClaimCodeToPublicError,
  mapVirtualStagingDraftStateToProductionItems,
  parseClaimFinalizationRpcResult,
  parseCompleteFinalizationRpcResult,
  parseReleaseFinalizationRpcResult,
  validateAndMatchVirtualStagingDraftFiles,
  validateVirtualStagingDraftForFinalization,
  type DraftFinalizationResult,
  type TrustedMovedDraftFile,
  type VirtualStagingFinalizationSlot,
} from "./finalization.ts";
import { UuidSchema } from "./schema.ts";
import type {
  OrderDraftFileRow,
  OrderDraftRow,
} from "./types.ts";

export interface SubmitVirtualStagingDraftInput {
  userId: string;
  draftId: string;
  expectedVersion: number;
  finalizationKey: string;
  clientIdentity: ResolvedClientIdentity;
}

export interface SubmitVirtualStagingDraftSuccess {
  orderNumber: string;
  orderId: string;
  draftId: string;
  alreadyFinalized: boolean;
  confirmationEmailSent: boolean;
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

export async function submitVirtualStagingDraftForUser(
  input: SubmitVirtualStagingDraftInput,
): Promise<DraftFinalizationResult<SubmitVirtualStagingDraftSuccess>> {
  if (
    !UuidSchema.safeParse(input.userId).success ||
    !UuidSchema.safeParse(input.draftId).success ||
    !UuidSchema.safeParse(input.finalizationKey).success
  ) {
    return finalizationError("invalid_input", "Invalid draft finalization input.");
  }

  try {
    const claim = await claimDraftFinalization(input);
    const claimError = mapClaimCodeToPublicError(claim.code);
    if (claimError) {
      return finalizationError(
        claimError,
        messageForFinalizationCode(claimError),
      );
    }

    if (claim.code === "already_converted") {
      const existing = claim.convertedOrderId
        ? await loadProductionOrderById(input.userId, claim.convertedOrderId)
        : await loadProductionOrderBySourceDraft(input.userId, input.draftId);
      if (!existing || !isProductionOrderForDraft(existing, input.draftId)) {
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

    const draft = await loadClaimedDraft(input.userId, input.draftId);
    if (!draft) {
      await releaseClaimBestEffort(input);
      return finalizationError("not_found", "Draft was not found.");
    }

    const stateResult = validateVirtualStagingDraftForFinalization(draft);
    if (!stateResult.ok) {
      await releaseClaimBestEffort(input);
      return stateResult;
    }

    const existingOrder = claim.convertedOrderId
      ? await loadProductionOrderById(input.userId, claim.convertedOrderId)
      : await loadProductionOrderBySourceDraft(input.userId, input.draftId);

    if (existingOrder) {
      const reconciled = await reconcileExistingDraftOrder({
        input,
        draft,
        order: existingOrder,
      });
      return reconciled;
    }

    const productionItems =
      mapVirtualStagingDraftStateToProductionItems(stateResult.data);
    if (!productionItems.ok) {
      await releaseClaimBestEffort(input);
      return productionItems;
    }

    const files = await loadLiveUploadedDraftFiles(input.draftId);
    const slots = validateAndMatchVirtualStagingDraftFiles({
      verifiedUserId: input.userId,
      draftId: input.draftId,
      state: stateResult.data,
      files,
    });
    if (!slots.ok) {
      await releaseClaimBestEffort(input);
      return slots;
    }

    const storageVerification = await verifyDraftStorageObjects(files);
    if (!storageVerification.ok) {
      await releaseClaimBestEffort(input);
      return storageVerification;
    }

    const itemFiles = buildVirtualStagingFinalizationItemFiles(slots.data);
    const sourcePaths = collectDraftSourcePaths(itemFiles);

    const orderResult = await createProductionOrder({
      ownerUserId: input.userId,
      clientIdentity: input.clientIdentity,
      serviceType: "virtual-staging",
      jobTitle: stateResult.data.jobTitle,
      currency: draft.currency,
      items: productionItems.data,
      itemFiles,
      termsAcceptance: {
        accepted: stateResult.data.termsUi.accepted,
        version: TERMS_VERSION,
      },
      portfolioPermission: {
        allowed: stateResult.data.termsUi.allowPortfolio,
      },
      sourceDraftId: input.draftId,
      storageMode: "copy",
    });

    if (!orderResult.ok) {
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
            slots: slots.data,
          });
        }
      }

      await releaseClaimBestEffort(input);
      return finalizationError(
        orderResult.code === "storage_error"
          ? "storage_error"
          : orderResult.code === "database_error"
            ? "database_error"
            : "invalid_status",
        orderResult.message,
      );
    }

    const movedFiles = buildMovedFilesFromFinalized(orderResult.finalizedItemFiles);
    const complete = await completeDraftFinalization({
      ...input,
      orderId: orderResult.orderId,
      movedFiles,
    });
    if (complete.code !== "completed") {
      return finalizationError(
        "finalization_incomplete",
        "Order was created, but draft conversion needs to be reconciled.",
      );
    }

    await removeDraftSourcesBestEffort(sourcePaths);

    return {
      ok: true,
      data: {
        orderNumber: orderResult.orderNumber,
        orderId: orderResult.orderId,
        draftId: input.draftId,
        alreadyFinalized: false,
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

async function claimDraftFinalization(input: SubmitVirtualStagingDraftInput) {
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
      code: "invalid_status" as const,
      draftId: null,
      convertedOrderId: null,
    };
  }
  return parseClaimFinalizationRpcResult(data);
}

async function completeDraftFinalization(input: SubmitVirtualStagingDraftInput & {
  orderId: string;
  movedFiles: TrustedMovedDraftFile[];
}) {
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
      code: "invalid_status" as const,
      draftId: null,
      convertedOrderId: null,
    };
  }
  return parseCompleteFinalizationRpcResult(data);
}

async function releaseClaimBestEffort(
  input: SubmitVirtualStagingDraftInput,
): Promise<void> {
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
      return;
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
  } catch (error) {
    console.warn("[order-draft-finalization] release RPC threw:", error);
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
  input: SubmitVirtualStagingDraftInput;
  draft: OrderDraftRow;
  order: ProductionOrderLookup;
  slots?: VirtualStagingFinalizationSlot[];
}): Promise<DraftFinalizationResult<SubmitVirtualStagingDraftSuccess>> {
  const stateResult = validateVirtualStagingDraftForFinalization(input.draft);
  if (!stateResult.ok) return stateResult;

  if (
    !isProductionOrderForDraft(input.order, input.input.draftId) ||
    input.order.itemCount !== stateResult.data.items.length
  ) {
    return finalizationError(
      "finalization_incomplete",
      "Existing order could not be verified for this draft.",
    );
  }

  const slotsResult = input.slots
    ? { ok: true as const, data: input.slots }
    : validateAndMatchVirtualStagingDraftFiles({
        verifiedUserId: input.input.userId,
        draftId: input.input.draftId,
        state: stateResult.data,
        files: await loadLiveUploadedDraftFiles(input.input.draftId),
      });
  if (!slotsResult.ok) {
    return finalizationError(
      "finalization_incomplete",
      "Existing order could not be reconciled with draft files.",
    );
  }

  const itemPaths = await loadProductionOrderItemPaths(input.order.id);
  if (!hasCompleteUniqueItemIndexes(itemPaths, stateResult.data.items.length)) {
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
): boolean {
  return (
    order.sourceDraftId === draftId &&
    order.serviceType === "virtual-staging"
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

function buildMovedFilesFromFinalized(
  finalizedItemFiles: FinalizedOrderItemFiles[],
): TrustedMovedDraftFile[] {
  return buildTrustedMovedDraftFiles(
    finalizedItemFiles.flatMap((slot) => [
      {
        draftFileId: slot.original.draftFileId,
        finalPath: slot.original.finalPath,
      },
      ...(slot.reference
        ? [
            {
              draftFileId: slot.reference.draftFileId,
              finalPath: slot.reference.finalPath,
            },
          ]
        : []),
    ]),
  );
}

function collectDraftSourcePaths(
  itemFiles: ReturnType<typeof buildVirtualStagingFinalizationItemFiles>,
): string[] {
  return itemFiles.flatMap((slot) => [
    slot.original.path,
    ...(slot.reference ? [slot.reference.path] : []),
  ]);
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
