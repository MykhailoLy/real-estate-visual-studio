import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceType } from "@/lib/server-validation";
import type { PricingSnapshot, TransactionalCurrency } from "@/lib/pricing/types";
import { parsePricingSnapshot } from "@/lib/pricing/snapshot";
import { sha256Canonical } from "@/lib/orders/order-submission-fingerprint";
import { getDedicatedSubServiceLabel } from "@/lib/dedicated-photo-editing";
import { absoluteUrl } from "@/lib/seo";
import {
  CheckoutEligibilityError,
  getStoredCheckoutPrice,
} from "@/lib/payments/checkout-eligibility";
import { renderClientConfirmation, type ClientConfirmationItem } from "./order-client-confirmation";
import { renderAdminNotification, type AdminOrderItem } from "./order-admin-notification";
import { getAdminAddress, getFromAddress, getResendClient } from "./resend-client";

type DeliveryKind = "client_confirmation" | "admin_notification";
interface ClaimedDelivery {
  delivery_id: string;
  order_id: string;
  delivery_kind: DeliveryKind;
  idempotency_key: string;
  payload_hash: string | null;
}
interface PersistedOrder {
  id: string;
  order_number: string;
  service_type: ServiceType;
  job_title: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_company: string | null;
  item_count: number;
  estimated_total_cents: number;
  currency: TransactionalCurrency;
  pricing_snapshot: unknown;
}
interface PersistedOrderItem {
  item_index: number;
  original_photo_path: string | null;
  reference_image_path: string | null;
  subtotal_cents: number;
  details: Record<string, unknown>;
}

export interface DispatchOrderEmailsResult {
  claimed: number;
  sent: number;
  failed: number;
  unknown: number;
  clientConfirmationSent: boolean;
  adminNotificationSent: boolean;
}

interface DispatchOrderEmailsInput {
  supabase: SupabaseClient;
  limit?: number;
  orderId?: string;
}

/** Drain the durable order email outbox strictly after order commit. */
export async function dispatchOrderEmailOutbox(
  input: DispatchOrderEmailsInput,
): Promise<DispatchOrderEmailsResult> {
  try {
    return await dispatchOrderEmailOutboxUnsafe(input);
  } catch (error) {
    console.error(
      "[order-email-outbox] dispatch threw after order commit:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return emptyDispatchResult();
  }
}

async function dispatchOrderEmailOutboxUnsafe(
  input: DispatchOrderEmailsInput,
): Promise<DispatchOrderEmailsResult> {
  const result = emptyDispatchResult();
  const claimToken = crypto.randomUUID();
  const { data, error } = await input.supabase.rpc(
    "claim_order_email_deliveries",
    {
      p_claim_token: claimToken,
      p_limit: input.limit ?? 10,
      p_order_id: input.orderId ?? null,
    },
  );
  if (error) {
    console.error("[order-email-outbox] claim failed:", error.message);
    return result;
  }

  const deliveries = Array.isArray(data) ? data as ClaimedDelivery[] : [];
  result.claimed = deliveries.length;
  for (const delivery of deliveries) {
    const outcome = await deliverOne(input.supabase, claimToken, delivery);
    result[outcome] += 1;
    if (outcome === "sent" && delivery.delivery_kind === "client_confirmation") {
      result.clientConfirmationSent = true;
    }
    if (outcome === "sent" && delivery.delivery_kind === "admin_notification") {
      result.adminNotificationSent = true;
    }
  }
  return result;
}

function emptyDispatchResult(): DispatchOrderEmailsResult {
  const result = {
    claimed: 0,
    sent: 0,
    failed: 0,
    unknown: 0,
    clientConfirmationSent: false,
    adminNotificationSent: false,
  };
  return result;
}

async function deliverOne(
  supabase: SupabaseClient,
  claimToken: string,
  delivery: ClaimedDelivery,
): Promise<"sent" | "failed" | "unknown"> {
  const payload = await buildPersistedEmailPayload(supabase, delivery);
  if (!payload.ok) {
    await completeDelivery(supabase, delivery, claimToken, "failed", delivery.payload_hash, null, payload.code);
    return "failed";
  }

  const payloadHash = sha256Canonical(payload.value);
  if (delivery.payload_hash && delivery.payload_hash !== payloadHash) {
    await completeDelivery(supabase, delivery, claimToken, "unknown", delivery.payload_hash, null, "payload_hash_mismatch");
    return "unknown";
  }

  const resend = getResendClient();
  if (!resend.ok) {
    await completeDelivery(supabase, delivery, claimToken, "failed", payloadHash, null, "email_not_configured");
    return "failed";
  }

  try {
    const response = await resend.client.emails.send(payload.value, {
      idempotencyKey: delivery.idempotency_key,
    });
    if (response.error) {
      await completeDelivery(supabase, delivery, claimToken, "failed", payloadHash, null, "provider_rejected");
      return "failed";
    }
    await completeDelivery(supabase, delivery, claimToken, "sent", payloadHash, response.data?.id ?? null, null);
    return "sent";
  } catch {
    // Acceptance may have happened before the connection failed. The RPC only
    // reclaims this inside the stored 24-hour idempotency window.
    await completeDelivery(supabase, delivery, claimToken, "unknown", payloadHash, null, "provider_outcome_unknown");
    return "unknown";
  }
}

async function buildPersistedEmailPayload(
  supabase: SupabaseClient,
  delivery: ClaimedDelivery,
): Promise<
  | { ok: true; value: { from: string; to: string; replyTo: string; subject: string; html: string; text: string } }
  | { ok: false; code: string }
> {
  const [{ data: orderData, error: orderError }, { data: itemsData, error: itemsError }] = await Promise.all([
    supabase.from("orders").select(
      "id,order_number,service_type,job_title,client_name,client_email,client_phone,client_company,item_count,estimated_total_cents,currency,pricing_snapshot",
    ).eq("id", delivery.order_id).maybeSingle(),
    supabase.from("order_items").select(
      "item_index,original_photo_path,reference_image_path,subtotal_cents,details",
    ).eq("order_id", delivery.order_id).order("item_index", { ascending: true }),
  ]);
  if (orderError || itemsError || !orderData || !Array.isArray(itemsData)) {
    return { ok: false, code: "persisted_order_unavailable" };
  }

  const order = orderData as PersistedOrder;
  const items = itemsData as PersistedOrderItem[];
  const snapshot = parsePricingSnapshot(order.pricing_snapshot);
  if (!snapshot || items.length !== order.item_count) {
    return { ok: false, code: "persisted_order_invalid" };
  }

  const serviceLabelOverride = getDedicatedSubServiceLabel(items[0]?.details?.sub_service) ?? undefined;
  const from = getFromAddress();
  const admin = getAdminAddress();
  const clientItems: ClientConfirmationItem[] = items.map((item) => ({
    index: item.item_index,
    details: item.details,
    subtotalCents: item.subtotal_cents,
  }));
  const common = {
    orderNumber: order.order_number,
    serviceType: order.service_type,
    serviceLabelOverride,
    jobTitle: order.job_title,
    itemCount: order.item_count,
    estimatedTotalCents: order.estimated_total_cents,
    currency: order.currency,
    pricingSnapshot: snapshot as PricingSnapshot,
    hasFixedCheckoutPrice: hasFixedCheckoutPrice(order),
  };

  if (delivery.delivery_kind === "client_confirmation") {
    const rendered = renderClientConfirmation({
      ...common,
      clientName: order.client_name,
      clientEmail: order.client_email,
      clientOrderUrl: absoluteUrl(`/dashboard/jobs/${order.id}`),
      items: clientItems,
    });
    return { ok: true, value: { from, to: order.client_email, replyTo: admin, ...rendered } };
  }

  const adminItems: AdminOrderItem[] = items.map((item) => {
    const uploaded = readUploadedFileDetails(item.details);
    return {
      index: item.item_index,
      subtotalCents: item.subtotal_cents,
      details: item.details,
      files: {
        originalPath: item.original_photo_path,
        referenceImagePath: item.reference_image_path,
        ...uploaded,
        originalDownloadUrl: null,
        referenceDownloadUrl: null,
      },
    };
  });
  const rendered = renderAdminNotification({
    ...common,
    adminOrderUrl: absoluteUrl(`/admin/orders/${order.id}`),
    client: {
      name: order.client_name,
      email: order.client_email,
      phone: order.client_phone,
      company: order.client_company,
    },
    termsAcceptance: readTermsAcceptance(items[0]?.details),
    portfolioPermission: readPortfolioPermission(items[0]?.details),
    items: adminItems,
  });
  return { ok: true, value: { from, to: admin, replyTo: order.client_email, ...rendered } };
}

function hasFixedCheckoutPrice(order: PersistedOrder): boolean {
  try {
    getStoredCheckoutPrice(order);
    return true;
  } catch (error) {
    if (error instanceof CheckoutEligibilityError) return false;
    throw error;
  }
}

async function completeDelivery(
  supabase: SupabaseClient,
  delivery: ClaimedDelivery,
  claimToken: string,
  status: "sent" | "failed" | "unknown",
  payloadHash: string | null,
  providerMessageId: string | null,
  errorCode: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("complete_order_email_delivery", {
    p_delivery_id: delivery.delivery_id,
    p_claim_token: claimToken,
    p_status: status,
    p_payload_hash: payloadHash,
    p_provider_message_id: providerMessageId,
    p_error_code: errorCode,
  });
  if (error) console.error("[order-email-outbox] completion failed:", error.message);
}

function readUploadedFileDetails(details: Record<string, unknown>) {
  const uploaded = asRecord(details.uploaded_files);
  const original = asRecord(uploaded.original);
  const reference = asRecord(uploaded.reference);
  return {
    originalFilename: stringOrNull(original.original_filename),
    referenceFilename: stringOrNull(reference.original_filename),
    originalSizeBytes: numberOrNull(original.size_bytes),
    referenceSizeBytes: numberOrNull(reference.size_bytes),
  };
}
function readTermsAcceptance(details: Record<string, unknown> | undefined) {
  const terms = asRecord(details?.terms_acceptance);
  return {
    accepted: terms.accepted === true,
    version: stringOrNull(terms.version) ?? "unspecified",
    accepted_at: stringOrNull(terms.accepted_at) ?? "",
  };
}
function readPortfolioPermission(details: Record<string, unknown> | undefined) {
  return { allowed: asRecord(details?.portfolio_permission).allowed === true };
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
