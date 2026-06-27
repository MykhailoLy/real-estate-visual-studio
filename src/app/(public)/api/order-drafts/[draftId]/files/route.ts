import { getClientUser } from "@/lib/client-auth";
import { listUploadedOrderDraftFilesForUser } from "@/lib/order-drafts/files-server";
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

type OrderDraftFilesRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function GET(
  _request: Request,
  { params }: OrderDraftFilesRouteContext,
) {
  try {
    const sessionUser = await getClientUser();
    if (!sessionUser) return unauthenticatedDraftFileResponse();

    const { draftId } = await params;
    if (!validateDraftFileRouteId(draftId)) {
      return invalidDraftFileRouteIdResponse();
    }

    const result = await listUploadedOrderDraftFilesForUser(
      sessionUser.id,
      draftId,
    );
    return draftFileResultToResponse(result);
  } catch (error) {
    logDraftFileApiError("list uploaded draft files", error);
    return unexpectedDraftFileResponse();
  }
}

function logDraftFileApiError(operation: string, error: unknown): void {
  console.error(
    `[order-draft-files-api] ${operation} failed`,
    error instanceof Error ? error.name : "UnknownError",
  );
}
