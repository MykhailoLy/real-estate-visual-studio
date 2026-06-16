import type { ServiceType } from "@/lib/server-validation";
import {
  buildItemSummary,
  escapeHtml,
  formatBytes,
  formatCents,
  serviceLabel,
} from "./format";

// ============================================================
// ADMIN ORDER NOTIFICATION EMAIL
// Sent to ADMIN_EMAIL (orders@picchuspot.com by default) after a
// new order has been saved. Detail-heavy: every relevant item field,
// the client's full contact info, file paths, signed download URLs
// where available.
// ============================================================

export interface AdminOrderItem {
  index: number;
  details: Record<string, unknown>;
  subtotalCents: number;
  files: {
    originalPath: string | null;
    referenceImagePath: string | null;
    originalFilename: string | null;
    referenceFilename: string | null;
    originalSizeBytes: number | null;
    referenceSizeBytes: number | null;
    originalDownloadUrl: string | null;
    referenceDownloadUrl: string | null;
  };
}

export interface AdminNotificationInput {
  orderNumber: string;
  serviceType: ServiceType;
  /** Optional dedicated label (e.g. "Day to Dusk") overriding the broad service label. */
  serviceLabelOverride?: string;
  /** Order-level Job Title shown prominently in the body. */
  jobTitle?: string;
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
  items: AdminOrderItem[];
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderAdminNotification(
  input: AdminNotificationInput
): RenderedEmail {
  const {
    orderNumber,
    serviceType,
    client,
    itemCount,
    estimatedTotalCents,
    termsAcceptance,
    portfolioPermission,
    items,
  } = input;

  const service = input.serviceLabelOverride ?? serviceLabel(serviceType);
  const jobTitle = input.jobTitle?.trim() ?? "";
  const total = formatCents(estimatedTotalCents);
  const subject = `New Order: ${orderNumber} — ${service}`;

  const itemBlocks = items.map((item) =>
    buildItemSummary(serviceType, item.index, item.details, item.subtotalCents, {
      originalPath: item.files.originalPath,
      referenceImagePath: item.files.referenceImagePath,
      originalFilename: item.files.originalFilename,
      referenceFilename: item.files.referenceFilename,
      originalDownloadUrl: item.files.originalDownloadUrl,
      referenceDownloadUrl: item.files.referenceDownloadUrl,
    })
  );

  // ---- Plain text body ----
  const textLines: string[] = [
    `New order ${orderNumber} (${service})`,
    "",
    "CLIENT",
    `  Name:  ${client.name}`,
    `  Email: ${client.email}`,
    `  Phone: ${client.phone}`,
  ];
  if (client.company) textLines.push(`  Company: ${client.company}`);
  textLines.push(
    "",
    "ORDER",
    `  Order number: ${orderNumber}`,
    `  Service: ${service}`,
    ...(jobTitle ? [`  Job title: ${jobTitle}`] : []),
    `  Items: ${itemCount}`,
    `  Estimated total: ${total}`,
    "",
    "TERMS",
    `  Accepted: ${termsAcceptance.accepted ? "yes" : "no"}`,
    `  Version: ${termsAcceptance.version}`,
    `  At: ${termsAcceptance.accepted_at}`,
    `  Portfolio use allowed: ${portfolioPermission.allowed ? "yes" : "no"}`,
    "",
    "ITEMS"
  );

  for (const item of itemBlocks) {
    textLines.push("", `  ${item.heading}`);
    for (const line of item.textLines) textLines.push(`    ${line}`);
  }

  // File size summary at the bottom for quick gauge.
  const totalBytes = items.reduce(
    (sum, it) =>
      sum +
      (it.files.originalSizeBytes ?? 0) +
      (it.files.referenceSizeBytes ?? 0),
    0
  );
  if (totalBytes > 0) {
    textLines.push("", `Total uploaded payload: ${formatBytes(totalBytes)}`);
  }

  const text = textLines.join("\n");

  // ---- HTML body ----
  const itemsHtml = itemBlocks
    .map(
      (block) => `
        <div style="margin:14px 0;padding:14px 16px;background:#f7fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <div style="font-weight:600;color:#1a365d;margin-bottom:8px;">${escapeHtml(
            block.heading
          )}</div>
          <table style="width:100%;font-size:14px;line-height:1.5;border-collapse:collapse;">
            <tbody>${block.htmlRows.join("")}</tbody>
          </table>
        </div>`
    )
    .join("");

  const companyRow = client.company
    ? `<tr><td style="padding:4px 12px 4px 0;color:#718096;">Company</td><td style="padding:4px 0;">${escapeHtml(
        client.company
      )}</td></tr>`
    : "";

  const totalBytesRow =
    totalBytes > 0
      ? `<tr><td style="padding:4px 12px 4px 0;color:#718096;">Total upload size</td><td style="padding:4px 0;">${escapeHtml(
          formatBytes(totalBytes)
        )}</td></tr>`
      : "";

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a202c;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="margin-bottom:20px;">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#a0aec0;margin-bottom:4px;">Internal · ${escapeHtml(
          service
        )}</div>
        <h1 style="font-size:22px;font-weight:700;margin:0;color:#1a365d;">
          New order ${escapeHtml(orderNumber)}
        </h1>
      </div>

      <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#718096;margin-bottom:6px;">Client</div>
      <table style="width:100%;font-size:14px;line-height:1.6;border-collapse:collapse;margin-bottom:18px;">
        <tbody>
          <tr><td style="padding:4px 12px 4px 0;color:#718096;">Name</td><td style="padding:4px 0;">${escapeHtml(
            client.name
          )}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#718096;">Email</td><td style="padding:4px 0;"><a href="mailto:${escapeHtml(
            client.email
          )}" style="color:#2c5282;">${escapeHtml(client.email)}</a></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#718096;">Phone</td><td style="padding:4px 0;">${escapeHtml(
            client.phone
          )}</td></tr>
          ${companyRow}
        </tbody>
      </table>

      <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#718096;margin-bottom:6px;">Order</div>
      <table style="width:100%;font-size:14px;line-height:1.6;border-collapse:collapse;margin-bottom:18px;">
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
          <tr><td style="padding:4px 12px 4px 0;color:#718096;">Estimated total</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(
            total
          )}</td></tr>
          ${totalBytesRow}
        </tbody>
      </table>

      <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#718096;margin-bottom:6px;">Terms</div>
      <table style="width:100%;font-size:13px;line-height:1.6;border-collapse:collapse;margin-bottom:18px;color:#4a5568;">
        <tbody>
          <tr><td style="padding:2px 12px 2px 0;color:#718096;">Accepted</td><td style="padding:2px 0;">${
            termsAcceptance.accepted ? "yes" : "no"
          }</td></tr>
          <tr><td style="padding:2px 12px 2px 0;color:#718096;">Version</td><td style="padding:2px 0;">${escapeHtml(
            termsAcceptance.version
          )}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;color:#718096;">At</td><td style="padding:2px 0;">${escapeHtml(
            termsAcceptance.accepted_at
          )}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;color:#718096;">Portfolio use</td><td style="padding:2px 0;">${
            portfolioPermission.allowed ? "allowed" : "not allowed"
          }</td></tr>
        </tbody>
      </table>

      <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#718096;margin-bottom:6px;">Items</div>
      ${itemsHtml}

      <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="font-size:12px;line-height:1.6;color:#a0aec0;margin:0;">
        Internal notification · PicchuSpot
      </p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}
