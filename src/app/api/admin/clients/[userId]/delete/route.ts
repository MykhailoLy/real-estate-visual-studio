import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { AccountDeletionError, requestAccountDeletion } from "@/lib/account-deletion";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers });
  const { userId } = await params;
  if (!z.uuid().safeParse(userId).success) return NextResponse.json({ error: "Invalid client." }, { status: 400, headers });
  try {
    const result = await requestAccountDeletion(getSupabaseAdminClient(), userId, await request.json().catch(() => null));
    return NextResponse.json(result, { status: 202, headers });
  } catch (error) {
    const status = error instanceof AccountDeletionError ? error.status : 503;
    return NextResponse.json({ error: status === 400
      ? "Type the selected client's current account email exactly."
      : "Deletion could not be confirmed. Reload the client list before retrying." }, { status, headers });
  }
}
