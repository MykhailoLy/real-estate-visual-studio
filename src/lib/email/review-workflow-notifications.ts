import "server-only";
import { createServerClient } from "@/lib/supabase";
import {
  getAdminAddress,
  getFromAddress,
  getResendClient,
} from "./resend-client";
import { escapeHtml } from "./format";

export type ReviewWorkflowEvent =
  | "client_rework_requested"
  | "client_approved"
  | "admin_replacement_ready";

export interface ReviewWorkflowEmailResult {
  sent: boolean;
  error?: string;
}

export interface ReviewWorkflowEmailArgs {
  event: ReviewWorkflowEvent;
  reviewId: string;
  replacementDeliverableId?: string;
}

interface ReviewContext {
  id: string;
  deliverable_id: string;
  order_id: string;
  order_number: string;
  item_index: number | null;
  client_email: string;
  status: string;
  comment: string | null;
  replacement_deliverable_id: string | null;
}

interface DeliverableContext {
  id: string;
  filename: string;
}

interface LoadedContext {
  review: ReviewContext;
  originalDeliverable: DeliverableContext | null;
  replacementDeliverable: DeliverableContext | null;
}

interface RenderedEmail {
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendReviewWorkflowEmail(
  args: ReviewWorkflowEmailArgs
): Promise<ReviewWorkflowEmailResult> {
  try {
    const resendCheck = getResendClient();
    if (!resendCheck.ok) {
      console.warn(
        `[email/review-workflow] Resend not configured; skipping ${args.event} for review ${args.reviewId}: ${resendCheck.reason}`
      );
      return { sent: false, error: resendCheck.reason };
    }

    const context = await loadReviewContext(args.reviewId, args.replacementDeliverableId);
    if (!context) {
      const error = "Review context not found.";
      console.warn(`[email/review-workflow] ${error} review=${args.reviewId}`);
      return { sent: false, error };
    }

    const email = renderReviewWorkflowEmail(args.event, context);
    if (!email) {
      const error = `Unsupported email event: ${args.event}`;
      console.warn(`[email/review-workflow] ${error}`);
      return { sent: false, error };
    }

    const response = await resendCheck.client.emails.send({
      from: getFromAddress(),
      to: email.to,
      replyTo: email.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    const sendResult = response as { error?: { message?: string } | null };
    if (sendResult?.error) {
      const error = sendResult.error.message || "Resend reported an error.";
      console.error(
        `[email/review-workflow] Send failed for ${args.event} review=${args.reviewId}: ${error}`
      );
      return { sent: false, error };
    }

    return { sent: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unhandled email error.";
    console.error(
      `[email/review-workflow] Unhandled failure for ${args.event} review=${args.reviewId}:`,
      err
    );
    return { sent: false, error };
  }
}

async function loadReviewContext(
  reviewId: string,
  replacementDeliverableId?: string
): Promise<LoadedContext | null> {
  const supabase = createServerClient();

  const { data: reviewData, error: reviewError } = await supabase
    .from("deliverable_reviews")
    .select(
      "id, deliverable_id, order_id, order_number, item_index, " +
      "client_email, status, comment, replacement_deliverable_id"
    )
    .eq("id", reviewId)
    .maybeSingle();

  if (reviewError || !reviewData) {
    if (reviewError) {
      console.error("[email/review-workflow] Review lookup error:", reviewError.message);
    }
    return null;
  }

  const review = reviewData as unknown as ReviewContext;
  const replacementId = replacementDeliverableId ?? review.replacement_deliverable_id ?? null;
  const ids = [review.deliverable_id, replacementId].filter((id): id is string => Boolean(id));

  const deliverables = new Map<string, DeliverableContext>();
  if (ids.length > 0) {
    const { data: deliverableData, error: deliverableError } = await supabase
      .from("order_deliverables")
      .select("id, filename")
      .in("id", ids);

    if (deliverableError) {
      console.warn(
        "[email/review-workflow] Deliverable filename lookup failed:",
        deliverableError.message
      );
    } else {
      for (const row of (deliverableData ?? []) as unknown as DeliverableContext[]) {
        deliverables.set(row.id, row);
      }
    }
  }

  return {
    review,
    originalDeliverable: deliverables.get(review.deliverable_id) ?? null,
    replacementDeliverable: replacementId ? deliverables.get(replacementId) ?? null : null,
  };
}

function renderReviewWorkflowEmail(
  event: ReviewWorkflowEvent,
  context: LoadedContext
): RenderedEmail | null {
  const adminEmail = getAdminAddress();
  const item = itemLabel(context.review.item_index);

  if (event === "client_rework_requested") {
    const subject = `Rework requested: ${context.review.order_number} - ${item}`;
    const adminReworkUrl = absoluteUrl("/admin/rework");
    const adminOrderUrl = absoluteUrl(
      `/admin/orders/${context.review.order_id}?reviewId=${context.review.id}`
    );

    return renderEmail({
      to: adminEmail,
      replyTo: context.review.client_email,
      subject,
      heading: "Rework requested",
      intro: "A client requested changes to a delivered file.",
      rows: [
        ["Order", context.review.order_number],
        ["Item", item],
        ["File", context.originalDeliverable?.filename ?? "Unknown file"],
        ["Client", context.review.client_email],
        ["Comment", context.review.comment ?? ""],
        ["Rework queue", adminReworkUrl],
        ["Upload replacement", adminOrderUrl],
      ],
    });
  }

  if (event === "client_approved") {
    const subject = `Deliverable approved: ${context.review.order_number} - ${item}`;
    const adminOrderUrl = absoluteUrl(`/admin/orders/${context.review.order_id}`);

    return renderEmail({
      to: adminEmail,
      replyTo: context.review.client_email,
      subject,
      heading: "Deliverable approved",
      intro: "A client approved a delivered file.",
      rows: [
        ["Order", context.review.order_number],
        ["Item", item],
        ["File", context.originalDeliverable?.filename ?? "Unknown file"],
        ["Client", context.review.client_email],
        ["Admin order", adminOrderUrl],
      ],
    });
  }

  if (event === "admin_replacement_ready") {
    const subject = `New version ready: ${context.review.order_number} - ${item}`;
    const dashboardUrl = absoluteUrl(`/dashboard/jobs/${context.review.order_id}`);

    return renderEmail({
      to: context.review.client_email,
      replyTo: adminEmail,
      subject,
      heading: "New version ready",
      intro: "Your revised file is ready to review. Please download the new version, then approve it or request another rework if needed.",
      rows: [
        ["Order", context.review.order_number],
        ["Item", item],
        ["New file", context.replacementDeliverable?.filename ?? "Replacement file"],
        ["Previous file", context.originalDeliverable?.filename ?? ""],
        ["Review in dashboard", dashboardUrl],
      ],
    });
  }

  return null;
}

function renderEmail(input: {
  to: string;
  replyTo: string;
  subject: string;
  heading: string;
  intro: string;
  rows: Array<[label: string, value: string]>;
}): RenderedEmail {
  const visibleRows = input.rows.filter(([, value]) => value.trim().length > 0);
  const text = [
    input.heading,
    "",
    input.intro,
    "",
    ...visibleRows.map(([label, value]) => `${label}: ${value}`),
    "",
    "- PicchuSpot",
  ].join("\n");

  const rowHtml = visibleRows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:5px 12px 5px 0;color:#718096;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:5px 0;color:#1a202c;">${formatHtmlValue(value)}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a202c;">
    <div style="max-width:600px;margin:0 auto;padding:24px;">
      <div style="margin-bottom:20px;">
        <div style="font-size:18px;font-weight:700;color:#1a365d;">PicchuSpot</div>
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#a0aec0;margin-top:2px;">Real Estate Visuals</div>
      </div>
      <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#1a365d;">${escapeHtml(input.heading)}</h1>
      <p style="font-size:15px;line-height:1.6;color:#4a5568;margin:0 0 20px;">${escapeHtml(input.intro)}</p>
      <table style="width:100%;font-size:14px;line-height:1.5;border-collapse:collapse;margin-bottom:24px;">
        <tbody>${rowHtml}</tbody>
      </table>
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="font-size:12px;line-height:1.6;color:#a0aec0;margin:0;">PicchuSpot</p>
    </div>
  </body>
</html>`;

  return {
    to: input.to,
    replyTo: input.replyTo,
    subject: input.subject,
    html,
    text,
  };
}

function itemLabel(itemIndex: number | null): string {
  return itemIndex === null ? "Order-level file" : `Image ${itemIndex + 1}`;
}

function absoluteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://picchuspot.com";
  return `${base.replace(/\/$/, "")}${path}`;
}

function formatHtmlValue(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    const safe = escapeHtml(value);
    return `<a href="${safe}" style="color:#2c5282;">${safe}</a>`;
  }
  return escapeHtml(value).replace(/\r?\n/g, "<br/>");
}
