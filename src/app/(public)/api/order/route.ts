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

    const metaResult = OrderMetadataSchema.safeParse(bodyJson);
    if (!metaResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: metaResult.error.flatten() },
        { status: 400 },
      );
    }

    const {
      serviceType,
      currency,
      deliveryPreferences,
      termsAcceptance,
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
    );
    if (!fileValidation.ok) {
      return NextResponse.json(
        { error: fileValidation.error },
        { status: 400 },
      );
    }

    const result = await createProductionOrder({
      ownerUserId: sessionUser.id,
      clientIdentity: identity,
      serviceType,
      jobTitle,
      currency,
      items: validatedItems.items,
      itemFiles,
      deliveryPreferences,
      termsAcceptance,
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
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      orderNumber: result.orderNumber,
      estimatedTotalCents: result.estimatedTotalCents,
      currency: result.currency,
      pricingSnapshot: result.pricingSnapshot,
      itemCount: result.itemCount,
      emailNotifications: result.emailNotifications,
    });
  } catch (err) {
    console.error("Unhandled order submission error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
