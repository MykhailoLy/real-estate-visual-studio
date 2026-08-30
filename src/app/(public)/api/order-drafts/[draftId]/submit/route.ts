import { getClientUser } from "@/lib/client-auth";
import { getClientProfile } from "@/lib/client-profile";
import { resolveClientIdentity } from "@/lib/profile-completion";
import { submitOrderDraftForUser } from "@/lib/order-drafts/finalization-server";
import { DraftFinalizationBodySchema } from "@/lib/order-drafts/finalization";
import {
  draftFinalizationBodyValidationResponse,
  draftFinalizationResultToResponse,
  invalidDraftFinalizationRouteIdResponse,
  parseDraftFinalizationJsonRequest,
  profileIncompleteDraftFinalizationResponse,
  unauthenticatedDraftFinalizationResponse,
  unexpectedDraftFinalizationResponse,
} from "@/lib/order-drafts/finalization-api";
import { validateDraftId } from "@/lib/order-drafts/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

type OrderDraftSubmitRouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(
  request: Request,
  { params }: OrderDraftSubmitRouteContext,
) {
  try {
    const sessionUser = await getClientUser();
    if (!sessionUser) return unauthenticatedDraftFinalizationResponse();

    const profile = await getClientProfile();
    const identity = resolveClientIdentity(sessionUser.email, profile);
    if (!identity) return profileIncompleteDraftFinalizationResponse();

    const { draftId } = await params;
    if (!validateDraftId(draftId)) {
      return invalidDraftFinalizationRouteIdResponse();
    }

    const body = await parseDraftFinalizationJsonRequest(request);
    if (!body.ok) return body.response;

    const validationResponse = draftFinalizationBodyValidationResponse(body.data);
    if (validationResponse) return validationResponse;

    const parsed = DraftFinalizationBodySchema.parse(body.data);
    const result = await submitOrderDraftForUser({
      userId: sessionUser.id,
      draftId,
      expectedVersion: parsed.expectedVersion,
      finalizationKey: parsed.finalizationKey,
      pricingExpectation: parsed.pricingExpectation,
      clientIdentity: identity,
    });

    return draftFinalizationResultToResponse(result);
  } catch (error) {
    console.error(
      "[order-draft-finalization-api] submit failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return unexpectedDraftFinalizationResponse();
  }
}
