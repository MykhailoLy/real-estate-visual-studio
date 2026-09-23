import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientUser } from "@/lib/client-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const ParamsSchema = z.object({ submissionId: z.string().uuid() });
const RECOVERY_HEADERS = { "cache-control": "private, no-store, max-age=0" };

export async function GET(
  _request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const user = await getClientUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401, headers: RECOVERY_HEADERS },
    );
  }
  const parsed = ParamsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return unavailableResponse();
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("order_submissions")
    .select("submission_id,status,order_id,reserved_order_number,estimated_total_cents,currency,pricing_snapshot,committed_at,lease_token,lease_expires_at")
    .eq("submission_id", parsed.data.submissionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[order-submission-recovery] lookup failed:", error.message);
    return lookupErrorResponse();
  }
  if (!data) {
    return unavailableResponse();
  }
  let status: "committed" | "processing" | "retryable";
  if (data.status === "committed" && data.order_id) {
    status = "committed";
  } else if (data.status === "processing" && !data.order_id) {
    if (data.lease_token === null && data.lease_expires_at === null) {
      status = "retryable";
    } else {
      const leaseExpiresAt = typeof data.lease_expires_at === "string"
        ? Date.parse(data.lease_expires_at)
        : Number.NaN;
      if (!data.lease_token || !Number.isFinite(leaseExpiresAt)) {
        return lookupErrorResponse();
      }
      // Advisory server-time observation only: claim/commit arbitrate again
      // in PostgreSQL, including a commit or takeover after this read.
      status = leaseExpiresAt <= Date.now() ? "retryable" : "processing";
    }
  } else {
    return lookupErrorResponse();
  }
  return NextResponse.json({
    submissionId: data.submission_id,
    status,
    orderId: data.order_id,
    orderNumber: data.status === "committed" ? data.reserved_order_number : null,
    estimatedTotalCents: data.status === "committed" ? data.estimated_total_cents : null,
    currency: data.status === "committed" ? data.currency : null,
    pricingSnapshot: data.status === "committed" ? data.pricing_snapshot : null,
    committedAt: data.committed_at,
  }, { headers: RECOVERY_HEADERS });
}

function lookupErrorResponse() {
  return NextResponse.json(
    { error: "Could not check submission." },
    { status: 500, headers: RECOVERY_HEADERS },
  );
}

function unavailableResponse() {
  return NextResponse.json(
    {
      status: "unavailable",
      code: "submission_unavailable",
      error: "Submission was not found.",
    },
    { status: 404, headers: RECOVERY_HEADERS },
  );
}
