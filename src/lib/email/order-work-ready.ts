import { absoluteUrl, SOCIAL_IMAGE } from "@/lib/seo";
import { escapeHtml } from "./escape-html";

interface WorkReadyInput {
  event: "order_delivered" | "admin_replacement_ready";
  orderId: string;
  orderNumber: string;
  clientName: string | null;
}

// Inline email colors copied from the current @theme in src/app/globals.css.
// Keep this small layout specific to the two client work-ready notifications.
export function renderWorkReadyEmail(input: WorkReadyInput) {
  const updated = input.event === "admin_replacement_ready";
  const subject = updated
    ? `Changes for order ${input.orderNumber} have been completed`
    : `Your PicchuSpot order ${input.orderNumber} is ready`;
  const heading = updated ? "Your updated files are ready" : "Your order is ready";
  const greeting = `Hi ${input.clientName?.trim() || "there"},`;
  const intro = updated
    ? `The requested changes for your order ${input.orderNumber} have been completed.`
    : `Your order ${input.orderNumber} has been completed.`;
  const message = updated
    ? "Your updated files are ready to review and download."
    : "Your delivered files are ready to review and download directly from PicchuSpot.";
  const cta = updated ? "View updated files" : "View completed order";
  const orderUrl = absoluteUrl(`/dashboard/jobs/${input.orderId}`);
  const guidance = updated
    ? "If you need another adjustment, you can request it directly from the order page."
    : "If you need any changes, you can request a revision from the order page.";
  const reassurance = "If everything looks good, no further action is required.";
  const services = [
    ["Virtual Staging", "/pricing/virtual-staging"],
    ["Virtual Renovation", "/pricing/virtual-renovation"],
    ["Photo Editing", "/pricing/photo-editing"],
    ["Floor Plans", "/pricing/floor-plans"],
  ];
  const text = [
    greeting, "", intro, "", message, "", `${cta}: ${orderUrl}`, "",
    reassurance, guidance, "", "Kind regards,", "PicchuSpot", "",
    "More from PicchuSpot",
    ...services.map(([label, path]) => `${label}: ${absoluteUrl(path)}`),
  ].join("\n");

  // Public PNG artwork is used instead of Next/Image/SVG for email compatibility.
  // Both brand assets retain their original aspect ratio; no client media is read.
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4efe8;color:#071a2b;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:collapse;background:#ffffff;border:1px solid #ded3c6;">
        <tr><td style="padding:24px 24px 16px;">
          <img src="${escapeHtml(absoluteUrl("/brand/picchuspot-logo-800.png"))}" width="112" height="84" alt="PicchuSpot" style="display:block;border:0;width:112px;height:84px;">
        </td></tr>
        <tr><td align="center" style="padding:0 24px 24px;">
          <img src="${escapeHtml(SOCIAL_IMAGE.url)}" width="360" height="189" alt="${escapeHtml(SOCIAL_IMAGE.alt)}" style="display:block;border:0;width:100%;max-width:360px;height:auto;">
        </td></tr>
        <tr><td style="padding:0 24px 24px;">
          <h1 style="margin:0 0 24px;font-size:25px;line-height:1.25;color:#071a2b;">${escapeHtml(heading)}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${escapeHtml(message)}</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 24px;">
            <tr><td bgcolor="#c7a94e" style="border-radius:4px;text-align:center;">
              <a href="${escapeHtml(orderUrl)}" style="display:inline-block;padding:14px 20px;border:1px solid #c7a94e;border-radius:4px;background:#c7a94e;color:#071a2b;font-size:15px;font-weight:bold;line-height:1.4;text-decoration:none;">${escapeHtml(cta)}</a>
            </td></tr>
          </table>
          <p style="margin:0 0 20px;font-size:13px;line-height:1.7;color:#5a656d;">${reassurance}<br>${guidance}</p>
          <p style="margin:0;font-size:14px;line-height:1.6;">Kind regards,<br>PicchuSpot</p>
          <hr style="border:0;border-top:1px solid #ded3c6;margin:24px 0 20px;">
          <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#5a656d;">More from PicchuSpot</p>
          <p style="margin:0;font-size:12px;line-height:2;">${services.map(([label, path]) => `<a href="${escapeHtml(absoluteUrl(path))}" style="display:inline-block;margin-right:12px;color:#071a2b;text-decoration:underline;">${label}</a>`).join(" ")}</p>
          <p style="margin:20px 0 0;font-size:11px;line-height:1.6;color:#5a656d;">PicchuSpot · Real Estate Visuals</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, html, text };
}
