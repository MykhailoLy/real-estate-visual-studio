import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { dispatchOrderEmailOutbox } from "@/lib/email/send-order-emails";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const maxDuration = 60;

/** Secure future worker endpoint. No schedule is added by this change. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Worker is not configured." }, { status: 503 });
  }
  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!safeEqual(authorization, expected)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const result = await dispatchOrderEmailOutbox({
    supabase: getSupabaseAdminClient(),
    limit: 10,
  });
  return NextResponse.json(result);
}

function safeEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes);
}
