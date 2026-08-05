import { z } from "zod";
import { getPropertyAddressView } from "../../features/property-showcase/property-address.ts";
import {
  getPrimaryLanguage,
  localizedText,
} from "../../features/property-showcase/localization.ts";
import { serializePublicPropertyShowcase } from "../../features/property-showcase/public-serialization.ts";
import { canonicalPropertyUrl } from "../../features/property-showcase/sharing.ts";
import type { PropertyLeadNotificationInput } from "../../features/property-showcase/property-leads.ts";
import { escapeHtml } from "./escape-html.ts";

const EmailSchema = z.string().trim().email().max(320);
const RECEIVED_TIME_ZONE = "UTC";
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export interface PropertyLeadEmailDelivery {
  from: string;
  recipientEmail: string;
  ccEmail?: string;
}

export interface PropertyLeadEmailPayload {
  from: string;
  to: string;
  cc?: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
}

interface EmailAction {
  label: string;
  url: string;
  primary?: boolean;
}

interface DetailRow {
  label: string;
  value: string;
  url?: string;
}

export function parseEmailAddress(value: string | undefined): string | undefined {
  const parsed = EmailSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function sanitizeHeaderText(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validatedCanonicalPropertyUrl(slug: string): string {
  const url = new URL(canonicalPropertyUrl(slug));
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("The canonical property URL is not a safe HTTPS URL.");
  }
  return url.toString();
}

function mailtoUrl(email: string): string {
  return `mailto:${encodeURIComponent(email)}`;
}

function normalizePhoneForTel(value: string | undefined): string | undefined {
  const trimmed = optionalText(value);
  if (!trimmed || !/^\+?[\d\s().-]+$/.test(trimmed)) return undefined;
  const normalized = trimmed.replace(/[\s().-]/g, "");
  return /^\+?\d{6,15}$/.test(normalized) ? normalized : undefined;
}

export function normalizeInternationalWhatsAppPhone(
  value: string | undefined,
): string | undefined {
  const trimmed = optionalText(value);
  if (!trimmed || !/^\+[\d\s().-]+$/.test(trimmed)) return undefined;
  const e164 = trimmed.replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164.slice(1) : undefined;
}

function formatReceivedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return `Date and time unavailable (${RECEIVED_TIME_ZONE})`;
  }
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: RECEIVED_TIME_ZONE,
  }).format(date);
  return `${formatted} ${RECEIVED_TIME_ZONE}`;
}

function formatPreferredDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return `${value} (visitor local date)`;
  const [, year, month, day] = match;
  const monthName = MONTH_NAMES[Number(month) - 1];
  return monthName
    ? `${Number(day)} ${monthName} ${year} (visitor local date)`
    : `${value} (visitor local date)`;
}

function formatPreferredTime(value: string): string {
  return `${value} (visitor local time)`;
}

function detailRowsHtml(rows: DetailRow[]): string {
  return rows
    .map(({ label, value, url }) => {
      const renderedValue = url
        ? `<a href="${escapeHtml(url)}" style="color:#0B1F3A;text-decoration:underline;word-break:break-word;">${escapeHtml(value)}</a>`
        : escapeHtml(value).replace(/\r?\n/g, "<br>");
      return `<tr>
        <td style="padding:5px 14px 5px 0;color:#64748b;font-size:13px;line-height:1.45;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
        <td style="padding:5px 0;color:#0f172a;font-size:14px;line-height:1.45;vertical-align:top;word-break:break-word;">${renderedValue}</td>
      </tr>`;
    })
    .join("");
}

function sectionHtml(title: string, rows: DetailRow[]): string {
  if (rows.length === 0) return "";
  return `<tr><td style="padding:0 28px 20px;">
    <h2 style="margin:0 0 8px;color:#0B1F3A;font-size:15px;line-height:1.3;">${escapeHtml(title)}</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${detailRowsHtml(rows)}</table>
  </td></tr>`;
}

function actionsHtml(actions: EmailAction[]): string {
  return actions
    .map(({ label, url, primary }) => {
      const background = primary ? "#B88A44" : "#0B1F3A";
      const color = primary ? "#0B1F3A" : "#ffffff";
      return `<table role="presentation" cellpadding="0" cellspacing="0" align="left" style="border-collapse:collapse;margin:0 8px 8px 0;"><tr><td bgcolor="${background}" style="border-radius:4px;background:${background};"><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 14px;color:${color};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;line-height:1.2;text-decoration:none;">${escapeHtml(label)}</a></td></tr></table>`;
    })
    .join("");
}

function textRows(rows: DetailRow[]): string[] {
  return rows.map(({ label, value }) => `${label}: ${value}`);
}

export function buildPropertyLeadEmailPayload(
  input: PropertyLeadNotificationInput,
  delivery: PropertyLeadEmailDelivery,
): PropertyLeadEmailPayload {
  const recipientEmail = parseEmailAddress(delivery.recipientEmail);
  const applicantEmail = parseEmailAddress(input.applicant.email);
  const ccEmail = delivery.ccEmail
    ? parseEmailAddress(delivery.ccEmail)
    : undefined;
  if (!recipientEmail) throw new Error("The realtor email is invalid.");
  if (!applicantEmail) throw new Error("The applicant email is invalid.");
  if (delivery.ccEmail && !ccEmail) throw new Error("The CC email is invalid.");

  const publicProperty = serializePublicPropertyShowcase(input.property);
  const primaryLanguage = getPrimaryLanguage(publicProperty);
  const title =
    localizedText(
      publicProperty.title,
      input.applicant.locale,
      primaryLanguage,
    ) || "Property";
  const propertyUrl = validatedCanonicalPropertyUrl(publicProperty.slug);
  const publicLocation = optionalText(
    getPropertyAddressView(
      publicProperty.location,
      input.applicant.locale,
      primaryLanguage,
    ).socialText,
  );
  const reference = optionalText(publicProperty.reference);
  const applicantName = optionalText(input.applicant.name) || "Applicant";
  const applicantPhone = optionalText(input.applicant.phone);
  const preferredDate = optionalText(input.applicant.preferredDate);
  const preferredTime = optionalText(input.applicant.preferredTime);
  const applicantMessage = optionalText(input.applicant.message);
  const receivedAt = formatReceivedAt(input.receivedAt);
  const mailto = mailtoUrl(applicantEmail);
  const telPhone = normalizePhoneForTel(applicantPhone);
  const tel = telPhone ? `tel:${telPhone}` : undefined;
  const whatsappPhone = normalizeInternationalWhatsAppPhone(applicantPhone);
  const whatsapp = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
        `Hello ${applicantName}, thank you for your viewing request for ${title}.`,
      )}`
    : undefined;

  const propertyRows: DetailRow[] = [
    { label: "Property", value: title },
    { label: "Public property URL", value: propertyUrl, url: propertyUrl },
    ...(publicLocation
      ? [{ label: "Public location", value: publicLocation }]
      : []),
    ...(reference ? [{ label: "Property reference", value: reference }] : []),
  ];
  const applicantRows: DetailRow[] = [
    { label: "Full name", value: applicantName },
    { label: "Email", value: applicantEmail, url: mailto },
    ...(applicantPhone
      ? [{ label: "Phone", value: applicantPhone, ...(tel ? { url: tel } : {}) }]
      : []),
  ];
  const viewingRows: DetailRow[] = [
    ...(preferredDate
      ? [{ label: "Preferred date", value: formatPreferredDate(preferredDate) }]
      : []),
    ...(preferredTime
      ? [{ label: "Preferred time", value: formatPreferredTime(preferredTime) }]
      : []),
  ];
  const actions: EmailAction[] = [
    { label: "Open property", url: propertyUrl, primary: true },
    { label: "Reply by email", url: mailto },
    ...(tel ? [{ label: "Call applicant", url: tel }] : []),
    ...(whatsapp
      ? [{ label: "Message applicant on WhatsApp", url: whatsapp }]
      : []),
  ];
  const subject = `New viewing request: ${sanitizeHeaderText(title)} — ${sanitizeHeaderText(applicantName)}`;
  const preheader = `New viewing request from ${applicantName} for ${title}.`;

  const text = [
    "NEW VIEWING REQUEST",
    `Received: ${receivedAt}`,
    "",
    "PROPERTY",
    ...textRows(propertyRows),
    "",
    "APPLICANT",
    ...textRows(applicantRows),
    ...(viewingRows.length
      ? ["", "REQUESTED VIEWING", ...textRows(viewingRows)]
      : []),
    ...(applicantMessage
      ? ["", "MESSAGE", applicantMessage]
      : []),
    "",
    "ACTIONS",
    ...actions.map(({ label, url }) => `${label}: ${url}`),
    "",
    "This request was submitted through the PicchuSpot property showcase.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#eef2f6;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none!important;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#eef2f6;">
      <tr><td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:collapse;background:#ffffff;border:1px solid #dbe3ec;">
          <tr><td bgcolor="#0B1F3A" style="padding:16px 28px;background:#0B1F3A;color:#ffffff;">
            <div style="font-size:18px;font-weight:700;line-height:1.2;letter-spacing:.1px;">Picchu<span style="color:#d3aa6c;">Spot</span></div>
          </td></tr>
          <tr><td style="padding:24px 28px 18px;border-bottom:1px solid #e2e8f0;">
            <h1 style="margin:0 0 7px;color:#0B1F3A;font-size:24px;line-height:1.25;">New viewing request</h1>
            <p style="margin:0 0 9px;color:#475569;font-size:14px;line-height:1.5;">A visitor submitted a viewing request from the public property showcase.</p>
            <p style="margin:0;color:#64748b;font-size:12px;line-height:1.4;"><strong style="color:#334155;">Received:</strong> ${escapeHtml(receivedAt)}</p>
          </td></tr>
          <tr><td style="padding:20px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f8fafc;border-left:4px solid #B88A44;">
              <tr><td style="padding:14px 16px;">
                <div style="margin:0 0 4px;color:#64748b;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;">Property</div>
                <div style="color:#0B1F3A;font-size:18px;font-weight:700;line-height:1.35;">${escapeHtml(title)}</div>
                ${reference ? `<div style="margin-top:4px;color:#64748b;font-size:12px;line-height:1.4;">Reference: ${escapeHtml(reference)}</div>` : ""}
              </td></tr>
            </table>
          </td></tr>
          ${sectionHtml("Property summary", propertyRows)}
          ${sectionHtml("Applicant and contact", applicantRows)}
          ${sectionHtml("Requested viewing", viewingRows)}
          ${applicantMessage ? `<tr><td style="padding:0 28px 20px;"><h2 style="margin:0 0 8px;color:#0B1F3A;font-size:15px;line-height:1.3;">Message</h2><div style="padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;color:#0f172a;font-size:14px;line-height:1.55;word-break:break-word;">${escapeHtml(applicantMessage).replace(/\r?\n/g, "<br>")}</div></td></tr>` : ""}
          <tr><td style="padding:2px 28px 20px;">
            <h2 style="margin:0 0 10px;color:#0B1F3A;font-size:15px;line-height:1.3;">Contact applicant</h2>
            ${actionsHtml(actions)}
          </td></tr>
          <tr><td bgcolor="#f8fafc" style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px;line-height:1.5;">This request was submitted through the PicchuSpot property showcase. Replying to this email replies to the applicant.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return {
    from: delivery.from,
    to: recipientEmail,
    ...(ccEmail ? { cc: ccEmail } : {}),
    replyTo: applicantEmail,
    subject,
    text,
    html,
  };
}
