"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import type { AuthoritativePaymentSummary } from "@/lib/payments/domain";
import { formatStoredMoney } from "@/lib/pricing/format";
import { getStripeCheckoutRedirectUrl } from "@/lib/payments/client-checkout";

const PROCESSING_POLL_INTERVAL_MS = 2_500;
const MAX_PROCESSING_POLLS = 8;

interface OrderPaymentPanelProps {
  orderId: string;
  initialSummary?: AuthoritativePaymentSummary | null;
  secondaryHref?: string;
  secondaryLabel?: string;
  presentation?: "default" | "order-detail";
}

export default function OrderPaymentPanel({
  orderId,
  initialSummary,
  secondaryHref,
  secondaryLabel = "View order",
  presentation = "default",
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

  useEffect(() => {
    if (summary?.state !== "processing") return;

    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const pollPersistedSummary = async () => {
      attempts += 1;
      controller = new AbortController();
      try {
        const response = await fetch(
          `/api/payments/summary/${encodeURIComponent(orderId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (response.ok && active) {
          const nextSummary = await response.json() as AuthoritativePaymentSummary;
          if (active) setSummary(nextSummary);
        }
      } catch (requestError) {
        if (
          !(requestError instanceof DOMException) ||
          requestError.name !== "AbortError"
        ) {
          // A transient poll failure is retried within the same bounded window.
        }
      } finally {
        if (active && attempts < MAX_PROCESSING_POLLS) {
          timer = setTimeout(pollPersistedSummary, PROCESSING_POLL_INTERVAL_MS);
        }
      }
    };

    timer = setTimeout(pollPersistedSummary, PROCESSING_POLL_INTERVAL_MS);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [orderId, summary?.state]);

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
        state?: unknown;
      } | null;
      if (!response.ok) {
        if (response.status === 409 && body?.state === "processing") {
          setSummary((current) =>
            current ? { ...current, state: "processing" } : current,
          );
          setIsStartingCheckout(false);
          return;
        }
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Secure payment could not be opened.",
        );
      }
      const redirectUrl = getStripeCheckoutRedirectUrl(body?.url);
      if (!redirectUrl) {
        throw new Error("Secure payment returned an invalid destination.");
      }
      window.location.assign(redirectUrl);
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
          <ClientPortalLink
            href={secondaryHref}
            className="mt-4 inline-flex text-sm font-semibold text-primary hover:text-primary-light"
          >
            {secondaryLabel}
          </ClientPortalLink>
        ) : null}
      </div>
    );
  }

  const isPaymentRequired = summary.state === "payment_required";
  const isNoPaymentRequired = summary.state === "no_payment_required";
  const isProcessing = summary.state === "processing";
  const isPaid = summary.state === "paid";
  const isPartiallyRefunded = summary.state === "partially_refunded";
  const isRefunded = summary.state === "refunded";
  const canOpenCheckout = isPaymentRequired || isProcessing;
  const paymentHeading = isPaymentRequired
    ? "Payment required"
    : isProcessing
      ? "Payment processing"
      : isPaid
        ? "Payment confirmed"
        : isNoPaymentRequired
          ? "No payment required"
          : isPartiallyRefunded
            ? "Payment partially refunded"
            : isRefunded
              ? "Payment refunded"
              : "Payment update";
  const itemLabel = `${summary.itemCount} ${summary.itemCount === 1 ? "image" : "images"}`;
  const totalLabel =
    summary.finalTotalCents !== null && summary.currency
      ? formatStoredMoney(summary.finalTotalCents, summary.currency)
      : null;

  return (
    <div className="rounded-xl border border-border bg-white p-5 text-left shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-bold uppercase tracking-[0.14em] ${
              presentation === "order-detail" ? "text-secondary" : "text-muted-light"
            }`}
          >
            {presentation === "order-detail" ? "Secure payment" : "Payment summary"}
          </p>
          <p className="mt-1 text-base font-bold text-foreground">
            {presentation === "order-detail" ? paymentHeading : summary.serviceLabel}
          </p>
          {presentation === "order-detail" ? (
            <p className="mt-1 text-sm font-semibold tabular-nums text-muted">
              {itemLabel}
              {totalLabel ? ` · ${totalLabel}` : ""}
            </p>
          ) : null}
        </div>
        {presentation !== "order-detail" ? (
          <span
            className={[
              "rounded-full border px-2.5 py-1 text-xs font-bold",
              isNoPaymentRequired
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : isPaid
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : isPartiallyRefunded
                  ? "border-orange-200 bg-orange-50 text-orange-800"
                  : isRefunded
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                  : isProcessing
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : isPaymentRequired
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-border bg-surface text-muted",
            ].join(" ")}
          >
            {isNoPaymentRequired
              ? "No payment required"
              : isPaid
              ? "Paid"
              : isPartiallyRefunded
                ? "Partially refunded"
                : isRefunded
                  ? "Refunded"
              : isProcessing
                ? "Payment processing"
                : isPaymentRequired
                  ? "Payment required"
                  : "Order received"}
          </span>
        ) : null}
      </div>

      {presentation !== "order-detail" ? (
        <dl className="mt-4 divide-y divide-border border-y border-border text-sm">
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-muted">Quantity</dt>
            <dd className="font-semibold text-foreground">{summary.itemCount}</dd>
          </div>
          {totalLabel ? (
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-muted">Final total</dt>
              <dd className="text-right font-bold text-foreground">
                {totalLabel} <span className="text-xs font-semibold text-muted">{summary.currency}</span>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed text-muted">
        {isNoPaymentRequired
          ? "No payment is due for this Welcome Offer order. Work can begin after the order is confirmed."
          : isPaymentRequired
          ? "Your order is received. Secure payment is still required before work can begin. The final total includes tax when applicable."
          : isProcessing
            ? "Stripe is processing this payment. This order will show Paid only after the verified payment update is received."
            : isPaid
              ? "Your payment has been verified and recorded."
              : isPartiallyRefunded
                ? "This payment has been partially refunded. Our team will review the order before any work proceeds."
                : isRefunded
                  ? "This payment has been refunded. Work will not proceed unless the order is reviewed and payment is resolved."
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
          <ClientPortalLink
            href={secondaryHref}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
          >
            {secondaryLabel}
          </ClientPortalLink>
        ) : null}
      </div>
    </div>
  );
}
