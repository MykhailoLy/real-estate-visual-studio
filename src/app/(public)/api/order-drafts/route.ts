import { type NextRequest } from "next/server";
import { getClientUser } from "@/lib/client-auth";
import {
  createOrderDraftForUser,
  listActiveOrderDraftsForUser,
} from "@/lib/order-drafts/server";
import {
  createOrderDraftValidationResponse,
  parseDraftListLimit,
  parseOrderDraftJsonRequest,
  repositoryResultToResponse,
  unauthenticatedOrderDraftResponse,
  unexpectedOrderDraftResponse,
} from "@/lib/order-drafts/api";
import { CreateOrderDraftInputSchema } from "@/lib/order-drafts/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getClientUser();
    if (!sessionUser) return unauthenticatedOrderDraftResponse();

    const limit = parseDraftListLimit(request.nextUrl.searchParams);
    const result = await listActiveOrderDraftsForUser(sessionUser.id, { limit });
    return repositoryResultToResponse(result);
  } catch (error) {
    logOrderDraftApiError("list drafts", error);
    return unexpectedOrderDraftResponse();
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getClientUser();
    if (!sessionUser) return unauthenticatedOrderDraftResponse();

    const body = await parseOrderDraftJsonRequest(request);
    if (!body.ok) return body.response;

    const validationResponse = createOrderDraftValidationResponse(body.data);
    if (validationResponse) return validationResponse;

    const input = CreateOrderDraftInputSchema.parse(body.data);
    const result = await createOrderDraftForUser(sessionUser.id, input);
    return repositoryResultToResponse(result, 201);
  } catch (error) {
    logOrderDraftApiError("create draft", error);
    return unexpectedOrderDraftResponse();
  }
}

function logOrderDraftApiError(operation: string, error: unknown): void {
  console.error(
    `[order-drafts-api] ${operation} failed`,
    error instanceof Error ? error.name : "UnknownError",
  );
}
