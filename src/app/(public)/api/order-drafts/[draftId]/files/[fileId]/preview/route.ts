import { getClientUser } from "@/lib/client-auth";
import { createOrderDraftFilePreviewForUser } from "@/lib/order-drafts/files-server";
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

type OrderDraftFilePreviewRouteContext = {
  params: Promise<{ draftId: string; fileId: string }>;
};

export async function GET(
  _request: Request,
  { params }: OrderDraftFilePreviewRouteContext,
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

    const result = await createOrderDraftFilePreviewForUser(
      sessionUser.id,
      draftId,
      fileId,
    );
    return draftFileResultToResponse(result);
  } catch (error) {
    console.error(
      "[order-draft-file-preview-api] preview failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return unexpectedDraftFileResponse();
  }
}
