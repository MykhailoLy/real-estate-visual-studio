"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import type { AuthoritativePaymentSummary } from "@/lib/payments/domain";
import { formatStoredMoney } from "@/lib/pricing/format";

interface OrderPaymentPanelProps {
  orderId: string;
  initialSummary?: AuthoritativePaymentSummary | null;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export default function OrderPaymentPanel({
  orderId,
  initialSummary,
  secondaryHref,
  secondaryLabel = "View order",
}: OrderPaymentPanelProps) {
  const [summary, setSummary] = useState<AuthoritativePaymentSummary | null>(
    initialSummary ?? null,
  );
  const [isLoading, setIsLoading] = useState(initialSummary === undefined);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialSummary !== undefined) return;
    const controller = new AbortController();
    void fetch(`/api/payments/summary/${encodeURIComponent(orderId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("summary-unavailable");
        return response.json() as Promise<AuthoritativePaymentSummary>;
      })
      .then((data) => setSummary(data))
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }
        setError("Payment details are temporarily unavailable. You can still view your order.");
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [initialSummary, orderId]);

  const startCheckout = async () => {
    setIsStartingCheckout(true);
    setError("");
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const body = (await response.json().catch(() => null)) as {
        url?: unknown;
        error?: unknown;
      } | null;
      if (!response.ok || typeof body?.url !== "string") {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Secure payment could not be opened.",
        );
      }
      window.location.assign(body.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Secure payment could not be opened.",
      );
      setIsStartingCheckout(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-white p-5 text-left">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
          Loading secure payment details…
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-left">
        <p className="text-sm text-amber-900">{error}</p>
        {secondaryHref ? (
          <Link
            href={secondaryHref}
            className="mt-4 inline-flex text-sm font-semibold text-primary hover:text-primary-light"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    );
  }

  const isPaymentRequired = summary.state === "payment_required";
  const isProcessing = summary.state === "processing";
  const isPaid = summary.state === "paid";
  const canOpenCheckout = isPaymentRequired || isProcessing;

  return (
    <div className="rounded-xl border border-border bg-white p-5 text-left shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-light">
            Payment summary
          </p>
          <p className="mt-1 text-base font-bold text-foreground">
            {summary.serviceLabel}
          </p>
        </div>
        <span
          className={[
            "rounded-full border px-2.5 py-1 text-xs font-bold",
            isPaid
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : isProcessing
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : isPaymentRequired
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-border bg-surface text-muted",
          ].join(" ")}
        >
          {isPaid
            ? "Paid"
            : isProcessing
              ? "Payment processing"
              : isPaymentRequired
                ? "Payment required"
                : "Order received"}
        </span>
      </div>

      <dl className="mt-4 divide-y divide-border border-y border-border text-sm">
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-muted">Quantity</dt>
          <dd className="font-semibold text-foreground">{summary.itemCount}</dd>
        </div>
        {summary.finalTotalCents !== null && summary.currency ? (
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-muted">Final total</dt>
            <dd className="text-right font-bold text-foreground">
              {formatStoredMoney(summary.finalTotalCents, summary.currency)}{" "}
              <span className="text-xs font-semibold text-muted">{summary.currency}</span>
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-muted">
        {isPaymentRequired
          ? "Your order is received. Secure payment is still required before work can begin. The final total includes tax when applicable."
          : isProcessing
            ? "Stripe is processing this payment. This order will show Paid only after the verified payment update is received."
            : isPaid
              ? "Your payment has been verified and recorded."
              : "We’ll review your order and contact you with the appropriate next step."}
      </p>

      {error ? (
        <p className="mt-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {canOpenCheckout ? (
          <button
            type="button"
            onClick={startCheckout}
            disabled={isStartingCheckout}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStartingCheckout ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : isProcessing ? (
              <ShieldCheck className="h-4 w-4" aria-hidden />
            ) : (
              <CreditCard className="h-4 w-4" aria-hidden />
            )}
            {isStartingCheckout
              ? "Opening secure payment…"
              : isProcessing
                ? "Return to secure payment"
                : "Pay securely"}
          </button>
        ) : null}
        {secondaryHref ? (
          <Link
            href={secondaryHref}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
