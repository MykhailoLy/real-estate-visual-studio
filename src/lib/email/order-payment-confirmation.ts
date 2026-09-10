import type { ServiceType } from "@/lib/server-validation";
import type { TransactionalCurrency } from "@/lib/pricing/types";
import { absoluteUrl } from "@/lib/seo";
import { escapeHtml, formatCents, serviceLabel } from "./format";

export interface PaymentConfirmationInput {
  orderNumber: string;
  serviceType: ServiceType;
  serviceLabelOverride?: string;
  jobTitle?: string;
  clientName: string;
  clientOrderUrl?: string;
  currency: TransactionalCurrency;
  totalCents: number;
  taxCents: number;
}

export interface RenderedPaymentConfirmation {
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

export function renderPaymentConfirmation(
  input: PaymentConfirmationInput,
): RenderedPaymentConfirmation {
  const service = input.serviceLabelOverride ?? serviceLabel(input.serviceType);
  const jobTitle = input.jobTitle?.trim() ?? "";
  const total = formatCents(input.totalCents, input.currency);
  const tax = formatCents(input.taxCents, input.currency);
  const subject = `Payment confirmed for order ${input.orderNumber} — PicchuSpot`;
  const nextStep =
    "Our team will review and confirm your order before it enters production.";
  const taxText = input.taxCents > 0
    ? [`Tax included: ${tax} ${input.currency}`]
    : [];

  const text = [
    `Hi ${input.clientName || "there"},`,
    "",
    `We’ve received your payment for order ${input.orderNumber}.`,
    "",
    "Payment summary",
    `Order number: ${input.orderNumber}`,
    `Service: ${service}`,
    ...(jobTitle ? [`Job title: ${jobTitle}`] : []),
    `Amount paid: ${total} ${input.currency}`,
    ...taxText,
    ...(input.clientOrderUrl ? [`View order: ${input.clientOrderUrl}`] : []),
    "",
    nextStep,
    "",
    `Questions? Reply to this email or write to ${SUPPORT_EMAIL}.`,
    "",
    "Kind regards,",
    "PicchuSpot",
  ].join("\n");

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
          <h1 style="margin:0 0 18px;font-size:25px;line-height:1.25;color:#071a2b;">Payment confirmed</h1>
          <p style="margin:0 0 10px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(input.clientName || "there")},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">We’ve received your payment for order ${escapeHtml(input.orderNumber)}.</p>

          <h2 style="margin:0 0 10px;font-size:16px;line-height:1.4;color:#071a2b;">Payment summary</h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;padding:0;font-size:14px;line-height:1.55;color:#071a2b;">
            <tbody>
              <tr><td style="padding:5px 12px 5px 0;color:#5a656d;">Order number</td><td style="padding:5px 0;font-weight:bold;">${escapeHtml(input.orderNumber)}</td></tr>
              <tr><td style="padding:5px 12px 5px 0;color:#5a656d;">Service</td><td style="padding:5px 0;">${escapeHtml(service)}</td></tr>
              ${jobTitle ? `<tr><td style="padding:5px 12px 5px 0;color:#5a656d;">Job title</td><td style="padding:5px 0;">${escapeHtml(jobTitle)}</td></tr>` : ""}
              <tr><td style="padding:5px 12px 5px 0;color:#5a656d;">Amount paid</td><td style="padding:5px 0;font-weight:bold;">${escapeHtml(total)} ${escapeHtml(input.currency)}</td></tr>
              ${input.taxCents > 0 ? `<tr><td style="padding:5px 12px 5px 0;color:#5a656d;">Tax included</td><td style="padding:5px 0;">${escapeHtml(tax)} ${escapeHtml(input.currency)}</td></tr>` : ""}
            </tbody>
          </table>

          ${input.clientOrderUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 24px;">
            <tr><td bgcolor="#c7a94e" style="border-radius:4px;text-align:center;">
              <a href="${escapeHtml(input.clientOrderUrl)}" style="display:inline-block;padding:14px 20px;border:1px solid #c7a94e;border-radius:4px;background:#c7a94e;color:#071a2b;font-size:15px;font-weight:bold;line-height:1.4;text-decoration:none;">View order</a>
            </td></tr>
          </table>` : ""}

          <p style="margin:0 0 20px;font-size:13px;line-height:1.7;color:#5a656d;">${escapeHtml(nextStep)}</p>
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
