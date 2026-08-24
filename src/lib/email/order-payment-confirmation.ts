import type { ServiceType } from "@/lib/server-validation";
import type { TransactionalCurrency } from "@/lib/pricing/types";
import { escapeHtml, formatCents, serviceLabel } from "./format";

export interface PaymentConfirmationInput {
  orderNumber: string;
  serviceType: ServiceType;
  serviceLabelOverride?: string;
  jobTitle?: string;
  clientName: string;
  clientOrderUrl?: string;
  currency: TransactionalCurrency;
  totalCents: number | null;
  taxCents: number;
}

export interface RenderedPaymentConfirmation {
  subject: string;
  html: string;
  text: string;
}

const SUPPORT_EMAIL = "hello@picchuspot.com";

export function renderPaymentConfirmation(
  input: PaymentConfirmationInput,
): RenderedPaymentConfirmation {
  const service = input.serviceLabelOverride ?? serviceLabel(input.serviceType);
  const jobTitle = input.jobTitle?.trim() ?? "";
  const total = formatCents(input.totalCents, input.currency);
  const tax = formatCents(input.taxCents, input.currency);
  const subject = `Payment confirmed for order ${input.orderNumber} — PicchuSpot`;
  const taxText = input.taxCents > 0
    ? [`Tax included: ${tax} ${input.currency}`]
    : [];

  const text = [
    `Hi ${input.clientName || "there"},`,
    "",
    `We’ve confirmed your payment for order ${input.orderNumber}.`,
    "",
    `Order number: ${input.orderNumber}`,
    `Service: ${service}`,
    ...(jobTitle ? [`Job title: ${jobTitle}`] : []),
    `Amount paid: ${total} ${input.currency}`,
    ...taxText,
    ...(input.clientOrderUrl ? [`View order: ${input.clientOrderUrl}`] : []),
    "",
    "Your order is ready for our team to review before production begins.",
    "",
    `Questions? Reply to this email or write to ${SUPPORT_EMAIL}.`,
    "",
    "— PicchuSpot",
    "Real Estate Visuals",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a202c;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="margin-bottom:24px;">
        <div style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#1a365d;">PicchuSpot</div>
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#a0aec0;margin-top:2px;">Real Estate Visuals</div>
      </div>

      <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.01em;margin:0 0 8px;color:#1a365d;">
        Payment confirmed
      </h1>
      <p style="font-size:15px;line-height:1.6;color:#4a5568;margin:0 0 24px;">
        Hi ${escapeHtml(input.clientName || "there")} — we’ve confirmed your payment for order ${escapeHtml(input.orderNumber)}.
      </p>

      <table style="width:100%;font-size:14px;line-height:1.6;color:#1a202c;border-collapse:collapse;margin-bottom:24px;">
        <tbody>
          <tr><td style="padding:4px 12px 4px 0;color:#718096;">Order number</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(input.orderNumber)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#718096;">Service</td><td style="padding:4px 0;">${escapeHtml(service)}</td></tr>
          ${jobTitle ? `<tr><td style="padding:4px 12px 4px 0;color:#718096;">Job title</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(jobTitle)}</td></tr>` : ""}
          <tr><td style="padding:4px 12px 4px 0;color:#718096;">Amount paid</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(total)} ${input.currency}</td></tr>
          ${input.taxCents > 0 ? `<tr><td style="padding:4px 12px 4px 0;color:#718096;">Tax included</td><td style="padding:4px 0;">${escapeHtml(tax)} ${input.currency}</td></tr>` : ""}
        </tbody>
      </table>

      <p style="font-size:14px;line-height:1.6;color:#4a5568;margin:0 0 24px;">
        Your order is ready for our team to review before production begins.
      </p>

      ${input.clientOrderUrl ? `<p style="margin:0 0 24px;"><a href="${escapeHtml(input.clientOrderUrl)}" style="display:inline-block;padding:10px 15px;border-radius:7px;background:#0B1F3A;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;">View order</a></p>` : ""}

      <p style="font-size:14px;line-height:1.6;color:#4a5568;margin:0 0 24px;">
        Questions? Reply to this email or write to
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#2c5282;">${SUPPORT_EMAIL}</a>.
      </p>

      <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="font-size:12px;line-height:1.6;color:#a0aec0;margin:0;">
        — PicchuSpot · Real Estate Visuals
      </p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}
