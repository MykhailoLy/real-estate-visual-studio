import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { AccountDeletionError, requestAccountDeletion } from "@/lib/account-deletion";

export const maxDuration = 60;

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const auth = await createServerSupabaseClient();
    const { data: { user }, error } = await auth.auth.getUser();
    if (error || !user?.email || !user.email_confirmed_at || user.is_anonymous) {
      return NextResponse.json({ error: "Please sign in with a confirmed account." }, { status: 401, headers });
    }
    const body: unknown = await request.json().catch(() => null);
    const result = await requestAccountDeletion(getSupabaseAdminClient(), user.id, body);
    // The durable lockout is authoritative even when session revocation fails.
    // Browser also clears its local SDK session before leaving the dashboard.
    try { await auth.auth.signOut({ scope: "global" }); } catch { /* worker retains lockout */ }
    return NextResponse.json(result, { status: 202, headers });
  } catch (error) {
    const status = error instanceof AccountDeletionError ? error.status : 503;
    return NextResponse.json({ error: status === 400
      ? "Type your current account email exactly, and send only the confirmation email."
      : "Deletion could not be confirmed. Please retry or contact support." }, { status, headers });
  }
}
