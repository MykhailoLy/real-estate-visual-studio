import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  OrderMetadataSchema,
  StagingItemSchema,
  RenovationItemSchema,
  FloorPlanItemSchema,
  PhotoEditItemSchema,
  type ServiceType,
} from "@/lib/server-validation";
import {
  recalcStagingSubtotal,
  recalcRenovationSubtotal,
  recalcFloorPlanSubtotal,
  recalcPhotoEditSubtotal,
  getStagingAddonLabels,
  getRenovationInternalLabels,
  getRenovationExternalLabels,
  getFloorPlanTypeLabel,
  getPhotoEditOptionLabels,
} from "@/lib/server-pricing";

// Next.js App Router route segment config
// Allow large request bodies for file uploads
export const maxDuration = 60; // seconds

// Allowed MIME types per service
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
];
const ALLOWED_FLOOR_PLAN_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
  "application/octet-stream", // for DXF/DWG/FBX
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file
const MAX_ITEMS = 50;

/**
 * Create a Supabase client with the service role key (server-side only).
 * This bypasses RLS for storage and DB operations.
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
 * Receives FormData with:
 * - "metadata" field: JSON string with serviceType, contact info, and item details
 * - "file-{itemIndex}-original": original photo for each item
 * - "file-{itemIndex}-reference": optional reference image for each item
 */
export async function POST(request: Request) {
  try {
    // --- 1. Parse FormData ---
    const formData = await request.formData();
    const metadataRaw = formData.get("metadata");

    if (!metadataRaw || typeof metadataRaw !== "string") {
      return NextResponse.json(
        { error: "Missing order metadata" },
        { status: 400 }
      );
    }

    let metadataParsed: unknown;
    try {
      metadataParsed = JSON.parse(metadataRaw);
    } catch {
      return NextResponse.json(
        { error: "Invalid metadata JSON" },
        { status: 400 }
      );
    }

    // --- 2. Validate top-level metadata ---
    const metaResult = OrderMetadataSchema.safeParse(metadataParsed);
    if (!metaResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: metaResult.error.flatten() },
        { status: 400 }
      );
    }

    const { serviceType, contact, deliveryPreferences, items: rawItems } = metaResult.data;

    if (rawItems.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ITEMS} items per order` },
        { status: 400 }
      );
    }

    // --- 3. Validate each item based on service type ---
    const validatedItems = validateItems(serviceType, rawItems);
    if ("error" in validatedItems) {
      return NextResponse.json(
        { error: validatedItems.error, details: validatedItems.details },
        { status: 400 }
      );
    }

    // --- 4. Validate files ---
    const fileValidation = validateFiles(formData, serviceType, validatedItems.items.length);
    if ("error" in fileValidation) {
      return NextResponse.json(
        { error: fileValidation.error },
        { status: 400 }
      );
    }

    // --- 5. Recalculate prices server-side ---
    const itemSubtotals = recalculatePrices(serviceType, validatedItems.items);
    const estimatedTotalCents = itemSubtotals.reduce((sum, s) => sum + s, 0);

    // --- 6. Connect to Supabase ---
    const supabase = getSupabaseAdmin();

    // --- 7. Generate order number ---
    const { data: orderNumber, error: rpcError } = await supabase.rpc(
      "generate_order_number",
      { p_service_type: serviceType }
    );

    if (rpcError || !orderNumber) {
      console.error("Failed to generate order number:", rpcError);
      return NextResponse.json(
        { error: "Failed to generate order number. Please try again." },
        { status: 500 }
      );
    }

    // --- 8. Upload files to Supabase Storage ---
    const uploadedPaths: { original: string | null; reference: string | null }[] = [];

    for (let i = 0; i < validatedItems.items.length; i++) {
      const originalFile = formData.get(`file-${i}-original`) as File | null;
      const referenceFile = formData.get(`file-${i}-reference`) as File | null;

      let originalPath: string | null = null;
      let referencePath: string | null = null;

      if (originalFile && originalFile.size > 0) {
        const ext = getFileExtension(originalFile.name);
        const storagePath = `${orderNumber}/${i}-original.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("order-files")
          .upload(storagePath, originalFile, {
            contentType: originalFile.type,
            upsert: false,
          });
        if (uploadErr) {
          console.error(`Upload failed for item ${i} original:`, uploadErr);
          // Clean up any already-uploaded files
          await cleanupUploadedFiles(supabase, uploadedPaths, orderNumber);
          return NextResponse.json(
            { error: `File upload failed for item ${i + 1}. Please try again.` },
            { status: 500 }
          );
        }
        originalPath = storagePath;
      }

      if (referenceFile && referenceFile.size > 0) {
        const ext = getFileExtension(referenceFile.name);
        const storagePath = `${orderNumber}/${i}-reference.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("order-files")
          .upload(storagePath, referenceFile, {
            contentType: referenceFile.type,
            upsert: false,
          });
        if (uploadErr) {
          console.error(`Upload failed for item ${i} reference:`, uploadErr);
          await cleanupUploadedFiles(supabase, uploadedPaths, orderNumber);
          return NextResponse.json(
            { error: `Reference file upload failed for item ${i + 1}. Please try again.` },
            { status: 500 }
          );
        }
        referencePath = storagePath;
      }

      uploadedPaths.push({ original: originalPath, reference: referencePath });
    }

    // --- 9. Insert order into database ---
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        service_type: serviceType,
        status: "pending",
        client_name: contact.name,
        client_email: contact.email,
        client_phone: contact.phone,
        client_company: contact.company || null,
        item_count: validatedItems.items.length,
        estimated_total_cents: estimatedTotalCents,
        currency: "USD",
      })
      .select("id")
      .single();

    if (orderError || !orderData) {
      console.error("Failed to insert order:", orderError);
      // Clean up uploaded files since order save failed
      await cleanupUploadedFiles(supabase, uploadedPaths, orderNumber);
      return NextResponse.json(
        { error: "Failed to save order. Please try again." },
        { status: 500 }
      );
    }

    // --- 10. Insert order items ---
    // Order-level delivery preferences are denormalized onto each item's
    // `details` JSON because the orders table does not have a JSON column
    // for order-wide metadata. This keeps the schema unchanged while
    // making the preferences visible per item.
    const deliveryPrefsForDetails = {
      file_size_limit: deliveryPreferences?.fileSizeLimit || "",
      disclaimer_text: deliveryPreferences?.disclaimerText || "",
    };

    const orderItemsPayload = validatedItems.items.map((item, i) => ({
      order_id: orderData.id,
      item_index: i,
      original_photo_path: uploadedPaths[i].original,
      reference_image_path: uploadedPaths[i].reference,
      subtotal_cents: itemSubtotals[i],
      details: {
        ...buildItemDetails(serviceType, item),
        delivery_preferences: deliveryPrefsForDetails,
      },
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    if (itemsError) {
      console.error("Failed to insert order items:", itemsError);
      // Order exists but items failed — delete the order (cascade will clean items)
      await supabase.from("orders").delete().eq("id", orderData.id);
      await cleanupUploadedFiles(supabase, uploadedPaths, orderNumber);
      return NextResponse.json(
        { error: "Failed to save order items. Please try again." },
        { status: 500 }
      );
    }

    // --- 11. Success ---
    // TODO: Send emails via Resend here (future step)

    return NextResponse.json({
      success: true,
      orderNumber,
      estimatedTotalCents,
      itemCount: validatedItems.items.length,
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

function validateFiles(
  formData: FormData,
  serviceType: ServiceType,
  itemCount: number
): { valid: true } | { error: string } {
  const allowedTypes =
    serviceType === "3d-floor-plans" ? ALLOWED_FLOOR_PLAN_TYPES : ALLOWED_IMAGE_TYPES;

  for (let i = 0; i < itemCount; i++) {
    const original = formData.get(`file-${i}-original`);
    if (!original || !(original instanceof File) || original.size === 0) {
      return { error: `Item ${i + 1} is missing an uploaded file` };
    }
    if (original.size > MAX_FILE_SIZE) {
      return { error: `Item ${i + 1} file exceeds 20MB limit` };
    }
    if (!allowedTypes.includes(original.type)) {
      return { error: `Item ${i + 1} file type "${original.type}" is not allowed` };
    }

    const reference = formData.get(`file-${i}-reference`);
    if (reference && reference instanceof File && reference.size > 0) {
      if (reference.size > MAX_FILE_SIZE) {
        return { error: `Item ${i + 1} reference file exceeds 20MB limit` };
      }
      if (!ALLOWED_IMAGE_TYPES.includes(reference.type)) {
        return { error: `Item ${i + 1} reference file type is not allowed` };
      }
    }
  }

  return { valid: true };
}

function recalculatePrices(serviceType: ServiceType, items: unknown[]): number[] {
  switch (serviceType) {
    case "virtual-staging":
      return items.map((item) =>
        recalcStagingSubtotal(item as Parameters<typeof recalcStagingSubtotal>[0])
      );
    case "virtual-renovation":
      return items.map((item) =>
        recalcRenovationSubtotal(item as Parameters<typeof recalcRenovationSubtotal>[0])
      );
    case "3d-floor-plans":
      return items.map((item) =>
        recalcFloorPlanSubtotal(item as Parameters<typeof recalcFloorPlanSubtotal>[0])
      );
    case "photo-editing":
      return items.map((item) =>
        recalcPhotoEditSubtotal(item as Parameters<typeof recalcPhotoEditSubtotal>[0])
      );
  }
}

function buildItemDetails(serviceType: ServiceType, item: unknown): Record<string, unknown> {
  switch (serviceType) {
    case "virtual-staging": {
      const s = item as Parameters<typeof recalcStagingSubtotal>[0];
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
      const r = item as Parameters<typeof recalcRenovationSubtotal>[0];
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
      const f = item as Parameters<typeof recalcFloorPlanSubtotal>[0];
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
      const p = item as Parameters<typeof recalcPhotoEditSubtotal>[0];
      return {
        selected_options: p.selectedOptions,
        option_labels: getPhotoEditOptionLabels(p.selectedOptions),
        additional_info: p.additionalInfo || "",
      };
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cleanupUploadedFiles(
  supabase: any,
  uploadedPaths: { original: string | null; reference: string | null }[],
  orderNumber: string
) {
  const pathsToDelete: string[] = [];
  for (const paths of uploadedPaths) {
    if (paths.original) pathsToDelete.push(paths.original);
    if (paths.reference) pathsToDelete.push(paths.reference);
  }
  if (pathsToDelete.length > 0) {
    try {
      await supabase.storage.from("order-files").remove(pathsToDelete);
    } catch (err) {
      console.error(`Cleanup failed for order ${orderNumber}:`, err);
    }
  }
}

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "bin";
}
