import "server-only";

import {
  getSupabaseAdminClient,
  SupabaseAdminConfigurationError,
} from "../supabase-admin.ts";
import {
  buildCreateOrderDraftInsertPayload,
  databaseError,
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
  OrderDraftFileRow,
  OrderDraftRepositoryResult,
  OrderDraftRow,
  OrderDraftSummary,
} from "./types.ts";

interface ListActiveDraftOptions {
  limit?: number;
}

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

    return { ok: true, data: (data ?? []).map(mapOrderDraftSummary) };
  } catch (error) {
    return handleRepositoryException("list", error);
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
      .is("deleted_at", null)
      .neq("upload_status", "deleted")
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
