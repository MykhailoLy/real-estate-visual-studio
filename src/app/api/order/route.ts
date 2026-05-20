import { NextResponse } from "next/server";

/**
 * POST /api/order
 * Order submission endpoint.
 * TODO: Implement full order processing:
 * 1. Validate request body (Zod)
 * 2. Upload files to Supabase Storage
 * 3. Generate order number
 * 4. Insert order + items into Supabase DB
 * 5. Send confirmation email to client (Resend)
 * 6. Send notification email to admin (Resend)
 * 7. Return success with order number
 */
export async function POST() {
  // Placeholder response
  return NextResponse.json(
    { message: "Order endpoint not yet implemented" },
    { status: 501 }
  );
}
