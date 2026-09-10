import type { PricingSnapshot, TransactionalCurrency } from "@/lib/pricing/types";
import type { ServiceType } from "@/lib/server-validation";
import { absoluteUrl } from "@/lib/seo";
import { escapeHtml, formatCents, serviceLabel } from "./format";

// ============================================================
// CLIENT ORDER CONFIRMATION EMAIL
// Sent to the client after the order has been saved successfully.
// Image-specific instructions stay in Order Detail so this email remains
// the same compact length regardless of the number of submitted items.
// ============================================================

export interface ClientConfirmationItem {
  index: number;
  details: Record<string, unknown>;
  subtotalCents: number;
}

export interface ClientConfirmationInput {
  orderNumber: string;
  serviceType: ServiceType;
  /** Optional dedicated label (e.g. "Image Enhancement") overriding the broad service label. */
  serviceLabelOverride?: string;
  /** Order-level Job Title shown prominently in the body. */
  jobTitle?: string;
  clientName: string;
  clientEmail: string;
  clientOrderUrl?: string;
  itemCount: number;
  estimatedTotalCents: number;
  currency: TransactionalCurrency;
  pricingSnapshot: PricingSnapshot;
  hasFixedCheckoutPrice: boolean;
  noPaymentRequired?: boolean;
  earlyPerformanceRequest: {
    requested: boolean;
  };
  items: ClientConfirmationItem[];
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const SUPPORT_EMAIL = "hello@picchuspot.com";
const SERVICES = [
  ["Virtual Staging", "/pricing/virtual-staging"],
  ["Virtual Renovation", "/pricing/virtual-renovation"],
  ["Photo Editing", "/pricing/photo-editing"],
  ["Floor Plans", "/pricing/floor-plans"],
] as const;

export function renderClientConfirmation(
  input: ClientConfirmationInput,
): RenderedEmail {
  const service = input.serviceLabelOverride ?? serviceLabel(input.serviceType);
  const jobTitle = input.jobTitle?.trim() ?? "";
  const total = formatCents(input.estimatedTotalCents, input.currency);
  const noPaymentRequired = input.noPaymentRequired === true;
  const subject = `Order ${input.orderNumber} Received — PicchuSpot`;
  const confirmation =
    "We’ve received your order, files, and instructions.";
  const detailGuidance =
    "All image-specific instructions, styles, and references are saved with your order and can be reviewed anytime from your dashboard.";
  const earlyStartConfirmation =
    "You expressly asked PicchuSpot to begin work as soon as any required payment is confirmed, or after order confirmation where no payment is due, including during any applicable 14-day withdrawal period. Where consumer withdrawal rights apply, you acknowledged that if you withdraw after work has started, you may have to pay a proportionate amount for the service already provided, and that you will lose the right of withdrawal once the service has been fully performed.";
  const pricingTextLines = input.hasFixedCheckoutPrice
    ? [
        `Final total: ${total} ${input.currency}`,
        ...(noPaymentRequired ? ["No payment required."] : []),
        "Any applicable tax is included in this amount.",
      ]
    : [
        "Pricing: Manual review required.",
        "We’ll review the submitted files and instructions before confirming the commercial next step.",
      ];
  const nextStepsText = noPaymentRequired
    ? [
        "  1. We review your submitted order, files, and instructions.",
        "  2. No payment is required; after confirmation, your order can enter production.",
        "  3. Track the order and download completed files from the order page.",
      ]
    : input.hasFixedCheckoutPrice
      ? [
          "  1. Review the submitted order and complete secure payment from the order page.",
          "  2. Your order can enter production after payment has been verified.",
          "  3. Track the order and download completed files from the order page.",
        ]
      : [
          "  1. We review your submitted order, files, and instructions.",
          "  2. We contact you to confirm the scope, price, and commercial next step.",
          "  3. Work begins after the agreed commercial arrangements are complete; track progress from the order page.",
        ];

  const text = [
    `Hi ${input.clientName || "there"},`,
    "",
    confirmation,
    "",
    "Order summary",
    `Order number: ${input.orderNumber}`,
    `Service: ${service}`,
    ...(jobTitle ? [`Job title: ${jobTitle}`] : []),
    `Items: ${input.itemCount}`,
    ...pricingTextLines,
    "",
    detailGuidance,
    ...(input.clientOrderUrl ? ["", `View order: ${input.clientOrderUrl}`] : []),
    "",
    ...(input.earlyPerformanceRequest.requested
      ? ["Start of service", earlyStartConfirmation, ""]
      : []),
    "What happens next",
    ...nextStepsText,
    "",
    `Questions? Reply to this email or write to ${SUPPORT_EMAIL}.`,
    "",
    "Kind regards,",
    "PicchuSpot",
    "Real Estate Visuals",
    "",
    "More from PicchuSpot",
    ...SERVICES.map(([label, path]) => `${label}: ${absoluteUrl(path)}`),
    `picchuspot.com: ${absoluteUrl("/")}`,
    `Contact: ${SUPPORT_EMAIL}`,
  ].join("\n");

  const pricingRowsHtml = input.hasFixedCheckoutPrice
    ? `
          <tr><td style="padding:5px 12px 5px 0;color:#5a656d;">Final total</td><td style="padding:5px 0;font-weight:bold;">${escapeHtml(total)} ${escapeHtml(input.currency)}</td></tr>
          ${noPaymentRequired ? '<tr><td colspan="2" style="padding:7px 0 0;color:#256b45;font-weight:bold;">No payment required</td></tr>' : ""}
          <tr><td colspan="2" style="padding:7px 0 0;color:#5a656d;font-size:12px;">Any applicable tax is included in this amount.</td></tr>`
    : `
          <tr><td style="padding:5px 12px 5px 0;color:#5a656d;">Pricing</td><td style="padding:5px 0;font-weight:bold;">Manual review required</td></tr>
          <tr><td colspan="2" style="padding:7px 0 0;color:#5a656d;font-size:12px;">We’ll review the submitted files and instructions before confirming the commercial next step.</td></tr>`;
  const nextStepsHtml = nextStepsText
    .map(
      (step) =>
        `<li style="margin:0 0 8px;">${escapeHtml(step.replace(/^\s*\d+\.\s*/, ""))}</li>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4efe8;color:#071a2b;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:collapse;background:#ffffff;border:1px solid #ded3c6;">
        <tr><td align="center" style="padding:20px 24px 12px;background:#ffffff;">
          <img src="${escapeHtml(absoluteUrl("/brand/picchuspot-logo-800.png"))}" width="112" height="84" alt="PicchuSpot" style="display:block;border:0;width:112px;height:84px;margin:0 auto;">
        </td></tr>
        <tr><td align="center" style="padding:0 0 24px;">
          <img src="${escapeHtml(absoluteUrl("/brand/picchuspot-email-before-after-1200x450.jpg"))}" width="560" alt="Before and after virtual staging of a bright living room" style="display:block;border:0;width:100%;max-width:560px;height:auto;">
        </td></tr>
        <tr><td style="padding:0 24px 24px;">
          <h1 style="margin:0 0 18px;font-size:25px;line-height:1.25;color:#071a2b;">Order ${escapeHtml(input.orderNumber)} received</h1>
          <p style="margin:0 0 10px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(input.clientName || "there")},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${confirmation}</p>

          <h2 style="margin:0 0 10px;font-size:16px;line-height:1.4;color:#071a2b;">Order summary</h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:0 0 14px;padding:0;font-size:14px;line-height:1.55;color:#071a2b;">
            <tbody>
              <tr><td style="padding:5px 12px 5px 0;color:#5a656d;">Order number</td><td style="padding:5px 0;font-weight:bold;">${escapeHtml(input.orderNumber)}</td></tr>
              <tr><td style="padding:5px 12px 5px 0;color:#5a656d;">Service</td><td style="padding:5px 0;">${escapeHtml(service)}</td></tr>
              ${jobTitle ? `<tr><td style="padding:5px 12px 5px 0;color:#5a656d;">Job title</td><td style="padding:5px 0;">${escapeHtml(jobTitle)}</td></tr>` : ""}
              <tr><td style="padding:5px 12px 5px 0;color:#5a656d;">Items</td><td style="padding:5px 0;">${input.itemCount}</td></tr>
              ${pricingRowsHtml}
            </tbody>
          </table>

          <p style="margin:0 0 20px;font-size:13px;line-height:1.65;color:#5a656d;">${detailGuidance}</p>
          ${
            input.clientOrderUrl
              ? `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 24px;">
            <tr><td bgcolor="#c7a94e" style="border-radius:4px;text-align:center;">
              <a href="${escapeHtml(input.clientOrderUrl)}" style="display:inline-block;padding:14px 20px;border:1px solid #c7a94e;border-radius:4px;background:#c7a94e;color:#071a2b;font-size:15px;font-weight:bold;line-height:1.4;text-decoration:none;">View order</a>
            </td></tr>
          </table>`
              : ""
          }

          ${
            input.earlyPerformanceRequest.requested
              ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#f7f7f6;border:1px solid #ded3c6;">
            <tr><td style="padding:12px 14px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:bold;line-height:1.4;color:#5a656d;">Start of service</p>
              <p style="margin:0;font-size:12px;line-height:1.65;color:#5a656d;">${escapeHtml(earlyStartConfirmation)}</p>
            </td></tr>
          </table>`
              : ""
          }

          <h2 style="margin:0 0 8px;font-size:16px;line-height:1.4;color:#071a2b;">What happens next</h2>
          <ol style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.6;color:#071a2b;">${nextStepsHtml}</ol>
          <p style="margin:0 0 20px;font-size:13px;line-height:1.7;color:#5a656d;">Questions? Reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#071a2b;text-decoration:underline;">${SUPPORT_EMAIL}</a>.</p>
          <p style="margin:0;font-size:14px;line-height:1.6;">Kind regards,<br>PicchuSpot</p>
        </td></tr>
        <tr><td align="center" bgcolor="#071a2b" style="padding:20px 18px 18px;border-top:1px solid #ded3c6;background:#071a2b;text-align:center;">
          <img src="${escapeHtml(absoluteUrl("/brand/picchuspot-wordmark-dark-email.png"))}" width="125" alt="PicchuSpot" style="display:block;border:0;width:125px;height:auto;margin:0 auto 12px;">
          <p style="margin:0 0 4px;font-size:12px;line-height:1.6;color:#ded3c6;">More from PicchuSpot</p>
          <p style="margin:0;font-size:12px;line-height:2;">${SERVICES.map(([label, path]) => `<a href="${escapeHtml(absoluteUrl(path))}" style="display:inline-block;margin:0 6px;color:#f4efe8;text-decoration:underline;">${label}</a>`).join(" ")}</p>
          <p style="margin:10px 0 0;font-size:12px;line-height:2;">
            <a href="${escapeHtml(absoluteUrl("/"))}" style="display:inline-block;margin:0 6px;color:#f4efe8;text-decoration:underline;">${escapeHtml(new URL(absoluteUrl("/")).host)}</a>
            <a href="mailto:${SUPPORT_EMAIL}" style="display:inline-block;margin:0 6px;color:#f4efe8;text-decoration:underline;">${SUPPORT_EMAIL}</a>
          </p>
          <p style="margin:10px 0 0;font-size:11px;line-height:1.6;color:#ded3c6;">PicchuSpot · Real Estate Visuals</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
