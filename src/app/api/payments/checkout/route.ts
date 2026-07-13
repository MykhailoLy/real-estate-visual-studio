import { NextResponse } from "next/server";
import { getClientUser } from "@/lib/client-auth";
import { handleCheckoutRequest } from "@/lib/payments/checkout-request";
import { createSupabaseCheckoutRepository } from "@/lib/payments/checkout-repository";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const user = await getClientUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await handleCheckoutRequest(body, {
    getAuthenticatedUser: async () => user,
    repository: createSupabaseCheckoutRepository(getSupabaseAdminClient()),
  });

  return NextResponse.json(result.body, { status: result.status });
}
