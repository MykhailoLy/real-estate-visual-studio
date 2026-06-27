import { getClientUser } from "@/lib/client-auth";
import { completeOrderDraftFileUploadForUser } from "@/lib/order-drafts/files-server";
import {
  draftFileResultToResponse,
  invalidDraftFileRouteIdResponse,
  unauthenticatedDraftFileResponse,
  unexpectedDraftFileResponse,
  validateDraftFileRouteId,
} from "@/lib/order-drafts/files-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CompleteOrderDraftFileRouteContext = {
  params: Promise<{ draftId: string; fileId: string }>;
};

export async function POST(
  _request: Request,
  { params }: CompleteOrderDraftFileRouteContext,
) {
  try {
    const sessionUser = await getClientUser();
    if (!sessionUser) return unauthenticatedDraftFileResponse();

    const { draftId, fileId } = await params;
    if (
      !validateDraftFileRouteId(draftId) ||
      !validateDraftFileRouteId(fileId)
    ) {
      return invalidDraftFileRouteIdResponse();
    }

    const result = await completeOrderDraftFileUploadForUser(
      sessionUser.id,
      draftId,
      fileId,
    );
    return draftFileResultToResponse(result);
  } catch (error) {
    logDraftFileApiError("complete draft file upload", error);
    return unexpectedDraftFileResponse();
  }
}

function logDraftFileApiError(operation: string, error: unknown): void {
  console.error(
    `[order-draft-files-api] ${operation} failed`,
    error instanceof Error ? error.name : "UnknownError",
  );
}
