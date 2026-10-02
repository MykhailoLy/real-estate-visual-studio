import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processAccountDeletion } from "@/lib/account-deletion";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Worker is not configured." }, { status: 503 });
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    return NextResponse.json(await processAccountDeletion(getSupabaseAdminClient()));
  } catch {
    return NextResponse.json({ error: "Deletion remains pending; worker will retry." }, { status: 503 });
  }
}
