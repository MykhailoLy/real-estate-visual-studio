import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResolvedClientIdentity } from "@/lib/profile-completion";
import {
  StagingItemSchema,
  RenovationItemSchema,
  FloorPlanItemSchema,
  PhotoEditItemSchema,
  type DeliveryPreferences,
  type FloorPlanItem,
  type ItemFiles,
  type PhotoEditItem,
  type RenovationItem,
  type ServiceType,
  type StagingItem,
  type UploadedFile,
  type UploadedReferenceFile,
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
  PricingSnapshot,
  TransactionalCurrency,
} from "@/lib/pricing/types";
import {
  ORDER_FILES_BUCKET,
  buildFinalPath,
  getFileExtension,
  type UploadKind,
} from "@/lib/upload-config";
import {
  validateDirectPendingDescriptorStructure,
  verifyDirectOrderUploads,
} from "./direct-upload-verification.ts";
import { sendOrderEmails } from "@/lib/email/send-order-emails";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getDedicatedSubServiceLabel,
  SUB_SERVICE_REQUIRED_OPTION,
} from "@/lib/dedicated-photo-editing";
import {
  getAerialEditingOption,
  getEffectiveDaySkyStyle,
  isAerialDetailRequirementSatisfied,
  isDaySkyStyleActive,
  getThreeStateLabel,
  getDaySkyStyleLabel,
} from "@/lib/image-enhancement";
import {
  getDuskStyleLabel,
  isDuskStyleId,
  DUSK_STYLE_DEFAULT,
} from "@/lib/day-to-dusk";
import { getRemovalTaskLabels, isRemovalTaskId } from "@/lib/item-removal";

export type ValidatedOrderItem =
  | StagingItem
  | RenovationItem
  | FloorPlanItem
  | PhotoEditItem;

export type StorageFinalizationMode = "move" | "copy";

export interface TrustedOrderFileDescriptor extends UploadedFile {
  draftFileId?: string;
  referenceId?: string;
  position?: number;
}

export interface TrustedOrderItemFiles {
  original: TrustedOrderFileDescriptor;
  reference?: TrustedOrderFileDescriptor | null;
  references?: Array<TrustedOrderFileDescriptor & {
    referenceId: string;
    position: number;
  }>;
}

export interface FinalizedOrderFile {
  kind: UploadKind;
  sourcePath: string;
  finalPath: string;
  originalFilename: string;
  size: number;
  mimeType: string;
  draftFileId: string | null;
  referenceId?: string;
  position?: number;
}

export interface FinalizedOrderItemFiles {
  original: FinalizedOrderFile;
  reference: FinalizedOrderFile | null;
  references: FinalizedOrderFile[];
}

export interface CreateProductionOrderInput {
  ownerUserId: string;
  clientIdentity: ResolvedClientIdentity;
  serviceType: ServiceType;
  jobTitle: string;
  currency: TransactionalCurrency;
  items: ValidatedOrderItem[];
  itemFiles: TrustedOrderItemFiles[];
  deliveryPreferences?: DeliveryPreferences;
  termsAcceptance: { accepted: boolean; version: string };
  portfolioPermission?: { allowed: boolean };
  sourceDraftId?: string;
  storageMode: StorageFinalizationMode;
}

export type CreateProductionOrderErrorCode =
  | "invalid_input"
  | "invalid_upload"
  | "custom-quote-required"
  | "storage_error"
  | "database_error"
  | "source_draft_exists"
  | (string & {});

export type CreateProductionOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      estimatedTotalCents: number;
      currency: TransactionalCurrency;
      pricingSnapshot: PricingSnapshot;
      itemCount: number;
      emailNotifications: {
        clientConfirmation: boolean;
        adminNotification: boolean;
      };
      finalizedItemFiles: FinalizedOrderItemFiles[];
    }
  | {
      ok: false;
      code: CreateProductionOrderErrorCode;
      message: string;
      status: number;
    };

export function validateOrderItemsForService(
  serviceType: ServiceType,
  rawItems: unknown[],
): { ok: true; items: ValidatedOrderItem[] } | { ok: false; error: string; details?: unknown } {
  const schemaMap = {
    "virtual-staging": StagingItemSchema,
    "virtual-renovation": RenovationItemSchema,
    "3d-floor-plans": FloorPlanItemSchema,
    "photo-editing": PhotoEditItemSchema,
  };

  const schema = schemaMap[serviceType];
  const validated: ValidatedOrderItem[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const result = schema.safeParse(rawItems[i]);
    if (!result.success) {
      return {
        ok: false,
        error: `Item ${i + 1} validation failed`,
        details: result.error.flatten(),
      };
    }
    validated.push(result.data as ValidatedOrderItem);
  }

  return { ok: true, items: validated };
}

export function validatePendingOrderFileDescriptors(
  serviceType: ServiceType,
  itemFiles: ItemFiles[],
): { ok: true } | { ok: false; error: string } {
  const seenPaths = new Set<string>();
  for (let i = 0; i < itemFiles.length; i++) {
    const slot = itemFiles[i];
    if (!slot.original) {
      return {
        ok: false,
        error: `Item ${i + 1} original file descriptor is missing or invalid.`,
      };
    }
    const original = validateDirectPendingDescriptorStructure({
      descriptor: slot.original,
      itemIndex: i,
      kind: "original",
      seenPaths,
    });
    if (!original.ok) {
      return {
        ok: false,
        error: `Item ${i + 1} original file descriptor is missing or invalid.`,
      };
    }
    if (slot.reference) {
      const reference = validateDirectPendingDescriptorStructure({
        descriptor: slot.reference,
        itemIndex: i,
        kind: "reference",
        seenPaths,
      });
      if (!reference.ok) {
        return {
          ok: false,
          error: `Item ${i + 1} reference file descriptor is invalid.`,
        };
      }
    }
    for (const descriptor of slot.references ?? []) {
      const reference = validateDirectPendingDescriptorStructure({
        descriptor: descriptor as UploadedReferenceFile,
        itemIndex: i,
        kind: "reference",
        seenPaths,
      });
      if (!reference.ok) {
        return {
          ok: false,
          error: `Item ${i + 1} reference file descriptor is invalid.`,
        };
      }
    }
  }

  void serviceType;
  return { ok: true };
}

interface SuccessfulDirectMove {
  sourcePath: string;
  finalPath: string;
}

function isSuccessfulDirectMove(
  value: SuccessfulDirectMove | null | undefined,
): value is SuccessfulDirectMove {
  return Boolean(value);
}

async function cleanupAfterFinalizationFailure(input: {
  supabase: SupabaseClient;
  mode: StorageFinalizationMode;
  copiedFinalPaths: string[];
  movedDirectFiles: SuccessfulDirectMove[];
  scope: string;
}): Promise<void> {
  if (input.mode === "move") {
    await rollbackDirectMoves(
      input.supabase,
      input.movedDirectFiles,
      input.scope,
    );
  } else {
    await cleanupFinalPaths(input.supabase, input.copiedFinalPaths);
  }
}

async function cleanupAfterDatabaseFailure(input: {
  supabase: SupabaseClient;
  mode: StorageFinalizationMode;
  finalizedItemFiles: FinalizedOrderItemFiles[];
  movedDirectFiles: SuccessfulDirectMove[];
  scope: string;
}): Promise<void> {
  if (input.mode === "move") {
    await rollbackDirectMoves(
      input.supabase,
      input.movedDirectFiles,
      input.scope,
    );
  } else {
    await cleanupFinalizedFiles(input.supabase, input.finalizedItemFiles);
  }
}

async function rollbackDirectMoves(
  supabase: SupabaseClient,
  movedFiles: SuccessfulDirectMove[],
  scope: string,
): Promise<void> {
  for (const moved of [...movedFiles].reverse()) {
    try {
      const { error } = await supabase.storage
        .from(ORDER_FILES_BUCKET)
        .move(moved.finalPath, moved.sourcePath);
      if (error) {
        console.error("[orders] direct storage rollback returned error:", {
          scope,
          reason: getSafeStorageErrorLabel(error),
        });
      }
    } catch (error) {
      console.error("[orders] direct storage rollback threw:", {
        scope,
        reason: getSafeStorageErrorLabel(error),
      });
    }
  }
}

function getSafeStorageErrorLabel(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.name === "string" && record.name.trim()) {
      return record.name.trim();
    }
    if (typeof record.statusCode === "string" && record.statusCode.trim()) {
      return `status:${record.statusCode.trim()}`;
    }
    if (typeof record.statusCode === "number") {
      return `status:${record.statusCode}`;
    }
  }
  return "StorageError";
}

function directStorageFinalizationError(): {
  ok: false;
  code: "storage_error";
  message: string;
  status: 500;
} {
  return {
    ok: false,
    code: "storage_error",
    message: "Could not finalize uploaded files. Please refresh and upload again.",
    status: 500,
  };
}

export async function createProductionOrder(
  input: CreateProductionOrderInput,
): Promise<CreateProductionOrderResult> {
  if (input.items.length !== input.itemFiles.length) {
    return {
      ok: false,
      code: "invalid_input",
      message: "items[] and itemFiles[] must have the same length.",
      status: 400,
    };
  }

  const aerialValidation = validateSingleExposureAerialRequirements(
    input.serviceType,
    input.items,
    input.itemFiles,
  );
  if (!aerialValidation.ok) return aerialValidation;

  let quote: OrderQuote;
  try {
    quote = calculateServerQuote(input.serviceType, input.currency, input.items);
  } catch (error) {
    if (error instanceof PricingValidationError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        status: 400,
      };
    }
    throw error;
  }

  if (quote.customQuote || quote.totalCents === null) {
    return {
      ok: false,
      code: "custom-quote-required",
      message: "Orders with 50 or more eligible units require a custom quote.",
      status: 409,
    };
  }

  const pricingSnapshot = createPricingSnapshot(quote);
  const itemSubtotals = quote.items.map((item) => item.lineSubtotalCents);
  const estimatedTotalCents = quote.totalCents;
  const supabase = getSupabaseAdminClient();
  const itemFiles =
    input.storageMode === "move"
      ? await verifyDirectOrderUploads({
          supabase,
          ownerUserId: input.ownerUserId,
          serviceType: input.serviceType,
          itemFiles: input.itemFiles.map((slot) => ({
            ...slot,
            references: slot.references ?? [],
          })),
        })
      : { ok: true as const, data: input.itemFiles };

  if (!itemFiles.ok) {
    return {
      ok: false,
      code: itemFiles.code,
      message: itemFiles.message,
      status: itemFiles.status,
    };
  }

  const { data: orderNumber, error: rpcError } = await supabase.rpc(
    "generate_order_number",
    { p_service_type: input.serviceType },
  );

  if (rpcError || !orderNumber) {
    console.error("[orders] failed to generate order number:", rpcError?.message);
    return {
      ok: false,
      code: "database_error",
      message: "Failed to generate order number. Please try again.",
      status: 500,
    };
  }

  const finalizedItemFiles: FinalizedOrderItemFiles[] = [];
  const copiedFinalPaths: string[] = [];
  const movedDirectFiles: SuccessfulDirectMove[] = [];

  for (let i = 0; i < itemFiles.data.length; i++) {
    const slot = itemFiles.data[i];
    const original = await finalizeFileToOrderPath({
      supabase,
      uploaded: slot.original,
      orderNumber,
      itemIndex: i,
      kind: "original",
      mode: input.storageMode,
    });
    if (!original.ok) {
      await cleanupAfterFinalizationFailure({
        supabase,
        mode: input.storageMode,
        copiedFinalPaths,
        movedDirectFiles,
        scope: "original finalization failure",
      });
      return original;
    }
    if (input.storageMode === "copy") copiedFinalPaths.push(original.file.finalPath);
    if (isSuccessfulDirectMove(original.directMove)) {
      movedDirectFiles.push(original.directMove);
    }

    let reference: FinalizedOrderFile | null = null;
    if (slot.reference) {
      const finalizedReference = await finalizeFileToOrderPath({
        supabase,
        uploaded: slot.reference,
        orderNumber,
        itemIndex: i,
        kind: "reference",
        mode: input.storageMode,
        referenceId: slot.reference.referenceId,
      });
      if (!finalizedReference.ok) {
        await cleanupAfterFinalizationFailure({
          supabase,
          mode: input.storageMode,
          copiedFinalPaths,
          movedDirectFiles,
          scope: "reference finalization failure",
        });
        return finalizedReference;
      }
      reference = finalizedReference.file;
      if (input.storageMode === "copy") {
        copiedFinalPaths.push(finalizedReference.file.finalPath);
      }
      if (isSuccessfulDirectMove(finalizedReference.directMove)) {
        movedDirectFiles.push(finalizedReference.directMove);
      }
    }

    const references: FinalizedOrderFile[] = [];
    const trustedReferences = slot.references ?? [];
    for (const trustedReference of trustedReferences) {
      const finalizedReference = await finalizeFileToOrderPath({
        supabase,
        uploaded: trustedReference,
        orderNumber,
        itemIndex: i,
        kind: "reference",
        mode: input.storageMode,
        referenceId: trustedReference.referenceId,
        referencePosition: trustedReference.position,
      });
      if (!finalizedReference.ok) {
        await cleanupAfterFinalizationFailure({
          supabase,
          mode: input.storageMode,
          copiedFinalPaths,
          movedDirectFiles,
          scope: "multi-reference finalization failure",
        });
        return finalizedReference;
      }
      references.push(finalizedReference.file);
      if (input.storageMode === "copy") {
        copiedFinalPaths.push(finalizedReference.file.finalPath);
      }
      if (isSuccessfulDirectMove(finalizedReference.directMove)) {
        movedDirectFiles.push(finalizedReference.directMove);
      }
    }

    if (!reference && references.length > 0) reference = references[0];
    const allReferences = reference
      ? [
          reference,
          ...references.filter(
            (candidate) => candidate.finalPath !== reference.finalPath,
          ),
        ]
      : references;

    finalizedItemFiles.push({
      original: original.file,
      reference,
      references: allReferences,
    });
  }

  const orderInsert: Record<string, unknown> = {
    order_number: orderNumber,
    service_type: input.serviceType,
    status: "pending",
    job_title: input.jobTitle.trim(),
    user_id: input.ownerUserId,
    client_name: input.clientIdentity.name,
    client_email: input.clientIdentity.email,
    client_phone: input.clientIdentity.phone,
    client_company: input.clientIdentity.company,
    item_count: input.items.length,
    estimated_total_cents: estimatedTotalCents,
    currency: input.currency,
    pricing_snapshot: pricingSnapshot,
  };
  if (input.sourceDraftId) {
    orderInsert.source_draft_id = input.sourceDraftId;
  }

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .insert(orderInsert)
    .select("id")
    .single();

  if (orderError || !orderData) {
    console.error("[orders] failed to insert order:", orderError?.message);
    await cleanupAfterDatabaseFailure({
      supabase,
      mode: input.storageMode,
      finalizedItemFiles,
      movedDirectFiles,
      scope: "order insert failure",
    });
    return {
      ok: false,
      code: isUniqueSourceDraftError(orderError) ?
        "source_draft_exists" :
        "database_error",
      message: "Failed to save order. Please try again.",
      status: 500,
    };
  }

  const trustedTermsAcceptance = {
    accepted: input.termsAcceptance.accepted,
    version: input.termsAcceptance.version || "unspecified",
    accepted_at: new Date().toISOString(),
  };
  const trustedPortfolioPermission = {
    allowed: input.portfolioPermission?.allowed === true,
  };

  const orderItemsPayload = input.items.map((item, i) => ({
    id: crypto.randomUUID(),
    order_id: orderData.id,
    item_index: i,
    original_photo_path: finalizedItemFiles[i].original.finalPath,
    reference_image_path: finalizedItemFiles[i].reference?.finalPath ?? null,
    subtotal_cents: itemSubtotals[i],
    details: {
      ...buildItemDetails(input.serviceType, item),
      pricing: pricingSnapshot.items[i],
      delivery_preferences: buildDeliveryPreferences(
        item,
        input.deliveryPreferences,
      ),
      terms_acceptance: trustedTermsAcceptance,
      portfolio_permission: trustedPortfolioPermission,
      uploaded_files: {
        original: serializeUploadedFile(itemFiles.data[i].original),
        reference: getTrustedReferenceFiles(itemFiles.data[i])[0]
          ? serializeUploadedFile(getTrustedReferenceFiles(itemFiles.data[i])[0])
          : null,
        references: getTrustedReferenceFiles(itemFiles.data[i]).map(serializeUploadedFile),
      },
    },
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItemsPayload);

  if (itemsError) {
    console.error(
      "[orders] failed to insert order items:",
      itemsError.message,
    );
    await supabase.from("orders").delete().eq("id", orderData.id);
    await cleanupAfterDatabaseFailure({
      supabase,
      mode: input.storageMode,
      finalizedItemFiles,
      movedDirectFiles,
      scope: "order items insert failure",
    });
    return {
      ok: false,
      code: "database_error",
      message: "Failed to save order items. Please try again.",
      status: 500,
    };
  }

  const insertedItemIds = new Map<number, string>();
  for (const row of orderItemsPayload) {
    insertedItemIds.set(Number(row.item_index), String(row.id));
  }
  const normalizedReferences = finalizedItemFiles.flatMap((slot, itemIndex) => {
    const orderItemId = insertedItemIds.get(itemIndex);
    if (!orderItemId) return [];
    return slot.references.map((reference, position) => ({
      order_item_id: orderItemId,
      reference_id: reference.referenceId ?? crypto.randomUUID(),
      position: reference.position ?? position,
      bucket: ORDER_FILES_BUCKET,
      storage_path: reference.finalPath,
      original_filename: reference.originalFilename,
      file_size: reference.size,
      mime_type: reference.mimeType,
    }));
  });
  if (normalizedReferences.length > 0) {
    const { error: referencesError } = await supabase
      .from("order_item_reference_files")
      .insert(normalizedReferences);
    if (referencesError) {
      console.error("[orders] failed to insert reference files:", referencesError.message);
      await supabase.from("orders").delete().eq("id", orderData.id);
      await cleanupAfterDatabaseFailure({
        supabase,
        mode: input.storageMode,
        finalizedItemFiles,
        movedDirectFiles,
        scope: "reference metadata insert failure",
      });
      return {
        ok: false,
        code: "database_error",
        message: "Failed to save reference files. Please try again.",
        status: 500,
      };
    }
  }

  const emailResult = await sendOrderEmails({
    supabase,
    orderNumber,
    serviceType: input.serviceType,
    jobTitle: input.jobTitle.trim(),
    client: {
      name: input.clientIdentity.name,
      email: input.clientIdentity.email,
      phone: input.clientIdentity.phone,
      company: input.clientIdentity.company,
    },
    itemCount: input.items.length,
    estimatedTotalCents,
    currency: input.currency,
    pricingSnapshot,
    termsAcceptance: trustedTermsAcceptance,
    portfolioPermission: trustedPortfolioPermission,
    items: input.items.map((item, i) => ({
      index: i,
      subtotalCents: itemSubtotals[i],
      details: orderItemsPayload[i].details as Record<string, unknown>,
      files: {
        originalPath: finalizedItemFiles[i].original.finalPath,
        referenceImagePath: finalizedItemFiles[i].reference?.finalPath ?? null,
        originalFilename: itemFiles.data[i].original.originalFilename,
        referenceFilename:
          itemFiles.data[i].reference?.originalFilename ?? null,
        originalSizeBytes: itemFiles.data[i].original.size,
        referenceSizeBytes: itemFiles.data[i].reference?.size ?? null,
      },
    })),
  });

  return {
    ok: true,
    orderId: String(orderData.id),
    orderNumber,
    estimatedTotalCents,
    currency: input.currency,
    pricingSnapshot,
    itemCount: input.items.length,
    emailNotifications: {
      clientConfirmation: emailResult.client.sent,
      adminNotification: emailResult.admin.sent,
    },
    finalizedItemFiles,
  };
}

function calculateServerQuote(
  serviceType: ServiceType,
  currency: TransactionalCurrency,
  items: ValidatedOrderItem[],
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
        items: (items as PhotoEditItem[]).map((item) => ({
          selectedOptions: item.selectedOptions,
          baseOptionId: item.subService
            ? SUB_SERVICE_REQUIRED_OPTION[item.subService]
            : undefined,
        })),
      };
      break;
  }
  return calculateOrderQuote(input);
}

function buildDeliveryPreferences(
  item: unknown,
  orderLevel: DeliveryPreferences | undefined,
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

function buildItemDetails(
  serviceType: ServiceType,
  item: unknown,
): Record<string, unknown> {
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
        reference_link: p.referenceLink || "",
        additional_info: p.additionalInfo || "",
      };
      const subServiceLabel = getDedicatedSubServiceLabel(p.subService);
      if (p.subService && subServiceLabel) {
        base.sub_service = p.subService;
        base.sub_service_label = subServiceLabel;
      }
      if (p.subService === "image-enhancement-single-exposure") {
        base.grass_repair = getThreeStateLabel(p.grassRepair);
        base.sky_replacement = getThreeStateLabel(p.skyReplacement);
        base.tv_screen_replacement = getThreeStateLabel(p.tvScreenReplacement);
        base.add_fire_to_fireplace = getThreeStateLabel(p.addFireToFireplace);
        const daySkyStyle = getEffectiveDaySkyStyle(
          p.skyReplacement,
          p.daySkyStyle,
        );
        if (isDaySkyStyleActive(p.skyReplacement) && daySkyStyle) {
          base.day_sky_style = daySkyStyle;
          base.day_sky_style_label = getDaySkyStyleLabel(daySkyStyle);
        }
        const aerial = getAerialEditingOption(p.aerialEditing);
        base.aerial_editing = aerial.id;
        base.aerial_editing_label = aerial.label;
        base.aerial_editing_instructions =
          p.aerialEditingInstructions?.trim() || "";
      }
      if (p.subService === "day-to-dusk") {
        base.dusk_style = isDuskStyleId(p.duskStyle)
          ? p.duskStyle
          : DUSK_STYLE_DEFAULT;
        base.dusk_style_label = getDuskStyleLabel(p.duskStyle);
        base.turn_on_interior_lights = p.turnOnInteriorLights === true;
        base.turn_on_exterior_lights = p.turnOnExteriorLights === true;
        base.add_pool_lights = p.addPoolLights === true;
      }
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

export function validateSingleExposureAerialRequirements(
  serviceType: ServiceType,
  items: ValidatedOrderItem[],
  itemFiles: TrustedOrderItemFiles[],
):
  | { ok: true }
  | {
      ok: false;
      code: "invalid_input";
      message: string;
      status: 400;
    } {
  if (serviceType !== "photo-editing") return { ok: true };

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] as PhotoEditItem;
    if (item.subService !== "image-enhancement-single-exposure") continue;
    const aerial = getAerialEditingOption(item.aerialEditing);
    if (!isAerialDetailRequirementSatisfied(
      aerial.id,
      item.aerialEditingInstructions,
      Boolean(
        itemFiles[index]?.reference ||
        (itemFiles[index]?.references?.length ?? 0) > 0,
      ),
    )) {
      return {
        ok: false,
        code: "invalid_input",
        message: `Photo ${index + 1} requires Aerial Editing Instructions or at least one Reference File.`,
        status: 400,
      };
    }
  }

  return { ok: true };
}

async function finalizeFileToOrderPath(input: {
  supabase: SupabaseClient;
  uploaded: TrustedOrderFileDescriptor;
  orderNumber: string;
  itemIndex: number;
  kind: UploadKind;
  mode: StorageFinalizationMode;
  referenceId?: string;
  referencePosition?: number;
}): Promise<
  | {
      ok: true;
      file: FinalizedOrderFile;
      directMove?: SuccessfulDirectMove;
    }
  | {
      ok: false;
      code: "storage_error";
      message: string;
      status: 500;
    }
> {
  const ext =
    getFileExtension(input.uploaded.path) ||
    getFileExtension(input.uploaded.originalFilename);
  const finalPath = buildFinalPath(
    input.orderNumber,
    input.itemIndex,
    input.kind,
    ext,
    input.referencePosition,
    input.referenceId,
  );

  if (input.uploaded.path !== finalPath) {
    if (input.mode === "move") {
      const { error } = await input.supabase.storage
        .from(ORDER_FILES_BUCKET)
        .move(input.uploaded.path, finalPath);

      if (error) {
        console.warn("[orders] direct storage move failed:", {
          itemIndex: input.itemIndex,
          kind: input.kind,
          reason: getSafeStorageErrorLabel(error),
        });
        return directStorageFinalizationError();
      }

      return {
        ok: true,
        file: buildFinalizedFile(input, finalPath),
        directMove: {
          sourcePath: input.uploaded.path,
          finalPath,
        },
      };
    } else {
      const { error } = await input.supabase.storage
        .from(ORDER_FILES_BUCKET)
        .copy(input.uploaded.path, finalPath);

      if (error) {
        console.warn(
          `[orders] storage copy failed for draft source ${input.uploaded.draftFileId ?? "unknown"}: ${error.message}`,
        );
        return {
          ok: false,
          code: "storage_error",
          message: "Could not copy draft files into the order.",
          status: 500,
        };
      }
    }
  }

  return {
    ok: true,
    file: buildFinalizedFile(input, finalPath),
  };
}

function buildFinalizedFile(
  input: {
    uploaded: TrustedOrderFileDescriptor;
    kind: UploadKind;
    referenceId?: string;
    referencePosition?: number;
  },
  finalPath: string,
): FinalizedOrderFile {
  return {
    kind: input.kind,
    sourcePath: input.uploaded.path,
    finalPath,
    originalFilename: input.uploaded.originalFilename,
    size: input.uploaded.size,
    mimeType: input.uploaded.mimeType,
    draftFileId: input.uploaded.draftFileId ?? null,
    ...(input.referenceId
      ? {
          referenceId: input.referenceId,
          position: input.referencePosition,
        }
      : {}),
  };
}

function serializeUploadedFile(u: TrustedOrderFileDescriptor) {
  return {
    bucket: u.bucket,
    original_filename: u.originalFilename,
    size_bytes: u.size,
    mime_type: u.mimeType,
  };
}

function getTrustedReferenceFiles(
  slot: TrustedOrderItemFiles,
): TrustedOrderFileDescriptor[] {
  const references = slot.reference
    ? [slot.reference, ...(slot.references ?? [])]
    : (slot.references ?? []);
  const paths = new Set<string>();
  return references.filter((reference) => {
    if (paths.has(reference.path)) return false;
    paths.add(reference.path);
    return true;
  });
}

async function cleanupFinalizedFiles(
  supabase: SupabaseClient,
  finalized: FinalizedOrderItemFiles[],
): Promise<void> {
  const paths: string[] = [];
  for (const slot of finalized) {
    paths.push(slot.original.finalPath);
    for (const reference of slot.references) paths.push(reference.finalPath);
  }
  await cleanupFinalPaths(supabase, paths);
}

async function cleanupFinalPaths(
  supabase: SupabaseClient,
  paths: string[],
): Promise<void> {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) return;
  try {
    const { error } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .remove(uniquePaths);
    if (error) {
      console.error("[orders] storage cleanup returned error:", error.message);
    }
  } catch (error) {
    console.error("[orders] storage cleanup failed:", error);
  }
}

function isUniqueSourceDraftError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "23505" &&
    (error.message ?? "").includes("orders_source_draft_id_unique")
  );
}
