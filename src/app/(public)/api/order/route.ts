import { NextResponse } from "next/server";
import { OrderMetadataSchema } from "@/lib/server-validation";
import { getClientUser } from "@/lib/client-auth";
import { getClientProfile } from "@/lib/client-profile";
import { resolveClientIdentity } from "@/lib/profile-completion";
import {
  createProductionOrder,
  validateOrderItemsForService,
  validatePendingOrderFileDescriptors,
} from "@/lib/orders/create-order-server";

// File bytes no longer flow through this route. Clients upload directly
// to Supabase Storage via signed URLs from /api/upload-url, then POST
// small JSON metadata here.
export const maxDuration = 60;

const MAX_ITEMS = 50;

export async function POST(request: Request) {
  try {
    let bodyJson: unknown;
    try {
      bodyJson = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    if (!bodyJson || typeof bodyJson !== "object" || !("submissionId" in bodyJson)) {
      return NextResponse.json(
        {
          error: "This order form is outdated. Refresh before submitting.",
          code: "client_upgrade_required",
        },
        { status: 409 },
      );
    }

    if (!("earlyPerformanceRequest" in bodyJson)) {
      return NextResponse.json(
        {
          error:
            "The order confirmation requirements have changed. Please review the current information and submit again.",
          code: "client_upgrade_required",
        },
        { status: 409 },
      );
    }

    const metaResult = OrderMetadataSchema.safeParse(bodyJson);
    if (!metaResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: metaResult.error.flatten() },
        { status: 400 },
      );
    }

    const {
      submissionId,
      serviceType,
      currency,
      deliveryPreferences,
      termsAcceptance,
      earlyPerformanceRequest,
      pricingExpectation,
      portfolioPermission,
      items: rawItems,
      itemFiles,
      jobTitle,
    } = metaResult.data;

    const sessionUser = await getClientUser();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "You must be signed in to submit an order." },
        { status: 401 },
      );
    }

    const profile = await getClientProfile();
    const identity = resolveClientIdentity(sessionUser.email, profile);
    if (!identity) {
      return NextResponse.json(
        {
          error:
            "Please complete your profile (name and phone) before submitting an order.",
          code: "profile-incomplete",
        },
        { status: 422 },
      );
    }

    if (rawItems.length !== itemFiles.length) {
      return NextResponse.json(
        {
          error:
            "items[] and itemFiles[] must have the same length (one uploaded file descriptor per item).",
        },
        { status: 400 },
      );
    }
    if (rawItems.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ITEMS} items per order` },
        { status: 400 },
      );
    }

    const validatedItems = validateOrderItemsForService(serviceType, rawItems);
    if (!validatedItems.ok) {
      return NextResponse.json(
        { error: validatedItems.error, details: validatedItems.details },
        { status: 400 },
      );
    }

    const fileValidation = validatePendingOrderFileDescriptors(
      serviceType,
      itemFiles,
      submissionId,
    );
    if (!fileValidation.ok) {
      return NextResponse.json(
        { error: fileValidation.error },
        { status: 400 },
      );
    }

    const result = await createProductionOrder({
      submissionId,
      ownerUserId: sessionUser.id,
      clientIdentity: identity,
      serviceType,
      jobTitle,
      currency,
      items: validatedItems.items,
      itemFiles,
      deliveryPreferences,
      termsAcceptance,
      earlyPerformanceRequest,
      pricingExpectation,
      portfolioPermission,
      storageMode: "move",
    });

    if (!result.ok) {
      if (result.code === "custom-quote-required") {
        return NextResponse.json(
          {
            error: result.message,
            code: "custom-quote-required",
            contactPath: "/contact",
          },
          { status: result.status },
        );
      }
      const responseCode = result.code === "in_progress"
        ? "submission_in_progress"
        : result.code === "payload_conflict"
          ? "submission_payload_conflict"
          : result.code === "not_found"
            ? "submission_unavailable"
            : result.code;
      return NextResponse.json(
        {
          error: result.message,
          code: responseCode,
          submissionId,
          ...(result.code === "in_progress"
            ? { recoveryPath: `/api/order/submissions/${submissionId}` }
            : {}),
          ...(result.code === "pricing_changed"
            ? {
                reviewRequired: true,
                newSubmissionIdRequired: true,
                currentPricingSnapshot: result.currentPricingSnapshot,
              }
            : {}),
        },
        { status: result.status },
      );
    }

    return NextResponse.json(
      {
        success: true,
        submissionId,
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        estimatedTotalCents: result.estimatedTotalCents,
        currency: result.currency,
        pricingSnapshot: result.pricingSnapshot,
        itemCount: result.itemCount,
        replayed: result.replayed,
        emailNotifications: result.emailNotifications,
      },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (err) {
    console.error("Unhandled order submission error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
