"use client";

import { useState } from "react";

export default function AdminPartnerPricingControl({
  orderId,
  userId,
  partnerClient,
  compact = false,
}: ({ orderId: string; userId?: never } | { userId: string; orderId?: never }) & {
  partnerClient: boolean;
  compact?: boolean;
}) {
  const [enabled, setEnabled] = useState(partnerClient);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function changePartnerClient(next: boolean) {
    if (saving) return;
    setSaving(true);
    setMessage("");
    setFailed(false);
    try {
      const endpoint = userId ? `/api/admin/clients/${userId}/partner-pricing` : `/api/admin/orders/${orderId}/partner-pricing`;
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerClient: next }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.partnerClient !== "boolean") {
        throw new Error("Could not update Partner pricing. Please retry.");
      }
      setEnabled(result.partnerClient);
      setMessage("Saved. Committed order prices remain unchanged.");
    } catch {
      setFailed(true);
      setMessage("Could not update Partner pricing. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={compact ? "text-sm" : "border-t border-border px-5 py-4 text-sm"}>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 font-semibold text-foreground">
        Partner client
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          disabled={saving}
          onChange={(event) => void changePartnerClient(event.target.checked)}
          className="h-5 w-5 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        />
      </label>
      <p className="text-dashboard-metadata text-muted">10% off eligible digital services</p>
      <p role={failed ? "alert" : "status"} className="mt-1 text-dashboard-metadata text-muted">
        {saving ? "Saving…" : message}
      </p>
    </div>
  );
}
