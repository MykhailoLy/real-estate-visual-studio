import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  OrderMetadataSchema,
  StagingItemSchema,
  RenovationItemSchema,
  FloorPlanItemSchema,
  PhotoEditItemSchema,
  type ServiceType,
  type StagingItem,
  type RenovationItem,
  type FloorPlanItem,
  type PhotoEditItem,
  type ItemFiles,
  type UploadedFile,
} from "@/lib/server-validation";
import {
  getStagingAddonLabels,
  getRenovationInternalLabels,
  getRenovationExternalLabels,
  getFloorPlanTypeLabel,
  getPhotoEditOptionLabels,
} from "@/lib/server-pricing";
import {
  calculateOrderQuote,
  PricingValidationError,
} from "@/lib/pricing/calculate";
import { createPricingSnapshot } from "@/lib/pricing/snapshot";
import type {
  OrderPricingInput,
  OrderQuote,
  TransactionalCurrency,
} from "@/lib/pricing/types";
import {
  ORDER_FILES_BUCKET,
  buildFinalPath,
  getFileExtension,
  type UploadKind,
} from "@/lib/upload-config";
import { sendOrderEmails } from "@/lib/email/send-order-emails";
import { getClientUser } from "@/lib/client-auth";
import { getClientProfile } from "@/lib/client-profile";
import { resolveClientIdentity } from "@/lib/profile-completion";
import { getDedicatedSubServiceLabel } from "@/lib/dedicated-photo-editing";
import {
  getThreeStateLabel,
  getDaySkyStyleLabel,
  isDaySkyStyleId,
  DAY_SKY_STYLE_DEFAULT,
} from "@/lib/image-enhancement";
import {
  getDuskStyleLabel,
  isDuskStyleId,
  DUSK_STYLE_DEFAULT,
} from "@/lib/day-to-dusk";
import { getRemovalTaskLabels, isRemovalTaskId } from "@/lib/item-removal";

// File bytes no longer flow through this route — clients upload directly
// to Supabase Storage via signed URLs from /api/upload-url. This route
// receives a small JSON metadata payload only, well under any Vercel
// Function size limit.
export const maxDuration = 60;

const MAX_ITEMS = 50;

/**
 * Create a Supabase client with the service role key (server-side only).
 * Bypasses RLS for storage and DB operations.
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }
  return createClient(url, key);
}

/**
 * POST /api/order
 *
 * Body (JSON):
 *   {
 *     serviceType,
 *     contact: { name, email, phone, company? },
 *     termsAcceptance: { accepted: true, version, acceptedAt? },
 *     portfolioPermission?: { allowed: boolean },
 *     deliveryPreferences?: { fileSizeLimit, disclaimerText },
 *     items: [...],            // service-specific
 *     itemFiles: [             // parallel to items
 *       {
 *         original: { bucket, path, originalFilename, size, mimeType },
 *         reference?: { bucket, path, originalFilename, size, mimeType } | null
 *       }
 *     ]
 *   }
 */
export async function POST(request: Request) {
  try {
    // --- 1. Parse JSON body ---
    let bodyJson: unknown;
    try {
      bodyJson = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // --- 2. Validate top-level metadata ---
    const metaResult = OrderMetadataSchema.safeParse(bodyJson);
    if (!metaResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: metaResult.error.flatten() },
        { status: 400 }
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

    // --- 2b. REQUIRE a verified session + complete profile (PR 2) ---
    // Ordering is now authenticated-only. Identity is sourced entirely
    // from the verified Supabase session and client_profiles — the
    // request body no longer carries any contact fields, and user_id /
    // email can never be supplied or spoofed by the browser.
    const sessionUser = await getClientUser();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "You must be signed in to submit an order." },
        { status: 401 }
      );
    }

    const profile = await getClientProfile();
    const identity = resolveClientIdentity(sessionUser.email, profile);
    if (!identity) {
      // Profile missing the minimum fields (name + phone) to place an order.
      return NextResponse.json(
        {
          error:
            "Please complete your profile (name and phone) before submitting an order.",
          code: "profile-incomplete",
        },
        { status: 422 }
      );
    }
    const ownerUserId = sessionUser.id;

    if (rawItems.length !== itemFiles.length) {
      return NextResponse.json(
        {
          error:
            "items[] and itemFiles[] must have the same length (one uploaded file descriptor per item).",
        },
        { status: 400 }
      );
    }
    if (rawItems.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ITEMS} items per order` },
        { status: 400 }
      );
    }

    // Trust the server's clock for the recorded acceptance time.
    const serverAcceptedAt = new Date().toISOString();
    const trustedTermsAcceptance = {
      accepted: termsAcceptance.accepted,
      version: termsAcceptance.version || "unspecified",
      accepted_at: serverAcceptedAt,
    };
    const trustedPortfolioPermission = {
      allowed: portfolioPermission?.allowed === true,
    };

    // --- 3. Validate each item based on service type ---
    const validatedItems = validateItems(serviceType, rawItems);
    if ("error" in validatedItems) {
      return NextResponse.json(
        { error: validatedItems.error, details: validatedItems.details },
        { status: 400 }
      );
    }

    // --- 4. Validate uploaded file descriptors ---
    const fileValidation = validateUploadedFiles(serviceType, itemFiles);
    if ("error" in fileValidation) {
      return NextResponse.json(
        { error: fileValidation.error },
        { status: 400 }
      );
    }

    // --- 5. Recalculate prices server-side from canonical fixed prices ---
    let quote: OrderQuote;
    try {
      quote = calculateServerQuote(
        serviceType,
        currency,
        validatedItems.items
      );
    } catch (error) {
      if (error instanceof PricingValidationError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: 400 }
        );
      }
      throw error;
    }
    if (quote.customQuote || quote.totalCents === null) {
      return NextResponse.json(
        {
          error:
            "Orders with 50 or more eligible units require a custom quote.",
          code: "custom-quote-required",
          contactPath: "/contact",
        },
        { status: 409 }
      );
    }
    const pricingSnapshot = createPricingSnapshot(quote);
    const itemSubtotals = quote.items.map((item) => item.lineSubtotalCents);
    const estimatedTotalCents = quote.totalCents;

    // --- 6. Connect to Supabase ---
    const supabase = getSupabaseAdmin();

    // --- 7. Generate order number ---
    const { data: orderNumber, error: rpcError } = await supabase.rpc(
      "generate_order_number",
      { p_service_type: serviceType }
    );

    if (rpcError || !orderNumber) {
      console.error("Failed to generate order number:", rpcError);
      // Pending uploads will be cleaned up by the storage retention
      // policy; we don't have an order number to remove them under.
      await cleanupPendingUploads(supabase, itemFiles);
      return NextResponse.json(
        { error: "Failed to generate order number. Please try again." },
        { status: 500 }
      );
    }

    // --- 8. Move uploaded files from pending/<token>/... to <orderNumber>/... ---
    // This keeps the storage layout identical to the previous
    // implementation (`<orderNumber>/<i>-original.<ext>`), so any
    // tooling/admin scripts that find files by order number keep
    // working. If a single move fails we still record the (pending)
    // path on the row so the file is never orphaned in the DB.
    const finalizedPaths: { original: string | null; reference: string | null }[] = [];

    for (let i = 0; i < itemFiles.length; i++) {
      const slot = itemFiles[i];
      const finalOriginal = await moveToFinalPath(
        supabase,
        slot.original,
        orderNumber,
        i,
        "original"
      );
      const finalReference = slot.reference
        ? await moveToFinalPath(
            supabase,
            slot.reference,
            orderNumber,
            i,
            "reference"
          )
        : null;
      finalizedPaths.push({
        original: finalOriginal,
        reference: finalReference,
      });
    }

    // --- 9. Insert order ---
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        service_type: serviceType,
        status: "pending",
        // Validated order-level Job Title (3–120 trimmed chars).
        // Schema-validated above; trim once more defensively.
        job_title: jobTitle.trim(),
        // Verified-session account link + server-sourced snapshots.
        // None of these come from the request body.
        user_id: ownerUserId,
        client_name: identity.name,
        client_email: identity.email,
        client_phone: identity.phone,
        client_company: identity.company,
        item_count: validatedItems.items.length,
        estimated_total_cents: estimatedTotalCents,
        currency,
        pricing_snapshot: pricingSnapshot,
      })
      .select("id")
      .single();

    if (orderError || !orderData) {
      console.error("Failed to insert order:", orderError);
      // Clean up the just-moved files since the order itself didn't save.
      await cleanupFinalizedFiles(supabase, finalizedPaths);
      return NextResponse.json(
        { error: "Failed to save order. Please try again." },
        { status: 500 }
      );
    }

    // --- 10. Insert order items ---
    const orderItemsPayload = validatedItems.items.map((item, i) => ({
      order_id: orderData.id,
      item_index: i,
      original_photo_path: finalizedPaths[i].original,
      reference_image_path: finalizedPaths[i].reference,
      subtotal_cents: itemSubtotals[i],
      details: {
        ...buildItemDetails(serviceType, item),
        pricing: pricingSnapshot.items[i],
        delivery_preferences: buildDeliveryPreferences(item, deliveryPreferences),
        terms_acceptance: trustedTermsAcceptance,
        portfolio_permission: trustedPortfolioPermission,
        // Persist the uploaded file metadata (filename, size, mime)
        // alongside the item so we have a record of what the client
        // submitted, not just where it landed in storage.
        uploaded_files: {
          original: serializeUploadedFile(itemFiles[i].original),
          reference: itemFiles[i].reference
            ? serializeUploadedFile(itemFiles[i].reference!)
            : null,
        },
      },
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    if (itemsError) {
      console.error("Failed to insert order items:", itemsError);
      await supabase.from("orders").delete().eq("id", orderData.id);
      await cleanupFinalizedFiles(supabase, finalizedPaths);
      return NextResponse.json(
        { error: "Failed to save order items. Please try again." },
        { status: 500 }
      );
    }

    // --- 11. Send notification emails (best-effort; never blocks success) ---
    // The order and its items are already persisted at this point.
    // Email is fire-and-await so we surface deliverability info in
    // logs, but `sendOrderEmails` is documented to never throw and
    // every internal failure mode is logged + swallowed.
    const emailResult = await sendOrderEmails({
      supabase,
      orderNumber,
      serviceType,
      jobTitle: jobTitle.trim(),
      client: {
        name: identity.name,
        email: identity.email,
        phone: identity.phone,
        company: identity.company,
      },
      itemCount: validatedItems.items.length,
      estimatedTotalCents,
      currency,
      pricingSnapshot,
      termsAcceptance: trustedTermsAcceptance,
      portfolioPermission: trustedPortfolioPermission,
      items: validatedItems.items.map((item, i) => ({
        index: i,
        subtotalCents: itemSubtotals[i],
        details: orderItemsPayload[i].details as Record<string, unknown>,
        files: {
          originalPath: finalizedPaths[i].original,
          referenceImagePath: finalizedPaths[i].reference,
          originalFilename: itemFiles[i].original.originalFilename,
          referenceFilename: itemFiles[i].reference?.originalFilename ?? null,
          originalSizeBytes: itemFiles[i].original.size,
          referenceSizeBytes: itemFiles[i].reference?.size ?? null,
        },
      })),
    });

    // --- 12. Success ---
    return NextResponse.json({
      success: true,
      orderNumber,
      estimatedTotalCents,
      currency,
      pricingSnapshot,
      itemCount: validatedItems.items.length,
      // Surface email status so the client can confirm "we emailed
      // you" only when we actually did. The order itself is success
      // regardless of email outcome.
      emailNotifications: {
        clientConfirmation: emailResult.client.sent,
        adminNotification: emailResult.admin.sent,
      },
    });
  } catch (err) {
    console.error("Unhandled order submission error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function validateItems(
  serviceType: ServiceType,
  rawItems: unknown[]
): { items: unknown[] } | { error: string; details?: unknown } {
  const schemaMap = {
    "virtual-staging": StagingItemSchema,
    "virtual-renovation": RenovationItemSchema,
    "3d-floor-plans": FloorPlanItemSchema,
    "photo-editing": PhotoEditItemSchema,
  };

  const schema = schemaMap[serviceType];
  const validated: unknown[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const result = schema.safeParse(rawItems[i]);
    if (!result.success) {
      return {
        error: `Item ${i + 1} validation failed`,
        details: result.error.flatten(),
      };
    }
    validated.push(result.data);
  }

  return { items: validated };
}

/**
 * Defense-in-depth check on the uploaded file descriptors. The signed
 * upload URL endpoint already enforced size + MIME, but we re-check
 * here in case a client tampered with the JSON between the two calls.
 */
function validateUploadedFiles(
  serviceType: ServiceType,
  itemFiles: ItemFiles[]
): { valid: true } | { error: string } {
  for (let i = 0; i < itemFiles.length; i++) {
    const slot = itemFiles[i];
    if (!slot.original || slot.original.bucket !== ORDER_FILES_BUCKET) {
      return { error: `Item ${i + 1} original file descriptor is missing or invalid.` };
    }
    if (slot.reference && slot.reference.bucket !== ORDER_FILES_BUCKET) {
      return { error: `Item ${i + 1} reference file descriptor is invalid.` };
    }
  }
  // The Zod schema already enforces:
  //   - non-empty bucket and path
  //   - path under "pending/<token>/<index>-(original|reference).<ext>"
  //   - size > 0 and within hard cap
  //   - non-empty mimeType / originalFilename
  // so any extra service-specific MIME enforcement happens at signed-URL
  // issuance time. The current value of `serviceType` is intentionally
  // accepted here without re-asserting the MIME allow-list, mirroring
  // the previous behaviour where validation happened before upload.
  void serviceType;
  return { valid: true };
}

function calculateServerQuote(
  serviceType: ServiceType,
  currency: TransactionalCurrency,
  items: unknown[]
): OrderQuote {
  let input: OrderPricingInput;
  switch (serviceType) {
    case "virtual-staging":
      input = {
        serviceType,
        currency,
        items: items as Extract<
          OrderPricingInput,
          { serviceType: "virtual-staging" }
        >["items"],
      };
      break;
    case "virtual-renovation":
      input = {
        serviceType,
        currency,
        items: items as Extract<
          OrderPricingInput,
          { serviceType: "virtual-renovation" }
        >["items"],
      };
      break;
    case "3d-floor-plans":
      input = {
        serviceType,
        currency,
        items: items as Extract<
          OrderPricingInput,
          { serviceType: "3d-floor-plans" }
        >["items"],
      };
      break;
    case "photo-editing":
      input = {
        serviceType,
        currency,
        items: items as Extract<
          OrderPricingInput,
          { serviceType: "photo-editing" }
        >["items"],
      };
      break;
  }
  return calculateOrderQuote(input);
}

/**
 * Resolve the final per-item delivery preferences (item-level first,
 * then order-level fallback for legacy clients).
 */
function buildDeliveryPreferences(
  item: unknown,
  orderLevel: { fileSizeLimit?: string; disclaimerText?: string } | undefined
): { file_size_limit: string; disclaimer_text: string } {
  const itemRecord = (item ?? {}) as {
    fileSizeLimit?: string;
    disclaimerText?: string;
  };
  return {
    file_size_limit:
      itemRecord.fileSizeLimit?.trim() ||
      orderLevel?.fileSizeLimit?.trim() ||
      "",
    disclaimer_text:
      itemRecord.disclaimerText?.trim() ||
      orderLevel?.disclaimerText?.trim() ||
      "",
  };
}

function buildItemDetails(serviceType: ServiceType, item: unknown): Record<string, unknown> {
  switch (serviceType) {
    case "virtual-staging": {
      const s = item as StagingItem;
      return {
        room_name: s.roomName,
        furniture_style: s.furnitureStyle,
        reference_link: s.referenceLink || "",
        additional_info: s.additionalInfo || "",
        selected_addons: s.selectedAddons,
        addon_labels: getStagingAddonLabels(s.selectedAddons),
      };
    }
    case "virtual-renovation": {
      const r = item as RenovationItem;
      return {
        room: r.room,
        presentation_style: r.presentationStyle || "",
        reference_link: r.referenceLink || "",
        additional_info: r.additionalInfo || "",
        selected_internal: r.selectedInternal,
        selected_external: r.selectedExternal,
        internal_labels: getRenovationInternalLabels(r.selectedInternal),
        external_labels: getRenovationExternalLabels(r.selectedExternal),
      };
    }
    case "3d-floor-plans": {
      const f = item as FloorPlanItem;
      return {
        plan_type: f.planType,
        plan_type_label: getFloorPlanTypeLabel(f.planType),
        number_of_floors: f.numberOfFloors,
        style_3d: f.style3d || "",
        plan_view_3d: f.planView3d || "",
        page_orientation: f.pageOrientation,
        plan_orientation: f.planOrientation,
        flooring_by_room: f.flooringByRoom || {},
        show_address: f.showAddress,
        street_address: f.streetAddress || "",
        show_title: f.showTitle,
        project_title: f.projectTitle || "",
        disclaimer_option: f.disclaimerOption || "",
        custom_disclaimer: f.customDisclaimer || "",
        reference_link: f.referenceLink || "",
        additional_info: f.additionalInfo || "",
      };
    }
    case "photo-editing": {
      const p = item as PhotoEditItem;
      const base: Record<string, unknown> = {
        selected_options: p.selectedOptions,
        option_labels: getPhotoEditOptionLabels(p.selectedOptions),
        additional_info: p.additionalInfo || "",
      };
      // Dedicated sub-service (Image Enhancement / Day to Dusk / Item
      // Removal) → persist sub_service + sub_service_label so dashboards,
      // admin and emails can show the dedicated name. Legacy generic
      // orders have no subService and keep the current details shape.
      const subServiceLabel = getDedicatedSubServiceLabel(p.subService);
      if (p.subService && subServiceLabel) {
        base.sub_service = p.subService;
        base.sub_service_label = subServiceLabel;
      }
      // Image Enhancement — Single Exposure preferences. Labels are
      // derived SERVER-SIDE from the validated typed enums; no client
      // label strings are trusted. Stored alongside the existing fixed
      // option (which never changes the subtotal).
      if (p.subService === "image-enhancement-single-exposure") {
        base.grass_repair = getThreeStateLabel(p.grassRepair);
        base.sky_replacement = getThreeStateLabel(p.skyReplacement);
        base.tv_screen_replacement = getThreeStateLabel(p.tvScreenReplacement);
        base.add_fire_to_fireplace = getThreeStateLabel(p.addFireToFireplace);
        base.day_sky_style = isDaySkyStyleId(p.daySkyStyle)
          ? p.daySkyStyle
          : DAY_SKY_STYLE_DEFAULT;
        base.day_sky_style_label = getDaySkyStyleLabel(p.daySkyStyle);
      }
      // Day to Dusk preferences. The dusk-style label is derived
      // SERVER-SIDE from the validated typed enum; no client label
      // strings are trusted. Lighting preferences are persisted as real
      // booleans. All are stored alongside the existing fixed option
      // (which never changes the subtotal).
      if (p.subService === "day-to-dusk") {
        base.dusk_style = isDuskStyleId(p.duskStyle)
          ? p.duskStyle
          : DUSK_STYLE_DEFAULT;
        base.dusk_style_label = getDuskStyleLabel(p.duskStyle);
        base.turn_on_interior_lights = p.turnOnInteriorLights === true;
        base.turn_on_exterior_lights = p.turnOnExteriorLights === true;
        base.add_pool_lights = p.addPoolLights === true;
      }
      // Item Removal & Virtual Cleaning work types. Readable labels are
      // derived SERVER-SIDE from the validated typed enum; no client label
      // strings are trusted. additional_info (the required instructions)
      // and the optional markup/reference upload metadata are persisted by
      // the existing shared paths.
      if (p.subService === "item-removal-virtual-cleaning") {
        const tasks = Array.isArray(p.removalTasks)
          ? p.removalTasks.filter(isRemovalTaskId)
          : [];
        base.removal_tasks = tasks;
        base.removal_task_labels = getRemovalTaskLabels(tasks);
      }
      return base;
    }
  }
}

/**
 * Move a single file from its `pending/<token>/...` upload path to the
 * canonical `<orderNumber>/<index>-<kind>.<ext>` layout. If the move
 * fails, we keep the original (pending) path so the file isn't lost.
 */
async function moveToFinalPath(
  supabase: SupabaseClient,
  uploaded: UploadedFile,
  orderNumber: string,
  itemIndex: number,
  kind: UploadKind
): Promise<string> {
  const ext = getFileExtension(uploaded.path) || getFileExtension(uploaded.originalFilename);
  const finalPath = buildFinalPath(orderNumber, itemIndex, kind, ext);

  if (uploaded.path === finalPath) return finalPath;

  const { error } = await supabase.storage
    .from(ORDER_FILES_BUCKET)
    .move(uploaded.path, finalPath);

  if (error) {
    console.warn(
      `Storage move failed for ${uploaded.path} -> ${finalPath}; keeping pending path. ${error.message}`
    );
    return uploaded.path;
  }
  return finalPath;
}

function serializeUploadedFile(u: UploadedFile) {
  return {
    bucket: u.bucket,
    original_filename: u.originalFilename,
    size_bytes: u.size,
    mime_type: u.mimeType,
  };
}

/**
 * Best-effort cleanup for failures BEFORE the order has been saved.
 * Removes any pending files we know about so they don't accumulate in
 * Storage.
 */
async function cleanupPendingUploads(
  supabase: SupabaseClient,
  itemFiles: ItemFiles[]
) {
  const paths: string[] = [];
  for (const slot of itemFiles) {
    if (slot.original?.path) paths.push(slot.original.path);
    if (slot.reference?.path) paths.push(slot.reference.path);
  }
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(ORDER_FILES_BUCKET).remove(paths);
  } catch (err) {
    console.error("Pending uploads cleanup failed:", err);
  }
}

/**
 * Cleanup for failures AFTER pending files have already been moved to
 * their final `<orderNumber>/...` path but the order/items insert
 * failed.
 */
async function cleanupFinalizedFiles(
  supabase: SupabaseClient,
  finalized: { original: string | null; reference: string | null }[]
) {
  const paths: string[] = [];
  for (const slot of finalized) {
    if (slot.original) paths.push(slot.original);
    if (slot.reference) paths.push(slot.reference);
  }
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(ORDER_FILES_BUCKET).remove(paths);
  } catch (err) {
    console.error("Finalized files cleanup failed:", err);
  }
}
