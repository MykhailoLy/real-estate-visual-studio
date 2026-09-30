import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { escapeIlikeLiteral, isOrderOwned, toOrderOwnership } from "@/lib/order-ownership";

export const runtime = "nodejs";

// This endpoint prepares ownership only. Auth credentials never pass through it.
// Identity is always verified by Auth; no request body or query is consumed.
export async function POST() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const auth = await createServerSupabaseClient();
    const { data: { user }, error } = await auth.auth.getUser();
    if (error || !user?.email?.trim() || !user.email_confirmed_at || user.is_anonymous) {
      return NextResponse.json(
        { error: "Please sign in with a confirmed email before changing it." },
        { status: 401, headers },
      );
    }

    const db = getSupabaseAdminClient();
    const ownership = toOrderOwnership({ id: user.id, email: user.email });
    // Narrow the DB candidates while including whitespace-padded snapshots.
    // Substring/pattern-alias false positives never authorize a claim below.
    const emailCandidate = `%${escapeIlikeLiteral(user.email.trim())}%`;

    async function legacyOrders() {
      const eligible: { id: string; client_email: string }[] = [];
      const pageSize = 100;
      let afterId: string | null = null;
      for (;;) {
        let query = db.from("orders")
          .select("id, user_id, client_email")
          .is("user_id", null)
          .ilike("client_email", emailCandidate)
          .order("id")
          .limit(pageSize);
        // Cursor pagination is unaffected when another request claims earlier
        // rows during the scan.
        if (afterId !== null) query = query.gt("id", afterId);
        const { data, error: readError } = await query;
        if (readError || !data) throw new Error("Ownership lookup failed");
        for (const row of data) {
          // Use the authoritative trim + lowercase ownership rule to match,
          // but retain the raw snapshot for the conditional claim below.
          if (row.user_id === null && typeof row.client_email === "string" &&
              isOrderOwned(row, ownership)) {
            eligible.push({ id: row.id, client_email: row.client_email });
          }
        }
        if (data.length < pageSize) return eligible;
        afterId = data[data.length - 1].id;
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
