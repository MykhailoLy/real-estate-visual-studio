import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
const Body = z.object({ partnerClient: z.boolean() }).strict();
const headers = { "Cache-Control": "no-store" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  }
  const { orderId } = await params;
  if (!z.string().uuid().safeParse(orderId).success) {
    return Response.json({ error: "Invalid order ID." }, { status: 400, headers });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "A Partner client toggle is required." }, { status: 400, headers });
  }
  try {
    const supabase = getSupabaseAdminClient();
    const { data: order, error } = await supabase.from("orders")
      .select("user_id").eq("id", orderId).maybeSingle();
    if (error) throw new Error("Order lookup failed");
    if (!order) {
      return Response.json({ error: "Order not found." }, { status: 404, headers });
    }
    if (!order.user_id) {
      return Response.json({ error: "This order is not linked to an authenticated account." }, { status: 409, headers });
    }
    // The browser supplies only the desired boolean, never the account identity.
    const { error: updateError } = await supabase.from("account_pricing").upsert({
      user_id: order.user_id,
      partner_client: parsed.data.partnerClient,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (updateError) throw new Error("Account pricing update failed");
    return Response.json({ partnerClient: parsed.data.partnerClient }, { headers });
  } catch {
    return Response.json({ error: "Could not update Partner pricing. Please retry." }, { status: 503, headers });
  }
}
