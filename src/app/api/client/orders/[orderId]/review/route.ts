import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientUser } from "@/lib/client-auth";
import { CLIENT_ORDER_REVIEW_COMMENT_MAX } from "@/lib/client-order-review";
import { submitClientOrderReview } from "@/lib/client-order-reviews";
import { toOrderOwnership } from "@/lib/order-ownership";

export const runtime = "nodejs";

const ReviewBody = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(CLIENT_ORDER_REVIEW_COMMENT_MAX).optional(),
  })
  .strict();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const user = await getClientUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ReviewBody.safeParse(raw);
  if (!parsed.success) {
    const ratingProvided =
      typeof raw === "object" && raw !== null && "rating" in raw;
    const firstIssue = parsed.error.issues[0];
    const error =
      firstIssue?.path[0] === "rating"
        ? ratingProvided
          ? "Rating must be an integer between 1 and 5."
          : "Rating is required."
        : firstIssue?.path[0] === "comment"
          ? `Comment is too long (max ${CLIENT_ORDER_REVIEW_COMMENT_MAX} characters).`
          : "Invalid request.";
    return NextResponse.json(
      { error },
      { status: 400 },
    );
  }

  const result = await submitClientOrderReview(
    {
      orderId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    },
    toOrderOwnership(user),
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      ok: true,
      review: {
        id: result.review.id,
        order_id: result.review.order_id,
        rating: result.review.rating,
        comment: result.review.comment,
        created_at: result.review.created_at,
      },
    },
    { status: 201 },
  );
}
