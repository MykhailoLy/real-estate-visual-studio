import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientUser } from "@/lib/client-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const ParamsSchema = z.object({ submissionId: z.string().uuid() });

export async function GET(
  _request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const user = await getClientUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }
  const parsed = ParamsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return unavailableResponse();
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("order_submissions")
    .select("submission_id,status,order_id,reserved_order_number,estimated_total_cents,currency,pricing_snapshot,committed_at")
    .eq("submission_id", parsed.data.submissionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[order-submission-recovery] lookup failed:", error.message);
    return NextResponse.json({ error: "Could not check submission." }, { status: 500 });
  }
  if (!data) {
    return unavailableResponse();
  }
  const response = NextResponse.json({
    submissionId: data.submission_id,
    status: data.status,
    orderId: data.order_id,
    orderNumber: data.status === "committed" ? data.reserved_order_number : null,
    estimatedTotalCents: data.status === "committed" ? data.estimated_total_cents : null,
    currency: data.status === "committed" ? data.currency : null,
    pricingSnapshot: data.status === "committed" ? data.pricing_snapshot : null,
    committedAt: data.committed_at,
  });
  response.headers.set("cache-control", "private, no-store, max-age=0");
  return response;
}

function unavailableResponse() {
  return NextResponse.json(
    {
      status: "unavailable",
      code: "submission_unavailable",
      error: "Submission was not found.",
    },
    { status: 404 },
  );
}
