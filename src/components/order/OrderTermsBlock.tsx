"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { TERMS_VERSION } from "@/lib/order-terms";
import {
  COMBINED_ORDER_CONSENT_COPY,
  EARLY_PERFORMANCE_VERSION,
} from "@/lib/early-performance";
import {
  ORDER_CONSENT_ERROR_COPY,
  PORTFOLIO_PERMISSION_COPY,
  emptyOrderTerms,
  setRequiredOrderConsent,
  type OrderTermsData,
} from "@/lib/order-consent";
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
 * before the final Submit Order action. Contains one REQUIRED combined Terms
 * and early-performance checkbox plus an OPTIONAL portfolio-permission
 * checkbox. Pricing is not affected by either choice.
 */

export {
  EARLY_PERFORMANCE_VERSION,
  TERMS_VERSION,
  emptyOrderTerms,
  type OrderTermsData,
};

interface OrderTermsBlockProps {
  data: OrderTermsData;
  onChange: (data: OrderTermsData) => void;
  disabled?: boolean;
  showError?: boolean;
  containerId?: string;
  errorMessage?: string;
}

export default function OrderTermsBlock({
  data,
  onChange,
  disabled = false,
  showError = false,
  containerId,
  errorMessage,
}: OrderTermsBlockProps) {
  const pathname = usePathname() ?? "/";
  const [savedLanguage, setSavedLanguage] = useState<SiteLanguage | null>(null);
  const language = getCurrentLanguage(pathname, savedLanguage);
  const errorIdPrefix = useId();
  const requiredErrorId = `${errorIdPrefix}-required-consent-error`;
  const requiredConsentChecked =
    data.accepted && data.earlyPerformanceRequested;
  const displayRequiredError = showError && !requiredConsentChecked;
  const requiredCopy = COMBINED_ORDER_CONSENT_COPY[language];
  const portfolioCopy = PORTFOLIO_PERMISSION_COPY[language];
  const termsHref = language === "es" ? "/es/terms" : "/terms";
  const resolvedError = errorMessage ?? ORDER_CONSENT_ERROR_COPY[language];

  useEffect(() => {
    window.queueMicrotask(() => setSavedLanguage(readStoredLanguage()));
    const onLanguageChange = () => setSavedLanguage(readStoredLanguage());
    window.addEventListener(LANGUAGE_CHANGE_EVENT, onLanguageChange);
    return () =>
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, onLanguageChange);
  }, []);

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

      <div className="space-y-3">
        {/* Required: combined Terms acceptance and early-performance request */}
        <label
          className={`flex min-h-11 items-start gap-3 rounded-lg border bg-surface/50 p-3.5 transition-colors ${
            displayRequiredError ? "border-red-300" : "border-border"
          } ${
            disabled
              ? "cursor-not-allowed opacity-70"
              : "cursor-pointer hover:border-primary/40"
          }`}
        >
          <input
            type="checkbox"
            checked={requiredConsentChecked}
            disabled={disabled}
            onChange={(event) =>
              onChange(setRequiredOrderConsent(data, event.target.checked))
            }
            data-validation-control
            data-legal-acknowledgement="terms-and-early-performance"
            aria-required="true"
            aria-invalid={displayRequiredError || undefined}
            aria-describedby={
              displayRequiredError ? requiredErrorId : undefined
            }
            className="w-4 h-4 mt-0.5 rounded text-primary border-border focus:ring-primary flex-shrink-0 disabled:cursor-not-allowed"
          />
          <span className="text-sm text-foreground leading-relaxed">
            {requiredCopy.beforeTerms}
            <Link
              href={termsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm text-primary underline underline-offset-2 hover:text-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              {requiredCopy.termsLabel}
            </Link>
            {requiredCopy.afterTerms} <span className="text-red-500">*</span>
          </span>
        </label>
        {displayRequiredError && (
          <p
            id={requiredErrorId}
            role="alert"
            className="text-dashboard-metadata text-red-600"
          >
            {resolvedError}
          </p>
        )}

        {/* Optional: Portfolio permission */}
        <label
          className={`flex min-h-11 items-start gap-3 rounded-lg border border-border bg-white p-3.5 transition-colors ${
            disabled
              ? "cursor-not-allowed opacity-70"
              : "cursor-pointer hover:border-primary/40"
          }`}
        >
          <input
            type="checkbox"
            checked={data.allowPortfolio}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...data, allowPortfolio: event.target.checked })
            }
            className="w-4 h-4 mt-0.5 rounded text-primary border-border focus:ring-primary flex-shrink-0 disabled:cursor-not-allowed"
          />
          <span className="text-sm text-foreground leading-relaxed">
            {portfolioCopy.label}
            <span className="block text-dashboard-metadata text-muted mt-1">
              {portfolioCopy.supporting}
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
