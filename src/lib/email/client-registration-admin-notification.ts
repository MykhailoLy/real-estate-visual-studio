import "server-only";
import { absoluteUrl } from "@/lib/seo";
import { escapeHtml } from "@/lib/email/escape-html";
import { getAdminAddress, getFromAddress, getResendClient } from "@/lib/email/resend-client";

// Only explicitly selected fields from the server-verified Auth user belong here.
// Never pass the session, callback URL, or arbitrary user metadata to the email.
export async function sendClientRegistrationAdminNotification(input: {
  userId: string;
  name: string;
  email: string;
  registeredAt: string;
}): Promise<"sent" | "failed" | "skipped"> {
  try {
    const resend = getResendClient();
    if (!resend.ok) return "skipped";

    const name = input.name.trim();
    const clientsUrl = absoluteUrl("/admin/clients");
    const fields = [
      ["Name", name || "Not provided"],
      ["Email", input.email],
      ["Registration timestamp", input.registeredAt],
    ];
    const result = await resend.client.emails.send({
      from: getFromAddress(),
      to: getAdminAddress(),
      subject: `New client registered — ${name || input.email}`.replace(/[\r\n]+/g, " "),
      text: [
        "New client registered",
        "The client has confirmed their signup email.",
        ...fields.map(([label, value]) => `${label}: ${value}`),
        `Open admin clients: ${clientsUrl}`,
      ].join("\n\n"),
      html: `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a202c;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#a0aec0;margin-bottom:4px;">Internal · PicchuSpot</div>
      <h1 style="font-size:22px;font-weight:700;margin:0;color:#1a365d;">New client registered</h1>
      <p style="font-size:14px;line-height:1.6;">The client has confirmed their signup email.</p>
      <table style="width:100%;font-size:14px;line-height:1.6;border-collapse:collapse;margin-bottom:18px;">
        <tbody>${fields.map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0;color:#718096;">${escapeHtml(label)}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`).join("")}</tbody>
      </table>
      <a href="${escapeHtml(clientsUrl)}" style="display:inline-block;padding:9px 14px;border-radius:7px;background:#0B1F3A;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;">Open admin clients</a>
    </div>
  </body>
</html>`,
    }, {
      headers: { "Idempotency-Key": `client-registration-${input.userId}` },
    });
    return result.error ? "failed" : "sent";
  } catch {
    // No provider details reach the browser or logs; Auth must remain successful.
    return "failed";
  }
}
