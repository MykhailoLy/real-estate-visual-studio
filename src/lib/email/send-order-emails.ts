import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceType } from "@/lib/server-validation";
import { ORDER_FILES_BUCKET } from "@/lib/upload-config";
import {
  getResendClient,
  getFromAddress,
  getAdminAddress,
} from "./resend-client";
import {
  renderClientConfirmation,
  type ClientConfirmationItem,
} from "./order-client-confirmation";
import {
  renderAdminNotification,
  type AdminOrderItem,
} from "./order-admin-notification";
import { getDedicatedSubServiceLabel } from "@/lib/dedicated-photo-editing";

// ============================================================
// SEND ORDER EMAILS
//
// Called from /api/order *after* the order and order_items rows
// have been saved successfully. Sends:
//   1. Client confirmation -> contact.email
//   2. Admin notification  -> ADMIN_EMAIL
//
// IMPORTANT: This function NEVER throws. The order is already
// persisted; email is best-effort. Every failure mode is logged
// but otherwise swallowed so the API can still return success.
// ============================================================

/** How long admin signed download URLs are valid for. 7 days. */
const ADMIN_DOWNLOAD_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

interface SendOrderEmailsArgs {
  supabase: SupabaseClient;
  orderNumber: string;
  serviceType: ServiceType;
  /** Order-level Job Title (validated + persisted). Shown in both emails. */
  jobTitle: string;
  client: {
    name: string;
    email: string;
    phone: string;
    company?: string | null;
  };
  itemCount: number;
  estimatedTotalCents: number;
  termsAcceptance: {
    accepted: boolean;
    version: string;
    accepted_at: string;
  };
  portfolioPermission: {
    allowed: boolean;
  };
  /**
   * One entry per order item, in display order. `details` is the same
   * snake_case object that was just written to order_items.details, so
   * the email helpers see exactly what was persisted.
   */
  items: Array<{
    index: number;
    subtotalCents: number;
    details: Record<string, unknown>;
    files: {
      originalPath: string | null;
      referenceImagePath: string | null;
      originalFilename: string | null;
      referenceFilename: string | null;
      originalSizeBytes: number | null;
      referenceSizeBytes: number | null;
    };
  }>;
}

export interface SendOrderEmailsResult {
  client: { sent: boolean; error?: string };
  admin: { sent: boolean; error?: string };
}

export async function sendOrderEmails(
  args: SendOrderEmailsArgs
): Promise<SendOrderEmailsResult> {
  const result: SendOrderEmailsResult = {
    client: { sent: false },
    admin: { sent: false },
  };

  try {
    const clientCheck = getResendClient();
    if (!clientCheck.ok) {
      console.warn(
        `[email] Resend not configured; skipping order ${args.orderNumber} emails: ${clientCheck.reason}`
      );
      result.client.error = clientCheck.reason;
      result.admin.error = clientCheck.reason;
      return result;
    }
    const resend = clientCheck.client;
    const from = getFromAddress();
    const adminTo = getAdminAddress();

    // 1. Build signed download URLs for the admin email.
    //    Done in parallel; failures degrade to "no link, just path".
    const adminItems: AdminOrderItem[] = await Promise.all(
      args.items.map(async (item) => {
        const [originalUrl, referenceUrl] = await Promise.all([
          createSignedUrlSafe(args.supabase, item.files.originalPath),
          createSignedUrlSafe(args.supabase, item.files.referenceImagePath),
        ]);
        return {
          index: item.index,
          subtotalCents: item.subtotalCents,
          details: item.details,
          files: {
            originalPath: item.files.originalPath,
            referenceImagePath: item.files.referenceImagePath,
            originalFilename: item.files.originalFilename,
            referenceFilename: item.files.referenceFilename,
            originalSizeBytes: item.files.originalSizeBytes,
            referenceSizeBytes: item.files.referenceSizeBytes,
            originalDownloadUrl: originalUrl,
            referenceDownloadUrl: referenceUrl,
          },
        };
      })
    );

    // 2. Build payloads for both templates.
    // Dedicated photo-editing orders carry sub_service on the first item;
    // when present, both emails show the dedicated service name.
    const firstSub = args.items[0]?.details?.sub_service;
    const serviceLabelOverride =
      getDedicatedSubServiceLabel(firstSub) ?? undefined;

    const clientItems: ClientConfirmationItem[] = args.items.map((item) => ({
      index: item.index,
      details: item.details,
      subtotalCents: item.subtotalCents,
    }));

    const clientEmail = renderClientConfirmation({
      orderNumber: args.orderNumber,
      serviceType: args.serviceType,
      serviceLabelOverride,
      jobTitle: args.jobTitle,
      clientName: args.client.name,
      clientEmail: args.client.email,
      itemCount: args.itemCount,
      estimatedTotalCents: args.estimatedTotalCents,
      items: clientItems,
    });

    const adminEmail = renderAdminNotification({
      orderNumber: args.orderNumber,
      serviceType: args.serviceType,
      serviceLabelOverride,
      jobTitle: args.jobTitle,
      client: args.client,
      itemCount: args.itemCount,
      estimatedTotalCents: args.estimatedTotalCents,
      termsAcceptance: args.termsAcceptance,
      portfolioPermission: args.portfolioPermission,
      items: adminItems,
    });

    // 3. Send both emails in parallel. Each is independently
    //    `allSettled`-ed so one failure does not affect the other.
    const [clientSend, adminSend] = await Promise.allSettled([
      resend.emails.send({
        from,
        to: args.client.email,
        replyTo: adminTo,
        subject: clientEmail.subject,
        html: clientEmail.html,
        text: clientEmail.text,
      }),
      resend.emails.send({
        from,
        to: adminTo,
        replyTo: args.client.email,
        subject: adminEmail.subject,
        html: adminEmail.html,
        text: adminEmail.text,
      }),
    ]);

    if (clientSend.status === "fulfilled") {
      const sendResult = clientSend.value as { error?: { message?: string } | null };
      if (sendResult?.error) {
        result.client.error = sendResult.error.message || "Resend reported an error";
        console.error(
          `[email] Client confirmation failed for ${args.orderNumber}: ${result.client.error}`
        );
      } else {
        result.client.sent = true;
      }
    } else {
      result.client.error =
        clientSend.reason instanceof Error
          ? clientSend.reason.message
          : "Unknown send error";
      console.error(
        `[email] Client confirmation threw for ${args.orderNumber}: ${result.client.error}`
      );
    }

    if (adminSend.status === "fulfilled") {
      const sendResult = adminSend.value as { error?: { message?: string } | null };
      if (sendResult?.error) {
        result.admin.error = sendResult.error.message || "Resend reported an error";
        console.error(
          `[email] Admin notification failed for ${args.orderNumber}: ${result.admin.error}`
        );
      } else {
        result.admin.sent = true;
      }
    } else {
      result.admin.error =
        adminSend.reason instanceof Error
          ? adminSend.reason.message
          : "Unknown send error";
      console.error(
        `[email] Admin notification threw for ${args.orderNumber}: ${result.admin.error}`
      );
    }
  } catch (err) {
    // Final guard so a programming error in this module can't take
    // down a successful order submission.
    console.error(
      `[email] Unhandled error sending emails for order ${args.orderNumber}:`,
      err
    );
    if (!result.client.error) result.client.error = "Unhandled email error";
    if (!result.admin.error) result.admin.error = "Unhandled email error";
  }

  return result;
}

/**
 * Wrap createSignedUrl so a single failed file doesn't break the
 * email. Returns null on any failure, which the templates handle by
 * showing just the path.
 */
async function createSignedUrlSafe(
  supabase: SupabaseClient,
  path: string | null
): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .createSignedUrl(path, ADMIN_DOWNLOAD_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      console.warn(
        `[email] createSignedUrl failed for ${path}: ${error?.message ?? "no url returned"}`
      );
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.warn(`[email] createSignedUrl threw for ${path}:`, err);
    return null;
  }
}
