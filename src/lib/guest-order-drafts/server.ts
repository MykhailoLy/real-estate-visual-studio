import "server-only";
import { getClientUser } from "../client-auth";
import { getSupabaseAdminClient } from "../supabase-admin";
import { guestDraftRequest } from "./api";
import { checkRateLimit } from "./security";

export function handleGuestDraft(request: Request, operation: Parameters<typeof guestDraftRequest>[1]) {
  return guestDraftRequest(request, operation, {
    db: getSupabaseAdminClient,
    user: getClientUser,
    limit: checkRateLimit,
  });
}
