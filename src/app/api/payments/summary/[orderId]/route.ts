import { NextResponse } from "next/server";
import { getClientUser } from "@/lib/client-auth";
import { createSupabaseCheckoutRepository } from "@/lib/payments/checkout-repository";
import { getAuthoritativePaymentSummary } from "@/lib/payments/payment-summary";
import { getExpectedStripeLivemode } from "@/lib/payments/stripe-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<NextResponse> {
  const user = await getClientUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { orderId } = await params;
  if (!UUID_PATTERN.test(orderId)) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  try {
    const summary = await getAuthoritativePaymentSummary(orderId, user.id, {
      repository: createSupabaseCheckoutRepository(getSupabaseAdminClient()),
      expectedStripeLivemode: getExpectedStripeLivemode(),
    });
    if (!summary) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    return NextResponse.json(summary, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    console.error("[payments/summary] unavailable");
    return NextResponse.json(
      { error: "Payment details are temporarily unavailable." },
      { status: 502 },
    );
  }
}
