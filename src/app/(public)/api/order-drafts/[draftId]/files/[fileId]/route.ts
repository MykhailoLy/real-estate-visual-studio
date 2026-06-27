import { getClientUser } from "@/lib/client-auth";
import { softDeleteOrderDraftFileForUser } from "@/lib/order-drafts/files-server";
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

type OrderDraftFileRouteContext = {
  params: Promise<{ draftId: string; fileId: string }>;
};

export async function DELETE(
  _request: Request,
  { params }: OrderDraftFileRouteContext,
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

    const result = await softDeleteOrderDraftFileForUser(
      sessionUser.id,
      draftId,
      fileId,
    );
    return draftFileResultToResponse(result);
  } catch (error) {
    logDraftFileApiError("delete draft file", error);
    return unexpectedDraftFileResponse();
  }
}

function logDraftFileApiError(operation: string, error: unknown): void {
  console.error(
    `[order-draft-files-api] ${operation} failed`,
    error instanceof Error ? error.name : "UnknownError",
  );
}
