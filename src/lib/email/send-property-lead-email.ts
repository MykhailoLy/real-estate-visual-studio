import "server-only";
import { z } from "zod";
import type { PropertyLeadNotificationInput } from "@/features/property-showcase/property-leads";
import { escapeHtml } from "./format";
import { getFromAddress, getResendClient } from "./resend-client";

const EmailSchema = z.string().trim().email().max(320);

export async function sendPropertyLeadEmail(
  input: PropertyLeadNotificationInput,
): Promise<{ status: "sent" | "failed" | "skipped"; error?: string }> {
  const recipient = EmailSchema.safeParse(input.recipientEmail);
  if (!recipient.success) {
    return { status: "skipped", error: "No realtor email is configured." };
  }

  const resend = getResendClient();
  if (!resend.ok) return { status: "failed", error: resend.reason };

  const fromEmail = EmailSchema.safeParse(process.env.PROPERTY_LEADS_FROM_EMAIL);
  const ccEmail = EmailSchema.safeParse(process.env.PROPERTY_LEADS_CC_EMAIL);
  const title =
    input.property.title[input.applicant.locale] ??
    input.property.title[input.property.primaryLanguage ?? "en"] ??
    input.property.title.en;
  const rows: Array<[string, string]> = [
    ["Property", title],
    ["Public property URL", input.publicUrl],
    ["Applicant", input.applicant.name],
    ["Email", input.applicant.email],
    ["Phone", input.applicant.phone],
    ["Preferred date", input.applicant.preferredDate],
    ["Preferred time", input.applicant.preferredTime],
    ["Message", input.applicant.message],
    ["Received", input.receivedAt],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const text = [
    "New viewing request",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
  const htmlRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 14px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;color:#0f172a;">${formatEmailValue(value)}</td>
        </tr>`,
    )
    .join("");
  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;padding:28px;">
        <div style="font-size:18px;font-weight:700;color:#0B1F3A;">Picchu<span style="color:#B88A44;">Spot</span></div>
        <h1 style="margin:24px 0 8px;font-size:24px;color:#0B1F3A;">New viewing request</h1>
        <p style="margin:0 0 20px;color:#475569;line-height:1.6;">A visitor submitted a viewing request from the public property showcase.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.5;"><tbody>${htmlRows}</tbody></table>
      </div>
    </div>
  </body>
</html>`;

  try {
    const response = await resend.client.emails.send(
      {
        from: fromEmail.success
          ? `PicchuSpot Property Leads <${fromEmail.data}>`
          : getFromAddress(),
        to: recipient.data,
        ...(ccEmail.success ? { cc: ccEmail.data } : {}),
        replyTo: input.applicant.email,
        subject: `New viewing request: ${title}`,
        text,
        html,
      },
      {
        headers: {
          "Idempotency-Key": `property-lead-${input.leadId}`,
        },
      },
    );
    const result = response as { error?: { message?: string } | null };
    if (result.error) {
      return {
        status: "failed",
        error: result.error.message || "Resend reported an error.",
      };
    }
    return { status: "sent" };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Email notification failed.",
    };
  }
}

function formatEmailValue(value: string): string {
  if (/^https:\/\//i.test(value)) {
    const safe = escapeHtml(value);
    return `<a href="${safe}" style="color:#1d4ed8;">${safe}</a>`;
  }
  return escapeHtml(value).replace(/\r?\n/g, "<br/>");
}
