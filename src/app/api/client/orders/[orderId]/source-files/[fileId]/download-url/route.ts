import { type NextRequest, NextResponse } from "next/server";
import { getClientUser } from "@/lib/client-auth";
import {
  getClientSourceFileSlot,
  parseClientSourceFileId,
  type ClientOrderItemSourceFileRow,
} from "@/lib/client-source-files";
import { createServerClient } from "@/lib/supabase";
import { isOrderOwned, toOrderOwnership } from "@/lib/order-ownership";
import { ORDER_FILES_BUCKET } from "@/lib/upload-config";
import { getOrCreatePrivateImagePreview } from "@/lib/private-image-preview";

export const runtime = "nodejs";

const SOURCE_FILE_SIGNED_URL_TTL_SECONDS = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string; fileId: string }> }
) {
  const user = await getClientUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { orderId, fileId } = await params;
  const intent = await getIntent(req);

  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  const parsedFileId = parseClientSourceFileId(fileId);
  if (!parsedFileId) {
    return NextResponse.json({ error: "Invalid source file ID." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServerClient();
  } catch (err) {
    console.error("[client/source-files/download-url] Supabase init:", err);
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, user_id, client_email")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr) {
    console.error("[client/source-files/download-url] Order lookup:", orderErr.message);
    return NextResponse.json({ error: "Could not verify order." }, { status: 500 });
  }
  if (
    !order ||
    !isOrderOwned(
      order as { user_id: string | null; client_email: string | null },
      toOrderOwnership(user)
    )
  ) {
    return NextResponse.json({ error: "Source file not found." }, { status: 404 });
  }

  const { data: item, error: itemErr } = await supabase
    .from("order_items")
    .select("id, item_index, original_photo_path, reference_image_path, details")
    .eq("id", parsedFileId.orderItemId)
    .eq("order_id", orderId)
    .maybeSingle();

  if (itemErr) {
    console.error("[client/source-files/download-url] Item lookup:", itemErr.message);
    return NextResponse.json({ error: "Could not verify source file." }, { status: 500 });
  }
  if (!item) {
    return NextResponse.json({ error: "Source file not found." }, { status: 404 });
  }

  let slot = getClientSourceFileSlot(
    item as unknown as ClientOrderItemSourceFileRow,
    parsedFileId.kind
  );
  if (parsedFileId.referenceId) {
    const { data: reference, error: referenceErr } = await supabase
      .from("order_item_reference_files")
      .select("storage_path, original_filename, file_size, mime_type")
      .eq("order_item_id", parsedFileId.orderItemId)
      .eq("reference_id", parsedFileId.referenceId)
      .maybeSingle();
    if (referenceErr || !reference) {
      return NextResponse.json({ error: "Source file not found." }, { status: 404 });
    }
    slot = {
      kind: "reference",
      storagePath: reference.storage_path,
      filename: reference.original_filename,
      fileSize: reference.file_size,
      mimeType: reference.mime_type,
    };
  }
  if (!slot.storagePath) {
    return NextResponse.json({ error: "Source file not found." }, { status: 404 });
  }

  const previewPath = intent === "preview"
    ? await getOrCreatePrivateImagePreview(supabase, ORDER_FILES_BUCKET, {
        storagePath: slot.storagePath,
        filename: slot.filename,
        fileSize: slot.fileSize,
        mimeType: slot.mimeType,
      })
    : null;
  const signedPath = previewPath ?? slot.storagePath;

  const { data: signed, error: signedErr } = await supabase.storage
    .from(ORDER_FILES_BUCKET)
    .createSignedUrl(
      signedPath,
      SOURCE_FILE_SIGNED_URL_TTL_SECONDS,
      intent === "preview" ? undefined : { download: slot.filename }
    );

  if ((signedErr || !signed?.signedUrl) && previewPath) {
    const { data: originalSigned, error: originalSignedErr } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .createSignedUrl(slot.storagePath, SOURCE_FILE_SIGNED_URL_TTL_SECONDS);
    if (originalSignedErr || !originalSigned?.signedUrl) {
      console.error(
        "[client/source-files/download-url] Original preview URL fallback error:",
        originalSignedErr?.message ?? "No signed URL returned."
      );
      return NextResponse.json({ error: "Could not create file link." }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      signedUrl: originalSigned.signedUrl,
      filename: slot.filename,
    });
  }

  if (signedErr || !signed?.signedUrl) {
    console.error(
      "[client/source-files/download-url] Signed URL error:",
      signedErr?.message ?? "No signed URL returned."
    );
    return NextResponse.json({ error: "Could not create file link." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    signedUrl: signed.signedUrl,
    filename: slot.filename,
  });
}

async function getIntent(req: NextRequest): Promise<"preview" | "download"> {
  const queryIntent = req.nextUrl.searchParams.get("intent");
  if (queryIntent === "preview") return "preview";

  const body = (await req.json().catch(() => ({}))) as { intent?: unknown };
  return body.intent === "preview" ? "preview" : "download";
}
