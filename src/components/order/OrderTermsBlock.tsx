"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { TERMS_VERSION } from "@/lib/order-terms";
import {
  EARLY_PERFORMANCE_COPY,
  EARLY_PERFORMANCE_VERSION,
} from "@/lib/early-performance";
import {
  LANGUAGE_CHANGE_EVENT,
  getCurrentLanguage,
  readStoredLanguage,
  type SiteLanguage,
} from "@/components/layout/Header";

/**
 * Order-level terms acceptance block.
 *
 * Rendered on every order page after item cards and contact details and
 * before the final Submit Order action. Contains a REQUIRED Terms &
 * Conditions checkbox, a separate REQUIRED early-performance request, and
 * an OPTIONAL portfolio-permission checkbox. Pricing is not affected by any
 * of these choices.
 */

export { EARLY_PERFORMANCE_VERSION, TERMS_VERSION };

export interface OrderTermsData {
  /** Required: must be true to enable Submit Order. */
  accepted: boolean;
  /** Required: explicit request to start after required payment or order confirmation. */
  earlyPerformanceRequested: boolean;
  /**
   * Optional: client lets us use anonymized before/after examples from
   * this order in our portfolio or marketing materials.
   */
  allowPortfolio: boolean;
}

export const emptyOrderTerms: OrderTermsData = {
  accepted: false,
  earlyPerformanceRequested: false,
  allowPortfolio: false,
};

interface OrderTermsBlockProps {
  data: OrderTermsData;
  onChange: (data: OrderTermsData) => void;
  disabled?: boolean;
  showError?: boolean;
  containerId?: string;
  errorMessage?: string;
  earlyPerformanceErrorMessage?: string;
}

export default function OrderTermsBlock({
  data,
  onChange,
  disabled = false,
  showError = false,
  containerId,
  errorMessage = "Accept the terms before submitting.",
  earlyPerformanceErrorMessage,
}: OrderTermsBlockProps) {
  const pathname = usePathname() ?? "/";
  const [savedLanguage, setSavedLanguage] = useState<SiteLanguage | null>(null);
  const language = getCurrentLanguage(pathname, savedLanguage);
  const errorIdPrefix = useId();
  const termsErrorId = `${errorIdPrefix}-terms-error`;
  const earlyPerformanceErrorId = `${errorIdPrefix}-early-performance-error`;
  const displayTermsError = showError && !data.accepted;
  const displayEarlyPerformanceError =
    showError && !data.earlyPerformanceRequested;
  const resolvedEarlyPerformanceError =
    earlyPerformanceErrorMessage ??
    (language === "es"
      ? "Solicita expresamente el inicio del servicio antes de enviar."
      : "Request the confirmed-payment start of service before submitting.");

  useEffect(() => {
    window.queueMicrotask(() => setSavedLanguage(readStoredLanguage()));
    const onLanguageChange = () => setSavedLanguage(readStoredLanguage());
    window.addEventListener(LANGUAGE_CHANGE_EVENT, onLanguageChange);
    return () =>
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, onLanguageChange);
  }, []);

  const update = <K extends keyof OrderTermsData>(
    field: K,
    value: OrderTermsData[K]
  ) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div
      id={containerId}
      className="bg-white border border-border rounded-xl p-5 sm:p-6"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground leading-tight">
            Review &amp; Confirm
          </h2>
          <p className="text-sm text-muted mt-0.5">
            One quick step before submitting your order.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Required: Terms & Conditions */}
        <label
          className={`flex items-start gap-3 p-4 rounded-lg border bg-surface/50 transition-colors ${
            displayTermsError ? "border-red-300" : "border-border"
          } ${
            disabled
              ? "cursor-not-allowed opacity-70"
              : "cursor-pointer hover:border-primary/40"
          }`}
        >
          <input
            type="checkbox"
            checked={data.accepted}
            disabled={disabled}
            onChange={(e) => update("accepted", e.target.checked)}
            data-validation-control
            aria-required="true"
            aria-invalid={displayTermsError || undefined}
            aria-describedby={displayTermsError ? termsErrorId : undefined}
            className="w-4 h-4 mt-0.5 rounded text-primary border-border focus:ring-primary flex-shrink-0 disabled:cursor-not-allowed"
          />
          <span className="text-sm text-foreground leading-relaxed">
            I have read and agree to the{" "}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary-light"
            >
              Terms &amp; Conditions
            </Link>
            . <span className="text-red-500">*</span>
          </span>
        </label>
        {displayTermsError && (
          <p
            id={termsErrorId}
            role="alert"
            className="-mt-2 text-xs text-red-600"
          >
            {errorMessage}
          </p>
        )}

        {/* Required: express request to start performance after payment */}
        <label
          className={`flex items-start gap-3 rounded-lg border bg-surface/50 p-4 transition-colors ${
            displayEarlyPerformanceError ? "border-red-300" : "border-border"
          } ${
            disabled
              ? "cursor-not-allowed opacity-70"
              : "cursor-pointer hover:border-primary/40"
          }`}
        >
          <input
            type="checkbox"
            checked={data.earlyPerformanceRequested}
            disabled={disabled}
            onChange={(event) =>
              update("earlyPerformanceRequested", event.target.checked)
            }
            data-validation-control
            data-legal-acknowledgement="early-performance"
            aria-required="true"
            aria-invalid={displayEarlyPerformanceError || undefined}
            aria-describedby={
              displayEarlyPerformanceError
                ? earlyPerformanceErrorId
                : undefined
            }
            className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-border text-primary focus:ring-primary disabled:cursor-not-allowed"
          />
          <span className="text-sm leading-relaxed text-foreground">
            {EARLY_PERFORMANCE_COPY[language]}{" "}
            <span className="text-red-500">*</span>
          </span>
        </label>
        {displayEarlyPerformanceError && (
          <p
            id={earlyPerformanceErrorId}
            role="alert"
            className="-mt-2 text-xs text-red-600"
          >
            {resolvedEarlyPerformanceError}
          </p>
        )}

        {/* Optional: Portfolio permission */}
        <label
          className={`flex items-start gap-3 p-4 rounded-lg border border-border bg-white transition-colors ${
            disabled
              ? "cursor-not-allowed opacity-70"
              : "cursor-pointer hover:border-primary/40"
          }`}
        >
          <input
            type="checkbox"
            checked={data.allowPortfolio}
            disabled={disabled}
            onChange={(e) => update("allowPortfolio", e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded text-primary border-border focus:ring-primary flex-shrink-0 disabled:cursor-not-allowed"
          />
          <span className="text-sm text-foreground leading-relaxed">
            I allow PicchuSpot to use before/after examples from this
            order in portfolio or marketing materials.
            <span className="block text-xs text-muted mt-1">
              Optional. We may anonymize property details and never display
              private contact information.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
