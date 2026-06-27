import { getClientUser } from "@/lib/client-auth";
import { prepareOrderDraftFileUploadForUser } from "@/lib/order-drafts/files-server";
import {
  draftFileResultToResponse,
  invalidDraftFileRouteIdResponse,
  parseDraftFileJsonRequest,
  prepareDraftFileValidationResponse,
  unauthenticatedDraftFileResponse,
  unexpectedDraftFileResponse,
  validateDraftFileRouteId,
} from "@/lib/order-drafts/files-api";
import { PrepareOrderDraftFileUploadInputSchema } from "@/lib/order-drafts/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrderDraftFileUploadRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(
  request: Request,
  { params }: OrderDraftFileUploadRouteContext,
) {
  try {
    const sessionUser = await getClientUser();
    if (!sessionUser) return unauthenticatedDraftFileResponse();

    const { draftId } = await params;
    if (!validateDraftFileRouteId(draftId)) {
      return invalidDraftFileRouteIdResponse();
    }

    const body = await parseDraftFileJsonRequest(request);
    if (!body.ok) return body.response;

    const validationResponse = prepareDraftFileValidationResponse(body.data);
    if (validationResponse) return validationResponse;

    const input = PrepareOrderDraftFileUploadInputSchema.parse(body.data);
    const result = await prepareOrderDraftFileUploadForUser(
      sessionUser.id,
      draftId,
      input,
    );
    return draftFileResultToResponse(result, 201);
  } catch (error) {
    logDraftFileApiError("prepare draft file upload", error);
    return unexpectedDraftFileResponse();
  }
}

function logDraftFileApiError(operation: string, error: unknown): void {
  console.error(
    `[order-draft-files-api] ${operation} failed`,
    error instanceof Error ? error.name : "UnknownError",
  );
}
