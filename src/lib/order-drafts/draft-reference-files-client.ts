"use client";

import { getSupabaseBrowser } from "../supabase.ts";
import { ORDER_FILES_BUCKET } from "../upload-config.ts";
import type {
  DraftReferenceFileSummary,
  PrepareDraftReferenceFileInput,
  PreparedDraftReferenceFile,
} from "./draft-reference-files.ts";

type ClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; status: number; code?: string };

async function request<T>(url: string, init?: RequestInit): Promise<ClientResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    const payload = await response.json().catch(() => ({})) as {
      data?: T;
      error?: string;
      code?: string;
    };
    if (!response.ok || payload.data === undefined) {
      return {
        ok: false,
        status: response.status,
        message: payload.error ?? "Draft reference request failed.",
        ...(typeof payload.code === "string" ? { code: payload.code } : {}),
      };
    }
    return { ok: true, data: payload.data };
  } catch {
    return { ok: false, status: 0, message: "Network error while saving references." };
  }
}

export function listDraftReferenceFiles(draftId: string) {
  return request<DraftReferenceFileSummary[]>(
    `/api/order-drafts/${encodeURIComponent(draftId)}/references`,
  );
}

export function prepareDraftReferenceFile(
  draftId: string,
  input: PrepareDraftReferenceFileInput,
) {
  return request<PreparedDraftReferenceFile>(
    `/api/order-drafts/${encodeURIComponent(draftId)}/references`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function uploadPreparedDraftReferenceFile(
  prepared: PreparedDraftReferenceFile,
  file: File,
): Promise<ClientResult<true>> {
  if (prepared.upload.bucket !== ORDER_FILES_BUCKET) {
    return { ok: false, status: 400, message: "Draft reference target was invalid." };
  }
  try {
    const { error } = await getSupabaseBrowser().storage
      .from(ORDER_FILES_BUCKET)
      .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, file, {
        contentType: file.type,
        upsert: false,
      });
    return error
      ? { ok: false, status: 500, message: "Could not upload this reference." }
      : { ok: true, data: true };
  } catch {
    return { ok: false, status: 500, message: "Could not upload this reference." };
  }
}

export function completeDraftReferenceFile(draftId: string, referenceId: string) {
  return request<DraftReferenceFileSummary>(
    `/api/order-drafts/${encodeURIComponent(draftId)}/references/${encodeURIComponent(referenceId)}/complete`,
    { method: "POST" },
  );
}

export function deleteDraftReferenceFile(draftId: string, referenceId: string) {
  return request<{ id: string }>(
    `/api/order-drafts/${encodeURIComponent(draftId)}/references/${encodeURIComponent(referenceId)}`,
    { method: "DELETE" },
  );
}
