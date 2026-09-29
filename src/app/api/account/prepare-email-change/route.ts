import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { escapeIlikeLiteral } from "@/lib/order-ownership";

export const runtime = "nodejs";

// This endpoint prepares ownership only. Auth credentials never pass through it.
// Identity is always verified by Auth; no request body or query is consumed.
export async function POST() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const auth = await createServerSupabaseClient();
    const { data: { user }, error } = await auth.auth.getUser();
    if (error || !user?.email || !user.email_confirmed_at || user.is_anonymous) {
      return NextResponse.json(
        { error: "Please sign in with a confirmed email before changing it." },
        { status: 401, headers },
      );
    }

    const db = getSupabaseAdminClient();
    const verifiedEmail = user.email;
    const currentEmail = verifiedEmail.toLowerCase();

    async function legacyOrders() {
      const eligible: { id: string; client_email: string }[] = [];
      const pageSize = 100;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error: readError } = await db.from("orders")
          .select("id, user_id, client_email")
          .is("user_id", null)
          .ilike("client_email", escapeIlikeLiteral(verifiedEmail))
          .order("id")
          .range(offset, offset + pageSize - 1);
        if (readError || !data) throw new Error("Ownership lookup failed");
        for (const row of data) {
          // Exact equality also protects valid email metacharacters from any
          // PostgREST pattern aliases. Do not trim historical snapshots.
          if (row.user_id === null && typeof row.client_email === "string" &&
              row.client_email.toLowerCase() === currentEmail) {
            eligible.push({ id: row.id, client_email: row.client_email });
          }
        }
        if (data.length < pageSize) return eligible;
      }
    }

    const orders = await legacyOrders();
    for (const order of orders) {
      const { data, error: claimError } = await db.from("orders")
        .update({ user_id: user.id })
        .eq("id", order.id)
        .is("user_id", null)
        .eq("client_email", order.client_email)
        .select("id, user_id");
      if (claimError || data?.length !== 1 || data[0].id !== order.id || data[0].user_id !== user.id) {
        throw new Error("Ownership claim could not be confirmed");
      }
    }
    // Recheck after claims: incomplete, failed, or concurrent writes must not
    // allow the UI to start an email change that could strand legacy orders.
    if ((await legacyOrders()).length !== 0) throw new Error("Legacy orders remain");

    return NextResponse.json({ prepared: true, userId: user.id, email: user.email }, { headers });
  } catch {
    return NextResponse.json(
      { error: "We could not confirm your order ownership. Your email has not been changed. Please try again." },
      { status: 503, headers },
    );
  }
}
