import { getClientUser } from "@/lib/client-auth";
import {
  getOrderDraftForUser,
  softDeleteOrderDraftForUser,
  updateOrderDraftForUser,
} from "@/lib/order-drafts/server";
import {
  DeleteOrderDraftBodySchema,
  deleteOrderDraftValidationResponse,
  draftUpdateResultToResponse,
  invalidDraftIdResponse,
  parseOrderDraftJsonRequest,
  repositoryResultToResponse,
  unauthenticatedOrderDraftResponse,
  unexpectedOrderDraftResponse,
  updateOrderDraftValidationResponse,
  validateDraftId,
} from "@/lib/order-drafts/api";
import { UpdateOrderDraftInputSchema } from "@/lib/order-drafts/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrderDraftRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function GET(
  _request: Request,
  { params }: OrderDraftRouteContext,
) {
  try {
    const sessionUser = await getClientUser();
    if (!sessionUser) return unauthenticatedOrderDraftResponse();

    const { draftId } = await params;
    if (!validateDraftId(draftId)) return invalidDraftIdResponse();

    const result = await getOrderDraftForUser(sessionUser.id, draftId);
    return repositoryResultToResponse(result);
  } catch (error) {
    logOrderDraftApiError("get draft", error);
    return unexpectedOrderDraftResponse();
  }
}

export async function PATCH(
  request: Request,
  { params }: OrderDraftRouteContext,
) {
  try {
    const sessionUser = await getClientUser();
    if (!sessionUser) return unauthenticatedOrderDraftResponse();

    const { draftId } = await params;
    if (!validateDraftId(draftId)) return invalidDraftIdResponse();

    const body = await parseOrderDraftJsonRequest(request);
    if (!body.ok) return body.response;

    const validationResponse = updateOrderDraftValidationResponse(body.data);
    if (validationResponse) return validationResponse;

    const input = UpdateOrderDraftInputSchema.parse(body.data);
    const result = await updateOrderDraftForUser(sessionUser.id, draftId, input);
    return draftUpdateResultToResponse(result);
  } catch (error) {
    logOrderDraftApiError("update draft", error);
    return unexpectedOrderDraftResponse();
  }
}

export async function DELETE(
  request: Request,
  { params }: OrderDraftRouteContext,
) {
  try {
    const sessionUser = await getClientUser();
    if (!sessionUser) return unauthenticatedOrderDraftResponse();

    const { draftId } = await params;
    if (!validateDraftId(draftId)) return invalidDraftIdResponse();

    const body = await parseOrderDraftJsonRequest(request);
    if (!body.ok) return body.response;

    const validationResponse = deleteOrderDraftValidationResponse(body.data);
    if (validationResponse) return validationResponse;

    const { expectedVersion } = DeleteOrderDraftBodySchema.parse(body.data);
    const result = await softDeleteOrderDraftForUser(
      sessionUser.id,
      draftId,
      expectedVersion,
    );
    return draftUpdateResultToResponse(result);
  } catch (error) {
    logOrderDraftApiError("soft delete draft", error);
    return unexpectedOrderDraftResponse();
  }
}

function logOrderDraftApiError(operation: string, error: unknown): void {
  console.error(
    `[order-drafts-api] ${operation} failed`,
    error instanceof Error ? error.name : "UnknownError",
  );
}
