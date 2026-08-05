import "server-only";
import type { PropertyLeadNotificationInput } from "@/features/property-showcase/property-leads";
import { getFromAddress, getResendClient } from "./resend-client";
import {
  buildPropertyLeadEmailPayload,
  parseEmailAddress,
} from "./property-lead-email-template";

export async function sendPropertyLeadEmail(
  input: PropertyLeadNotificationInput,
): Promise<{ status: "sent" | "failed" | "skipped"; error?: string }> {
  const recipientEmail = parseEmailAddress(input.recipientEmail);
  if (!recipientEmail) {
    return { status: "skipped", error: "No realtor email is configured." };
  }

  const resend = getResendClient();
  if (!resend.ok) return { status: "failed", error: resend.reason };

  const fromEmail = parseEmailAddress(process.env.PROPERTY_LEADS_FROM_EMAIL);
  const ccEmail = parseEmailAddress(process.env.PROPERTY_LEADS_CC_EMAIL);

  try {
    const payload = buildPropertyLeadEmailPayload(input, {
      from: fromEmail
        ? `PicchuSpot Property Leads <${fromEmail}>`
        : getFromAddress(),
      recipientEmail,
      ...(ccEmail ? { ccEmail } : {}),
    });
    const response = await resend.client.emails.send(
      payload,
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
