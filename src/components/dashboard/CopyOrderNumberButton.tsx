"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyOrderNumberButton({
  orderNumber,
}: {
  orderNumber: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch {
      setStatus("failed");
      window.setTimeout(() => setStatus("idle"), 2200);
    }
  }

  const copied = status === "copied";

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1 text-dashboard-action font-semibold text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
      aria-label={`Copy order number ${orderNumber}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
      <span>{copied ? "Copied" : "Copy"}</span>
      <span className="sr-only" aria-live="polite">
        {status === "copied"
          ? "Order number copied."
          : status === "failed"
            ? "Could not copy order number."
            : ""}
      </span>
    </button>
  );
}
