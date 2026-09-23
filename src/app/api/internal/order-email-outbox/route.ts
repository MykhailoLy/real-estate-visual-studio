import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { dispatchOrderEmailOutbox } from "@/lib/email/send-order-emails";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const maxDuration = 60;

/** Authenticated operational worker, also invoked by Supabase Cron. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Worker is not configured." }, { status: 503 });
  }
  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!safeEqual(authorization, expected)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const result = await dispatchOrderEmailOutbox({
      supabase: getSupabaseAdminClient(),
      limit: 10,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.errorCode }, { status: 503 });
    }
    return NextResponse.json(result);
  } catch {
    console.error("[order-email-outbox] worker initialization failed");
    return NextResponse.json({ ok: false, error: "dispatch_failed" }, { status: 503 });
  }
}

function safeEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes);
}
