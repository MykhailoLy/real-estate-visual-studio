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
  type PricingExpectationData,
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
import { createPricingSnapshot, parsePricingSnapshot } from "@/lib/pricing/snapshot";
import type {
  OrderPricingInput,
  OrderQuote,
  PricingSnapshot,
  TransactionalCurrency,
} from "@/lib/pricing/types";
import type { WelcomeOfferAvailability } from "@/lib/welcome-offer";
import type { WelcomeOfferBenefitKey } from "@/lib/welcome-offer";
import { comparePricingExpectation } from "@/lib/pricing/expectation";
import { AccountPricingError, getPartnerClient } from "@/lib/account-pricing-server";
import {
  getWelcomeOfferAvailability,
  WelcomeOfferEligibilityError,
} from "@/lib/welcome-offer-server";
import {
  ORDER_FILES_BUCKET,
  buildFinalPath,
  getFileExtension,
  normalizeSupabaseUserId,
  parseDirectPendingPath,
  pendingTokenForSubmissionId,
  type UploadKind,
} from "@/lib/upload-config";
import {
  validateDirectPendingDescriptorStructure,
  verifyDirectOrderUploads,
} from "./direct-upload-verification.ts";
import {
  getStorageObjectIdentity,
  storageIdentitiesMatch,
  verifyOrderFileSignatures,
  type StorageObjectIdentity,
} from "../uploads/file-signature.ts";
import { dispatchOrderEmailOutbox } from "@/lib/email/send-order-emails";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveCurrentTermsAcceptance } from "@/lib/order-terms";
import { resolveCurrentEarlyPerformanceRequest } from "@/lib/early-performance";
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
import {
  createAuthoritativeQuoteHash,
  createOrderIntentHash,
  ORDER_SUBMISSION_SCHEMA_VERSION,
} from "./order-submission-fingerprint.ts";

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
  submissionId: string;
  ownerUserId: string;
  clientIdentity: ResolvedClientIdentity;
  serviceType: ServiceType;
  jobTitle: string;
  currency: TransactionalCurrency;
  items: ValidatedOrderItem[];
  itemFiles: TrustedOrderItemFiles[];
  deliveryPreferences?: DeliveryPreferences;
  termsAcceptance: { accepted: boolean; version?: string };
  earlyPerformanceRequest: {
    requested: boolean;
    version?: string;
    requestedAt?: string;
  };
  pricingExpectation?: PricingExpectationData;
  portfolioPermission?: { allowed: boolean };
  sourceDraftId?: string;
  draftExpectedVersion?: number;
  draftFinalizationKey?: string;
  storageMode: StorageFinalizationMode;
}

export type CreateProductionOrderErrorCode =
  | "invalid_input"
  | "invalid_upload"
  | "custom-quote-required"
  | "storage_error"
  | "database_error"
  | "in_progress"
  | "payload_conflict"
  | "pricing_changed"
  | "not_found"
  | "draft_conflict"
  | "client_upgrade_required"
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
      replayed: boolean;
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
      currentPricingSnapshot?: PricingSnapshot;
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
  submissionId: string,
): { ok: true } | { ok: false; error: string } {
  const expectedPendingToken = pendingTokenForSubmissionId(submissionId);
  if (!expectedPendingToken) {
    return { ok: false, error: "submissionId is invalid." };
  }
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
    if (original.data.pendingToken !== expectedPendingToken) {
      return { ok: false, error: "Upload namespace does not match submissionId." };
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
      if (reference.data.pendingToken !== expectedPendingToken) {
        return { ok: false, error: "Upload namespace does not match submissionId." };
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
      if (reference.data.pendingToken !== expectedPendingToken) {
        return { ok: false, error: "Upload namespace does not match submissionId." };
      }
    }
  }

  void serviceType;
  return { ok: true };
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

export async function createProductionOrder(
  input: CreateProductionOrderInput,
): Promise<CreateProductionOrderResult> {
  const termsHandshake = resolveCurrentTermsAcceptance(input.termsAcceptance);
  if (!termsHandshake.ok) {
    if (termsHandshake.reason === "not_accepted") {
      return {
        ok: false,
        code: "invalid_input",
        message: "Terms must be accepted to submit an order.",
        status: 400,
      };
    }
    return {
      ok: false,
      code: "client_upgrade_required",
      message:
        "The Terms have changed. Please review and accept the current Terms before submitting your order.",
      status: 409,
    };
  }

  const earlyPerformanceHandshake = resolveCurrentEarlyPerformanceRequest(
    input.earlyPerformanceRequest,
  );
  if (!earlyPerformanceHandshake.ok) {
    if (earlyPerformanceHandshake.reason === "not_requested") {
      return {
        ok: false,
        code: "invalid_input",
        message:
          "Request to start work after any required payment or order confirmation is required.",
        status: 400,
      };
    }
    return {
      ok: false,
      code: "client_upgrade_required",
      message:
        "The order confirmation requirements have changed. Please review the current information and submit again.",
      status: 409,
    };
  }

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

  if (input.storageMode === "move") {
    const ownerUserId = normalizeSupabaseUserId(input.ownerUserId);
    const files = input.itemFiles.flatMap((slot) => [
      slot.original,
      ...getTrustedReferenceFiles(slot),
    ]);
    // A retry after switching sessions must not claim the original submission
    // for another owner. Check path ownership before any claim, without reading
    // Storage: a committed replay may already have removed its pending sources.
    if (!ownerUserId || files.some((file) =>
      parseDirectPendingPath(file.path)?.userId !== ownerUserId
    )) {
      return {
        ok: false,
        code: "invalid_upload",
        message: "Uploaded files could not be verified. Please sign in with the account that started this order.",
        status: 400,
      };
    }
  }

  const supabase = getSupabaseAdminClient();
  let partnerClient: boolean;
  try {
    partnerClient = await getPartnerClient(input.ownerUserId, supabase);
  } catch (error) {
    if (error instanceof AccountPricingError) {
      return { ok: false, code: "database_error", message: error.message, status: 503 };
    }
    throw error;
  }
  const potentialWelcomeBenefitKey = getPotentialWelcomeOfferBenefitKey(
    input.serviceType,
    input.items,
  );
  let welcomeOfferAvailability: WelcomeOfferAvailability | undefined;
  if (potentialWelcomeBenefitKey) {
    try {
      welcomeOfferAvailability = await getWelcomeOfferAvailability(
        input.ownerUserId,
        supabase,
      );
    } catch (error) {
      if (error instanceof WelcomeOfferEligibilityError) {
        return {
          ok: false,
          code: "database_error",
          message: "Welcome Offer eligibility could not be verified. Please retry.",
          status: 503,
        };
      }
      throw error;
    }
  }

  let quote: OrderQuote;
  try {
    quote = calculateServerQuote(
      input.serviceType,
      input.currency,
      input.items,
      welcomeOfferAvailability,
      partnerClient,
    );
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

  const expectationComparison = comparePricingExpectation(
    input.pricingExpectation,
    quote,
  );
  if (!expectationComparison.ok) {
    if (expectationComparison.reason === "client_upgrade_required") {
      return {
        ok: false,
        code: "client_upgrade_required",
        message:
          "Pricing information has changed. Refresh the page, review the current price, and submit again.",
        status: 409,
      };
    }
    return {
      ok: false,
      code: "pricing_changed",
      message:
        "Account benefits or pricing changed. Review and confirm the current price.",
      status: 409,
      currentPricingSnapshot: createPricingSnapshot(quote),
    };
  }

  const requestHash = createOrderIntentHash({
    ...input,
    termsAcceptance: termsHandshake.acceptance,
    earlyPerformanceRequest: earlyPerformanceHandshake.request,
  });
  const quoteHash = createAuthoritativeQuoteHash(quote);
  const proposedSnapshot = createPricingSnapshot(quote);
  const leaseToken = crypto.randomUUID();
  const { data: claimData, error: claimError } = await supabase.rpc(
    "claim_order_submission",
    {
      p_user_id: input.ownerUserId,
      p_submission_id: input.submissionId,
      p_request_hash: requestHash,
      p_request_schema_version: ORDER_SUBMISSION_SCHEMA_VERSION,
      p_service_type: input.serviceType,
      p_source_draft_id: input.sourceDraftId ?? null,
      p_lease_token: leaseToken,
      p_currency: input.currency,
      p_pricing_version: quote.pricingVersion,
      p_quote_hash: quoteHash,
      p_estimated_total_cents: quote.totalCents,
      p_pricing_snapshot: proposedSnapshot,
    },
  );
  if (claimError) {
    console.error("[orders] submission claim failed:", claimError.message);
    return databaseAmbiguityError();
  }
  const claim = firstRpcRow<OrderSubmissionClaimRow>(claimData);
  if (!claim) return databaseAmbiguityError();
  if (claim.result_code === "committed") {
    return committedResultFromClaim(claim, input.items.length);
  }
  const claimFailure = mapClaimFailure(claim.result_code, proposedSnapshot);
  if (claimFailure) return claimFailure;
  if (
    claim.result_code !== "claimed" ||
    claim.lease_token !== leaseToken ||
    !claim.reserved_order_number
  ) {
    return databaseAmbiguityError();
  }

  const pricingSnapshot = parsePricingSnapshot(claim.pricing_snapshot);
  if (!pricingSnapshot || pricingSnapshot.totalCents === null) {
    await releaseSubmissionBestEffort(supabase, input, leaseToken, "invalid_snapshot");
    return databaseAmbiguityError();
  }
  const itemSubtotals = pricingSnapshot.items.map((item) => item.lineSubtotalCents);
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
    await releaseSubmissionBestEffort(supabase, input, leaseToken, itemFiles.code);
    return {
      ok: false,
      code: itemFiles.code,
      message: itemFiles.message,
      status: itemFiles.status,
    };
  }

  const signatureVerification = await verifyOrderFileSignatures({
    supabase,
    files: itemFiles.data.flatMap((slot) => [
      slot.original,
      ...getTrustedReferenceFiles(slot),
    ]),
  });
  if (!signatureVerification.ok) {
    await releaseSubmissionBestEffort(
      supabase,
      input,
      leaseToken,
      signatureVerification.code,
    );
    return signatureVerification;
  }

  const orderNumber = claim.reserved_order_number;
  const finalizedItemFiles: FinalizedOrderItemFiles[] = [];
  // Direct retries share deterministic final paths. A failed handler cannot
  // delete them safely after another handler takes over its lease. Keep both
  // sources and prepared finals until a confirmed commit; preserve draft cleanup.
  const copiedFinalPaths: string[] = [];

  for (let i = 0; i < itemFiles.data.length; i++) {
    const slot = itemFiles.data[i];
    const original = await finalizeFileToOrderPath({
      supabase,
      uploaded: slot.original,
      orderNumber,
      itemIndex: i,
      kind: "original",
      mode: input.storageMode,
      verifiedIdentities: signatureVerification.identities,
    });
    if (!original.ok) {
      await cleanupFinalPaths(supabase, copiedFinalPaths);
      await releaseSubmissionBestEffort(supabase, input, leaseToken, original.code);
      return original;
    }
    if (original.createdFinal && input.storageMode === "copy") {
      copiedFinalPaths.push(original.file.finalPath);
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
        verifiedIdentities: signatureVerification.identities,
      });
      if (!finalizedReference.ok) {
        await cleanupFinalPaths(supabase, copiedFinalPaths);
        await releaseSubmissionBestEffort(supabase, input, leaseToken, finalizedReference.code);
        return finalizedReference;
      }
      reference = finalizedReference.file;
      if (finalizedReference.createdFinal && input.storageMode === "copy") {
        copiedFinalPaths.push(finalizedReference.file.finalPath);
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
        verifiedIdentities: signatureVerification.identities,
      });
      if (!finalizedReference.ok) {
        await cleanupFinalPaths(supabase, copiedFinalPaths);
        await releaseSubmissionBestEffort(supabase, input, leaseToken, finalizedReference.code);
        return finalizedReference;
      }
      references.push(finalizedReference.file);
      if (finalizedReference.createdFinal && input.storageMode === "copy") {
        copiedFinalPaths.push(finalizedReference.file.finalPath);
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

  const trustedTermsAcceptance = {
    ...termsHandshake.acceptance,
    accepted_at: new Date().toISOString(),
  };
  const trustedEarlyPerformanceRequest = {
    ...earlyPerformanceHandshake.request,
    requested_at: new Date().toISOString(),
  };
  const trustedPortfolioPermission = {
    allowed: input.portfolioPermission?.allowed === true,
  };

  const orderItemsPayload = input.items.map((item, i) => ({
    itemIndex: i,
    originalPhotoPath: finalizedItemFiles[i].original.finalPath,
    referenceImagePath: finalizedItemFiles[i].reference?.finalPath ?? null,
    subtotalCents: itemSubtotals[i],
    details: {
      ...buildItemDetails(input.serviceType, item),
      pricing: pricingSnapshot.items[i],
      delivery_preferences: buildDeliveryPreferences(
        item,
        input.deliveryPreferences,
      ),
      terms_acceptance: trustedTermsAcceptance,
      early_performance_request: trustedEarlyPerformanceRequest,
      portfolio_permission: trustedPortfolioPermission,
      uploaded_files: {
        original: serializeUploadedFile(itemFiles.data[i].original),
        reference: getTrustedReferenceFiles(itemFiles.data[i])[0]
          ? serializeUploadedFile(getTrustedReferenceFiles(itemFiles.data[i])[0])
          : null,
        references: getTrustedReferenceFiles(itemFiles.data[i]).map(serializeUploadedFile),
      },
    },
    references: finalizedItemFiles[i].references.map((reference, position) => ({
      referenceId: reference.referenceId ?? crypto.randomUUID(),
      position: reference.position ?? position,
      bucket: ORDER_FILES_BUCKET,
      storagePath: reference.finalPath,
      originalFilename: reference.originalFilename,
      fileSize: reference.size,
      mimeType: reference.mimeType,
    })),
  }));

  const movedDraftFiles = input.sourceDraftId
    ? finalizedItemFiles.flatMap((slot) => [slot.original, ...slot.references])
        .filter((file) => file.draftFileId)
        .map((file) => ({ fileId: file.draftFileId!, finalPath: file.finalPath }))
    : null;
  const appliedWelcomeBenefitKeys = pricingSnapshot.welcomeOffer.benefits.map(
    (benefit) => benefit.key,
  );
  const commitRpcName =
    appliedWelcomeBenefitKeys.length > 0
      ? "commit_order_submission_with_welcome_offer_v1"
      : "commit_order_submission";
  const commitRpcParams = {
      p_user_id: input.ownerUserId,
      p_submission_id: input.submissionId,
      p_request_hash: requestHash,
      p_lease_token: leaseToken,
      p_client_name: input.clientIdentity.name,
      p_client_email: input.clientIdentity.email,
      p_client_phone: input.clientIdentity.phone,
      p_client_company: input.clientIdentity.company,
      p_job_title: input.jobTitle,
      p_items: orderItemsPayload,
      p_draft_expected_version: input.draftExpectedVersion ?? null,
      p_draft_finalization_key: input.draftFinalizationKey ?? null,
      p_draft_moved_files: movedDraftFiles,
      ...(appliedWelcomeBenefitKeys.length > 0
        ? { p_welcome_offer_benefit_keys: appliedWelcomeBenefitKeys }
        : {}),
    };
  const { data: commitData, error: commitError } = await supabase.rpc(
    commitRpcName,
    commitRpcParams,
  );

  let commit = firstRpcRow<OrderSubmissionCommitRow>(commitData);
  if (commitError || !commit) {
    console.error("[orders] atomic commit outcome is ambiguous:", commitError?.message);
    commit = await recoverCommittedSubmission(supabase, input);
    if (!commit) return databaseAmbiguityError();
  }
  if (commit.result_code !== "created" && commit.result_code !== "replayed") {
    await cleanupFinalPaths(supabase, copiedFinalPaths);
    await releaseSubmissionBestEffort(supabase, input, leaseToken, commit.result_code);
    if (commit.result_code === "welcome_offer_conflict") {
      try {
        const currentAvailability = await getWelcomeOfferAvailability(
          input.ownerUserId,
          supabase,
        );
        const currentQuote = calculateServerQuote(
          input.serviceType,
          input.currency,
          input.items,
          currentAvailability,
        );
        return {
          ok: false,
          code: "pricing_changed",
          message:
            "Welcome Offer eligibility changed before the order was committed. Review and confirm the current price.",
          status: 409,
          currentPricingSnapshot: createPricingSnapshot(currentQuote),
        };
      } catch {
        return databaseAmbiguityError();
      }
    }
    return mapCommitFailure(commit.result_code);
  }

  await removeSourcePathsBestEffort(
    supabase,
    finalizedItemFiles.flatMap((slot) => [slot.original, ...slot.references])
      .map((file) => file.sourcePath)
      .filter((path, index, all) => path && all.indexOf(path) === index),
  );

  let emailNotifications = { clientConfirmation: false, adminNotification: false };
  if (commit.result_code === "created") {
    const emailResult = await dispatchOrderEmailOutbox({
      supabase,
      limit: 2,
      orderId: commit.order_id,
    });
    emailNotifications = {
      clientConfirmation: emailResult.clientConfirmationSent,
      adminNotification: emailResult.adminNotificationSent,
    };
  }

  return {
    ok: true,
    orderId: commit.order_id,
    orderNumber: commit.order_number,
    estimatedTotalCents: commit.estimated_total_cents,
    currency: commit.currency as TransactionalCurrency,
    pricingSnapshot: parsePricingSnapshot(commit.pricing_snapshot) ?? pricingSnapshot,
    itemCount: commit.item_count,
    replayed: commit.result_code === "replayed",
    emailNotifications,
    finalizedItemFiles,
  };
}
interface OrderSubmissionClaimRow {
  result_code: string;
  lease_token: string | null;
  reserved_order_id: string | null;
  reserved_order_number: string | null;
  order_id: string | null;
  estimated_total_cents: number;
  currency: string;
  pricing_snapshot: unknown;
}

interface OrderSubmissionCommitRow {
  result_code: string;
  created: boolean;
  order_id: string;
  order_number: string;
  estimated_total_cents: number;
  currency: string;
  pricing_snapshot: unknown;
  item_count: number;
}

function firstRpcRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null;
  return data && typeof data === "object" ? data as T : null;
}

function mapClaimFailure(
  code: string,
  currentPricingSnapshot: PricingSnapshot,
): CreateProductionOrderResult | null {
  switch (code) {
    case "in_progress":
      return orderConflict("in_progress", "This order submission is still processing.");
    case "payload_conflict":
      return orderConflict("payload_conflict", "submissionId was already used for different order details.");
    case "pricing_changed":
      return {
        ok: false,
        code: "pricing_changed",
        message: "Pricing changed before the order was committed. Review and confirm the new price.",
        status: 409,
        currentPricingSnapshot,
      };
    case "not_found":
      return { ok: false, code: "not_found", message: "Order submission was not found.", status: 404 };
    default:
      return null;
  }
}

function mapCommitFailure(code: string): CreateProductionOrderResult {
  if (code === "not_found") {
    return { ok: false, code: "not_found", message: "Order submission was not found.", status: 404 };
  }
  if (code === "payload_conflict") {
    return orderConflict("payload_conflict", "submissionId was already used for different order details.");
  }
  if (code === "draft_conflict") {
    return orderConflict("draft_conflict", "The saved draft changed or is no longer available for conversion.");
  }
  if (code === "lease_conflict") {
    return orderConflict("in_progress", "This order submission is still processing.");
  }
  return databaseAmbiguityError();
}

function orderConflict(code: CreateProductionOrderErrorCode, message: string): CreateProductionOrderResult {
  return { ok: false, code, message, status: 409 };
}

function databaseAmbiguityError(): CreateProductionOrderResult {
  return {
    ok: false,
    code: "database_error",
    message: "Order outcome could not be confirmed. Retry with the same submissionId.",
    status: 500,
  };
}

function committedResultFromClaim(
  claim: OrderSubmissionClaimRow,
  itemCount: number,
): CreateProductionOrderResult {
  const snapshot = parsePricingSnapshot(claim.pricing_snapshot);
  if (!claim.order_id || !claim.reserved_order_number || !snapshot || snapshot.totalCents === null) {
    return databaseAmbiguityError();
  }
  return {
    ok: true,
    orderId: claim.order_id,
    orderNumber: claim.reserved_order_number,
    estimatedTotalCents: snapshot.totalCents,
    currency: snapshot.currency,
    pricingSnapshot: snapshot,
    itemCount,
    replayed: true,
    emailNotifications: { clientConfirmation: false, adminNotification: false },
    finalizedItemFiles: [],
  };
}

async function releaseSubmissionBestEffort(
  supabase: SupabaseClient,
  input: CreateProductionOrderInput,
  leaseToken: string,
  errorCode: string,
): Promise<void> {
  try {
    const { error } = await supabase.rpc("release_order_submission", {
      p_user_id: input.ownerUserId,
      p_submission_id: input.submissionId,
      p_lease_token: leaseToken,
      p_error_code: errorCode,
    });
    if (error) console.error("[orders] claim release failed:", error.message);
  } catch {
    console.error("[orders] claim release threw");
  }
}

async function recoverCommittedSubmission(
  supabase: SupabaseClient,
  input: CreateProductionOrderInput,
): Promise<OrderSubmissionCommitRow | null> {
  const { data, error } = await supabase
    .from("order_submissions")
    .select("status,order_id,reserved_order_number,estimated_total_cents,currency,pricing_snapshot")
    .eq("submission_id", input.submissionId)
    .eq("user_id", input.ownerUserId)
    .maybeSingle();
  if (error || !data || data.status !== "committed" || !data.order_id) return null;
  return {
    result_code: "replayed",
    created: false,
    order_id: String(data.order_id),
    order_number: String(data.reserved_order_number),
    estimated_total_cents: Number(data.estimated_total_cents),
    currency: String(data.currency),
    pricing_snapshot: data.pricing_snapshot,
    item_count: input.items.length,
  };
}

async function removeSourcePathsBestEffort(
  supabase: SupabaseClient,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  try {
    const { error } = await supabase.storage.from(ORDER_FILES_BUCKET).remove(paths);
    if (error) console.error("[orders] committed source cleanup failed:", error.message);
  } catch {
    console.error("[orders] committed source cleanup threw");
  }
}

function calculateServerQuote(
  serviceType: ServiceType,
  currency: TransactionalCurrency,
  items: ValidatedOrderItem[],
  welcomeOfferAvailability?: WelcomeOfferAvailability,
  partnerClient = false,
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
          dedicatedSubService: item.subService,
        })),
      };
      break;
  }
  return calculateOrderQuote(input, { welcomeOfferAvailability, partnerClient });
}

export function getPotentialWelcomeOfferBenefitKey(
  serviceType: ServiceType,
  items: ValidatedOrderItem[],
): WelcomeOfferBenefitKey | null {
  if (serviceType === "virtual-staging") {
    return "virtual-staging-first-image-50";
  }
  if (serviceType !== "photo-editing" || items.length === 0) return null;

  const photoItems = items as PhotoEditItem[];
  if (
    photoItems.every(
      (item) => item.subService === "image-enhancement-single-exposure",
    )
  ) {
    return "image-enhancement-free";
  }
  if (photoItems.every((item) => item.subService === "day-to-dusk")) {
    return "day-to-dusk-free";
  }
  return null;
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
  verifiedIdentities: ReadonlyMap<string, StorageObjectIdentity>;
  referenceId?: string;
  referencePosition?: number;
}): Promise<
  | {
      ok: true;
      file: FinalizedOrderFile;
      createdFinal: boolean;
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

  // Bind the copy to the exact ETag that passed byte-signature verification.
  // A reusable signed upload token cannot swap in a same-size/same-MIME object
  // between verification and finalization without changing this identity.
  const verifiedIdentity = input.verifiedIdentities.get(input.uploaded.path);
  const sourceIdentity = await getStorageObjectIdentity(
    input.supabase,
    input.uploaded.path,
  );
  if (
    !verifiedIdentity ||
    !sourceIdentity ||
    !storageIdentitiesMatch(verifiedIdentity, sourceIdentity) ||
    !storageIdentityMatchesDescriptor(sourceIdentity, input.uploaded)
  ) {
    console.warn("[orders] storage source identity could not be verified:", {
      itemIndex: input.itemIndex,
      kind: input.kind,
    });
    return storagePreparationError();
  }

  if (input.uploaded.path === finalPath) {
    return { ok: true, file: buildFinalizedFile(input, finalPath), createdFinal: false };
  }

  // Storage cannot participate in the PostgreSQL transaction. Always copy so
  // the pending source survives until the DB commit is confirmed.
  const { error } = await input.supabase.storage
    .from(ORDER_FILES_BUCKET)
    .copy(input.uploaded.path, finalPath);
  if (error) {
    const existingIdentity = await getStorageObjectIdentity(
      input.supabase,
      finalPath,
    );
    if (!existingIdentity || !storageIdentitiesMatch(sourceIdentity, existingIdentity)) {
      console.warn("[orders] storage final copy failed:", {
        itemIndex: input.itemIndex,
        kind: input.kind,
        reason: getSafeStorageErrorLabel(error),
      });
      return storagePreparationError();
    }
    return { ok: true, file: buildFinalizedFile(input, finalPath), createdFinal: false };
  }

  const copiedIdentity = await getStorageObjectIdentity(input.supabase, finalPath);
  if (!copiedIdentity || !storageIdentitiesMatch(sourceIdentity, copiedIdentity)) {
    // A direct attempt may have lost its lease during Storage I/O. The shared
    // final path may already belong to the winning attempt, even on this error.
    if (input.mode === "copy") {
      await cleanupFinalPaths(input.supabase, [finalPath]);
    }
    console.warn("[orders] copied final identity did not match its source:", {
      itemIndex: input.itemIndex,
      kind: input.kind,
    });
    return storagePreparationError();
  }

  return {
    ok: true,
    file: buildFinalizedFile(input, finalPath),
    createdFinal: true,
  };
}

function storageIdentityMatchesDescriptor(
  identity: StorageObjectIdentity,
  descriptor: TrustedOrderFileDescriptor,
): boolean {
  return identity.size === descriptor.size &&
    identity.mimeType === descriptor.mimeType.toLowerCase();
}

function storagePreparationError(): {
  ok: false;
  code: "storage_error";
  message: string;
  status: 500;
} {
  return {
    ok: false,
    code: "storage_error",
    message: "Could not prepare uploaded files for the order.",
    status: 500,
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
