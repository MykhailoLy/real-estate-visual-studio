import type { ServiceType } from "@/lib/server-validation";
import {
  buildItemSummary,
  escapeHtml,
  formatCents,
  serviceLabel,
} from "./format";
import type {
  PricingSnapshot,
  TransactionalCurrency,
} from "@/lib/pricing/types";

// ============================================================
// CLIENT ORDER CONFIRMATION EMAIL
// Sent to the client (contact.email from the order form) after the
// order has been saved successfully. Friendly, concise, includes the
// order number, service, totals, a short item summary, and clear
// next steps with a support contact address.
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
  itemCount: number;
  estimatedTotalCents: number;
  currency: TransactionalCurrency;
  pricingSnapshot: PricingSnapshot;
  items: ClientConfirmationItem[];
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const SUPPORT_EMAIL = "hello@picchuspot.com";

export function renderClientConfirmation(
  input: ClientConfirmationInput
): RenderedEmail {
  const {
    orderNumber,
    serviceType,
    clientName,
    itemCount,
    estimatedTotalCents,
    currency,
    pricingSnapshot,
    items,
  } = input;

  const service = input.serviceLabelOverride ?? serviceLabel(serviceType);
  const jobTitle = input.jobTitle?.trim() ?? "";
  const total = formatCents(estimatedTotalCents, currency);
  const baseSubtotal = formatCents(
    pricingSnapshot.baseSubtotalCents,
    currency
  );
  const addOns = formatCents(pricingSnapshot.addOnSubtotalCents, currency);
  const discount = formatCents(
    pricingSnapshot.volumeDiscountCents,
    currency
  );
  const subject = `Order ${orderNumber} Received — PicchuSpot`;

  // Compact per-item summary: just the heading + 2-3 most-relevant
  // bullets so the client email stays scannable.
  const itemBlocks = items.map((item) =>
    buildItemSummary(
      serviceType,
      item.index,
      item.details,
      item.subtotalCents,
      currency,
      {
        originalPath: null,
        referenceImagePath: null,
        originalFilename: null,
        referenceFilename: null,
      }
    )
  );

  const text = [
    `Hi ${clientName || "there"},`,
    "",
    `Thank you for your order with PicchuSpot. We've received it and our team will review your files shortly.`,
    "",
    `Order number: ${orderNumber}`,
    `Service: ${service}`,
    ...(jobTitle ? [`Job title: ${jobTitle}`] : []),
    `Items: ${itemCount}`,
    `Base subtotal: ${baseSubtotal}`,
    `Add-ons: ${addOns}`,
    ...(pricingSnapshot.volumeDiscountPercent > 0
      ? [
          `Volume discount (${pricingSnapshot.volumeDiscountPercent}%): -${discount}`,
        ]
      : []),
    `Estimated total before tax: ${total}`,
    "Taxes calculated separately where applicable.",
    "",
    "What you ordered:",
    ...itemBlocks.flatMap((block) => [block.heading, ...block.textLines, ""]),
    "What happens next:",
    "  1. We review your uploaded files and instructions.",
    "  2. We confirm the final price and send an invoice.",
    "  3. Once paid, our team begins work immediately.",
    "  4. You receive completed files within 24-48 hours.",
    "",
    `Questions? Reply to this email or write to ${SUPPORT_EMAIL}.`,
    "",
    "— PicchuSpot",
    "Real Estate Visuals",
  ].join("\n");

  const itemsHtml = itemBlocks
    .map(
      (block) => `
        <div style="margin:16px 0;padding:14px 16px;background:#f7fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <div style="font-weight:600;color:#1a365d;margin-bottom:8px;">${escapeHtml(
            block.heading
          )}</div>
          <table style="width:100%;font-size:14px;line-height:1.5;border-collapse:collapse;">
            <tbody>${block.htmlRows.join("")}</tbody>
          </table>
        </div>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a202c;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="margin-bottom:24px;">
        <div style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#1a365d;">PicchuSpot</div>
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#a0aec0;margin-top:2px;">Real Estate Visuals</div>
      </div>

      <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.01em;margin:0 0 8px;color:#1a365d;">
        Order ${escapeHtml(orderNumber)} received
      </h1>
      <p style="font-size:15px;line-height:1.6;color:#4a5568;margin:0 0 24px;">
        Hi ${escapeHtml(clientName || "there")} — thanks for your order. We've received it and our team will review your files shortly.
      </p>

      <table style="width:100%;font-size:14px;line-height:1.6;color:#1a202c;border-collapse:collapse;margin-bottom:24px;">
        <tbody>
          <tr><td style="padding:4px 12px 4px 0;color:#718096;">Order number</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(
            orderNumber
          )}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#718096;">Service</td><td style="padding:4px 0;">${escapeHtml(
            service
          )}</td></tr>
          ${
            jobTitle
              ? `<tr><td style="padding:4px 12px 4px 0;color:#718096;">Job title</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(
                  jobTitle
                )}</td></tr>`
              : ""
          }
          <tr><td style="padding:4px 12px 4px 0;color:#718096;">Items</td><td style="padding:4px 0;">${itemCount}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#718096;">Base subtotal</td><td style="padding:4px 0;">${escapeHtml(baseSubtotal)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#718096;">Add-ons</td><td style="padding:4px 0;">${escapeHtml(addOns)}</td></tr>
          ${
            pricingSnapshot.volumeDiscountPercent > 0
              ? `<tr><td style="padding:4px 12px 4px 0;color:#718096;">Volume discount (${pricingSnapshot.volumeDiscountPercent}%)</td><td style="padding:4px 0;color:#15803d;">-${escapeHtml(discount)}</td></tr>`
              : ""
          }
          <tr><td style="padding:4px 12px 4px 0;color:#718096;">Estimated total before tax</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(
            total
          )}</td></tr>
          <tr><td colspan="2" style="padding:6px 0 0;color:#718096;font-size:12px;">Taxes calculated separately where applicable.</td></tr>
        </tbody>
      </table>

      <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#718096;margin-bottom:8px;">What you ordered</div>
      ${itemsHtml}

      <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#718096;margin:24px 0 8px;">What happens next</div>
      <ol style="font-size:14px;line-height:1.6;color:#1a202c;padding-left:18px;margin:0 0 24px;">
        <li>We review your uploaded files and instructions.</li>
        <li>We confirm the final price and send an invoice.</li>
        <li>Once paid, our team begins work immediately.</li>
        <li>You receive completed files within 24-48 hours.</li>
      </ol>

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
