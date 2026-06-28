import { getClientUser } from "@/lib/client-auth";
import { getOrderDraftFinalizationStatusForUser } from "@/lib/order-drafts/server";
import {
  invalidDraftIdResponse,
  repositoryResultToResponse,
  unauthenticatedOrderDraftResponse,
  unexpectedOrderDraftResponse,
  validateDraftId,
} from "@/lib/order-drafts/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrderDraftFinalizationStatusRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function GET(
  _request: Request,
  { params }: OrderDraftFinalizationStatusRouteContext,
) {
  try {
    const sessionUser = await getClientUser();
    if (!sessionUser) return unauthenticatedOrderDraftResponse();

    const { draftId } = await params;
    if (!validateDraftId(draftId)) return invalidDraftIdResponse();

    const result = await getOrderDraftFinalizationStatusForUser(
      sessionUser.id,
      draftId,
    );
    return repositoryResultToResponse(result);
  } catch (error) {
    console.error(
      "[order-draft-finalization-status-api] lookup failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return unexpectedOrderDraftResponse();
  }
}
