import "server-only";

import {
  getSupabaseAdminClient,
  SupabaseAdminConfigurationError,
} from "../supabase-admin.ts";
import { ORDER_FILES_BUCKET } from "../upload-config.ts";
import {
  buildCreateOrderDraftInsertPayload,
  buildSoftDeleteOrderDraftPayload,
  buildUpdateOrderDraftPayload,
  classifyZeroRowDraftUpdate,
  databaseError,
  draftUpdateDatabaseError,
  draftUpdateInvalidInput,
  mapOrderDraftDatabaseRow,
  mapOrderDraftFileDatabaseRow,
  mapOrderDraftSummary,
  normalizeDraftListLimit,
  notFound,
  ORDER_DRAFT_FILE_SELECT,
  ORDER_DRAFT_SELECT,
  ORDER_DRAFT_SUMMARY_SELECT,
} from "./database.ts";
import { UuidSchema } from "./schema.ts";
import type {
  CreateOrderDraftInput,
  DraftUpdateResult,
  OrderDraftFileRow,
  OrderDraftFinalizationSummary,
  OrderDraftRepositoryResult,
  OrderDraftRow,
  OrderDraftSummary,
  OrderDraftThumbnail,
  UpdateOrderDraftInput,
} from "./types.ts";
import type { DraftFinalizationStatusDto } from "./finalization.ts";
import { PHOTO_EDITING_DRAFT_ROUTE } from "./photo-editing.ts";
import { VIRTUAL_STAGING_DRAFT_ROUTE } from "./virtual-staging.ts";

interface ListActiveDraftOptions {
  limit?: number;
}

interface OwnedSourceOrderSummary {
  id: string;
  orderNumber: string;
  sourceDraftId: string;
}

interface DraftPreviewFileCandidate {
  draftId: string;
  storagePath: string;
  originalFilename: string;
  createdAt: string;
}

const DRAFT_PREVIEW_URL_TTL_SECONDS = 600;

function validateUuid(value: string): boolean {
  return UuidSchema.safeParse(value).success;
}

function invalidInput<T = never>(): OrderDraftRepositoryResult<T> {
  return {
    ok: false,
    code: "invalid_input",
    message: "Invalid order draft identifier.",
  };
}

function handleRepositoryException(
  scope: string,
  error: unknown,
): OrderDraftRepositoryResult<never> {
  if (error instanceof SupabaseAdminConfigurationError) throw error;
  console.error(`[order-drafts] ${scope} failed:`, error);
  return databaseError();
}

function handleDraftUpdateException(
  scope: string,
  error: unknown,
): DraftUpdateResult<never> {
  if (error instanceof SupabaseAdminConfigurationError) throw error;
  console.error(`[order-drafts] ${scope} failed:`, error);
  return draftUpdateDatabaseError();
}

async function classifyZeroRowUpdateForUser(
  userId: string,
  draftId: string,
  expectedVersion: number,
  now: Date,
): Promise<DraftUpdateResult<never>> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("order_drafts")
      .select("version, status, deleted_at, expires_at")
      .eq("id", draftId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[order-drafts] update diagnostic failed:", error.message);
      return draftUpdateDatabaseError();
    }

    return classifyZeroRowDraftUpdate(data, expectedVersion, now);
  } catch (error) {
    return handleDraftUpdateException("update diagnostic", error);
  }
}

export async function createOrderDraftForUser(
  userId: string,
  input: CreateOrderDraftInput,
): Promise<OrderDraftRepositoryResult<OrderDraftRow>> {
  const payloadResult = buildCreateOrderDraftInsertPayload(userId, input);
  if (!payloadResult.ok) return payloadResult;

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("order_drafts")
      .insert(payloadResult.data)
      .select(ORDER_DRAFT_SELECT)
      .single();

    if (error) {
      console.error("[order-drafts] create failed:", error.message);
      return databaseError();
    }
    if (!data) return databaseError("Created draft row was not returned.");

    return { ok: true, data: mapOrderDraftDatabaseRow(data) };
  } catch (error) {
    return handleRepositoryException("create", error);
  }
}

export async function getOrderDraftForUser(
  userId: string,
  draftId: string,
): Promise<OrderDraftRepositoryResult<OrderDraftRow>> {
  if (!validateUuid(userId) || !validateUuid(draftId)) return invalidInput();

  try {
    await recoverStaleFinalizationClaimsForUser(userId, draftId);

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("order_drafts")
      .select(ORDER_DRAFT_SELECT)
      .eq("id", draftId)
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error("[order-drafts] get failed:", error.message);
      return databaseError();
    }
    if (!data) return notFound();

    return { ok: true, data: mapOrderDraftDatabaseRow(data) };
  } catch (error) {
    return handleRepositoryException("get", error);
  }
}

export async function listActiveOrderDraftsForUser(
  userId: string,
  options: ListActiveDraftOptions = {},
): Promise<OrderDraftRepositoryResult<OrderDraftSummary[]>> {
  if (!validateUuid(userId)) return invalidInput();

  try {
    await recoverStaleFinalizationClaimsForUser(userId);

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("order_drafts")
      .select(ORDER_DRAFT_SUMMARY_SELECT)
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("updated_at", { ascending: false })
      .limit(normalizeDraftListLimit(options.limit));

    if (error) {
      console.error("[order-drafts] list failed:", error.message);
      return databaseError();
    }

    const activeDrafts = (data ?? []).map(mapOrderDraftSummary);
    const finishingDrafts = await listOwnedFinishingDraftsForUser(
      supabase,
      userId,
    );
    if (!finishingDrafts.ok) return finishingDrafts;

    const limit = normalizeDraftListLimit(options.limit);
    const visibleDrafts = [...activeDrafts, ...finishingDrafts.data]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);

    return {
      ok: true,
      data: await attachDraftThumbnails(supabase, visibleDrafts),
    };
  } catch (error) {
    return handleRepositoryException("list", error);
  }
}

export async function getOrderDraftFinalizationStatusForUser(
  userId: string,
  draftId: string,
): Promise<OrderDraftRepositoryResult<DraftFinalizationStatusDto>> {
  if (!validateUuid(userId) || !validateUuid(draftId)) return invalidInput();

  try {
    await recoverStaleFinalizationClaimsForUser(userId, draftId);

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("order_drafts")
      .select(ORDER_DRAFT_SELECT)
      .eq("id", draftId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error(
        "[order-drafts] finalization status draft lookup failed:",
        error.message,
      );
      return databaseError();
    }

    if (!data) return { ok: true, data: notFoundFinalizationStatus(draftId) };

    const draft = mapOrderDraftDatabaseRow(data);
    const supportsFinalizationStatus =
      (draft.serviceType === "virtual-staging" &&
        draft.route === VIRTUAL_STAGING_DRAFT_ROUTE) ||
      (draft.serviceType === "photo-editing" &&
        draft.subService === null &&
        draft.route === PHOTO_EDITING_DRAFT_ROUTE);
    if (
      draft.deletedAt !== null ||
      draft.expiresAt <= new Date().toISOString() ||
      !supportsFinalizationStatus
    ) {
      return { ok: true, data: notFoundFinalizationStatus(draftId) };
    }

    if (draft.status === "active") {
      return {
        ok: true,
        data: {
          status: "active",
          draftId: draft.id,
          expectedVersion: draft.version,
        },
      };
    }

    const sourceOrder = await loadAnySourceOrderForDraft(supabase, draft.id);
    if (sourceOrder && sourceOrder.userId !== userId) {
      return { ok: true, data: notFoundFinalizationStatus(draftId) };
    }
    const ownedSourceOrder = sourceOrder
      ? {
          id: sourceOrder.id,
          orderNumber: sourceOrder.orderNumber,
          sourceDraftId: sourceOrder.sourceDraftId,
        }
      : null;

    if (draft.status === "converting") {
      if (!ownedSourceOrder) {
        return {
          ok: true,
          data: {
            status: "finalization_in_progress",
            draftId: draft.id,
            expectedVersion: draft.version,
          },
        };
      }

      return {
        ok: true,
        data: {
          status: "reconciliation_required",
          draftId: draft.id,
          expectedVersion: draft.version,
          orderId: ownedSourceOrder.id,
          orderNumber: ownedSourceOrder.orderNumber,
        },
      };
    }

    if (draft.status === "converted") {
      const convertedOrder = draft.convertedOrderId
        ? await loadOwnedOrderById(supabase, userId, draft.convertedOrderId)
        : null;
      const order = convertedOrder ?? ownedSourceOrder;
      if (!order) return { ok: true, data: notFoundFinalizationStatus(draftId) };

      return {
        ok: true,
        data: {
          status: "already_converted",
          draftId: draft.id,
          expectedVersion: draft.version,
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
      };
    }

    return { ok: true, data: notFoundFinalizationStatus(draftId) };
  } catch (error) {
    return handleRepositoryException("finalization status", error);
  }
}

async function listOwnedFinishingDraftsForUser(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
): Promise<OrderDraftRepositoryResult<OrderDraftSummary[]>> {
  const { data: orderRows, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, source_draft_id")
    .eq("user_id", userId)
    .not("source_draft_id", "is", null);

  if (orderError) {
    console.error(
      "[order-drafts] finishing source order lookup failed:",
      orderError.message,
    );
    return databaseError();
  }

  const orders = (orderRows ?? [])
    .map(mapOwnedSourceOrderSummary)
    .filter((order): order is OwnedSourceOrderSummary => order !== null);
  if (orders.length === 0) return { ok: true, data: [] };

  const orderByDraftId = new Map(
    orders.map((order) => [order.sourceDraftId, order]),
  );
  const { data: draftRows, error: draftError } = await supabase
    .from("order_drafts")
    .select(ORDER_DRAFT_SUMMARY_SELECT)
    .eq("user_id", userId)
    .eq("status", "converting")
    .is("deleted_at", null)
    .gt("expires_at", new Date().toISOString())
    .in("id", Array.from(orderByDraftId.keys()));

  if (draftError) {
    console.error(
      "[order-drafts] finishing draft lookup failed:",
      draftError.message,
    );
    return databaseError();
  }

  return {
    ok: true,
    data: (draftRows ?? []).map((row) => {
      const draft = mapOrderDraftSummary(row);
      const order = orderByDraftId.get(draft.id);
      const finalization: OrderDraftFinalizationSummary | null = order
        ? {
            status: "finishing_order",
            orderId: order.id,
            orderNumber: order.orderNumber,
          }
        : null;
      return {
        ...draft,
        finalization,
      };
    }),
  };
}

async function attachDraftThumbnails(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  drafts: OrderDraftSummary[],
): Promise<OrderDraftSummary[]> {
  if (drafts.length === 0) return drafts;

  const { data, error } = await supabase
    .from("order_draft_files")
    .select("draft_id, storage_path, original_filename, created_at")
    .in("draft_id", drafts.map((draft) => draft.id))
    .eq("kind", "original")
    .in("upload_status", ["uploaded", "moved"])
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[order-drafts] thumbnail lookup failed:", error.message);
    return drafts;
  }

  const grouped = new Map<string, DraftPreviewFileCandidate[]>();
  for (const row of data ?? []) {
    const candidate = mapDraftPreviewFileCandidate(row);
    if (!candidate) continue;
    const current = grouped.get(candidate.draftId) ?? [];
    current.push(candidate);
    grouped.set(candidate.draftId, current);
  }

  const thumbnails = new Map<string, OrderDraftThumbnail>();
  for (const [draftId, candidates] of grouped) {
    const first = candidates[0];
    if (!first) continue;
    const signed = await createSignedDraftPreviewUrl(
      supabase,
      first.storagePath,
    );
    thumbnails.set(draftId, {
      previewUrl: signed?.previewUrl ?? null,
      previewExpiresAt: signed?.previewExpiresAt ?? null,
      originalFilename: first.originalFilename,
      originalCount: candidates.length,
    });
  }

  return drafts.map((draft) => ({
    ...draft,
    thumbnail: thumbnails.get(draft.id) ?? null,
  }));
}

function notFoundFinalizationStatus(draftId: string): DraftFinalizationStatusDto {
  return { status: "not_found", draftId };
}

function mapOwnedSourceOrderSummary(row: unknown): OwnedSourceOrderSummary | null {
  if (row === null || typeof row !== "object" || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  return typeof record.id === "string" &&
    typeof record.order_number === "string" &&
    typeof record.source_draft_id === "string"
    ? {
        id: record.id,
        orderNumber: record.order_number,
        sourceDraftId: record.source_draft_id,
      }
    : null;
}

function mapDraftPreviewFileCandidate(
  row: unknown,
): DraftPreviewFileCandidate | null {
  if (row === null || typeof row !== "object" || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  return typeof record.draft_id === "string" &&
    typeof record.storage_path === "string" &&
    typeof record.original_filename === "string" &&
    typeof record.created_at === "string"
    ? {
        draftId: record.draft_id,
        storagePath: record.storage_path,
        originalFilename: record.original_filename,
        createdAt: record.created_at,
      }
    : null;
}

async function createSignedDraftPreviewUrl(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  storagePath: string,
): Promise<{ previewUrl: string; previewExpiresAt: string } | null> {
  const { data, error } = await supabase.storage
    .from(ORDER_FILES_BUCKET)
    .createSignedUrl(storagePath, DRAFT_PREVIEW_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.warn(
      "[order-drafts] draft preview signing failed:",
      error?.message ?? "No signed URL returned",
    );
    return null;
  }

  return {
    previewUrl: data.signedUrl,
    previewExpiresAt: new Date(
      Date.now() + DRAFT_PREVIEW_URL_TTL_SECONDS * 1000,
    ).toISOString(),
  };
}

async function loadAnySourceOrderForDraft(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  draftId: string,
): Promise<(OwnedSourceOrderSummary & { userId: string | null }) | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, source_draft_id, user_id")
    .eq("source_draft_id", draftId)
    .maybeSingle();

  if (error) {
    console.error(
      "[order-drafts] finalization source order lookup failed:",
      error.message,
    );
    return null;
  }
  return mapSourceOrderWithUser(data);
}

async function loadOwnedOrderById(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
  orderId: string,
): Promise<OwnedSourceOrderSummary | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, source_draft_id")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(
      "[order-drafts] finalization converted order lookup failed:",
      error.message,
    );
    return null;
  }
  return mapOwnedSourceOrderSummary(data);
}

function mapSourceOrderWithUser(
  row: unknown,
): (OwnedSourceOrderSummary & { userId: string | null }) | null {
  if (row === null || typeof row !== "object" || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  const order = mapOwnedSourceOrderSummary(row);
  return order &&
    (typeof record.user_id === "string" || record.user_id === null)
    ? { ...order, userId: record.user_id }
    : null;
}

async function recoverStaleFinalizationClaimsForUser(
  userId: string,
  draftId: string | null = null,
): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.rpc(
      "recover_stale_order_draft_finalization",
      {
        p_user_id: userId,
        p_draft_id: draftId,
      },
    );
    if (error) {
      console.warn(
        "[order-drafts] stale finalization recovery failed:",
        error.message,
      );
    }
  } catch (error) {
    console.warn("[order-drafts] stale finalization recovery threw:", error);
  }
}

export async function listDraftFilesForUser(
  userId: string,
  draftId: string,
): Promise<OrderDraftRepositoryResult<OrderDraftFileRow[]>> {
  const draftResult = await getOrderDraftForUser(userId, draftId);
  if (!draftResult.ok) return draftResult;

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("order_draft_files")
      .select(ORDER_DRAFT_FILE_SELECT)
      .eq("draft_id", draftId)
      .eq("upload_status", "uploaded")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[order-drafts] list files failed:", error.message);
      return databaseError();
    }

    return { ok: true, data: (data ?? []).map(mapOrderDraftFileDatabaseRow) };
  } catch (error) {
    return handleRepositoryException("list files", error);
  }
}

export async function updateOrderDraftForUser(
  userId: string,
  draftId: string,
  input: UpdateOrderDraftInput,
): Promise<DraftUpdateResult<OrderDraftRow>> {
  if (!validateUuid(userId) || !validateUuid(draftId)) {
    return draftUpdateInvalidInput("Invalid order draft identifier.");
  }

  const now = new Date();
  const payloadResult = buildUpdateOrderDraftPayload(input, now);
  if (!payloadResult.ok) return payloadResult;

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("order_drafts")
      .update(payloadResult.draft)
      .eq("id", draftId)
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null)
      .gt("expires_at", now.toISOString())
      .eq("version", input.expectedVersion)
      .select(ORDER_DRAFT_SELECT)
      .maybeSingle();

    if (error) {
      console.error("[order-drafts] update failed:", error.message);
      return draftUpdateDatabaseError();
    }

    if (!data) {
      return classifyZeroRowUpdateForUser(
        userId,
        draftId,
        input.expectedVersion,
        now,
      );
    }

    const draft = mapOrderDraftDatabaseRow(data);
    return { ok: true, draft, version: draft.version };
  } catch (error) {
    return handleDraftUpdateException("update", error);
  }
}

export async function softDeleteOrderDraftForUser(
  userId: string,
  draftId: string,
  expectedVersion: number,
): Promise<DraftUpdateResult<OrderDraftRow>> {
  if (!validateUuid(userId) || !validateUuid(draftId)) {
    return draftUpdateInvalidInput("Invalid order draft identifier.");
  }

  const now = new Date();
  const payloadResult = buildSoftDeleteOrderDraftPayload(expectedVersion, now);
  if (!payloadResult.ok) return payloadResult;

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("order_drafts")
      .update(payloadResult.draft)
      .eq("id", draftId)
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null)
      .gt("expires_at", now.toISOString())
      .eq("version", expectedVersion)
      .select(ORDER_DRAFT_SELECT)
      .maybeSingle();

    if (error) {
      console.error("[order-drafts] soft delete failed:", error.message);
      return draftUpdateDatabaseError();
    }

    if (!data) {
      return classifyZeroRowUpdateForUser(userId, draftId, expectedVersion, now);
    }

    const draft = mapOrderDraftDatabaseRow(data);
    return { ok: true, draft, version: draft.version };
  } catch (error) {
    return handleDraftUpdateException("soft delete", error);
  }
}
