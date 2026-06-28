"use client";

import Link from "next/link";
import { useId } from "react";
import { ShieldCheck } from "lucide-react";
import { TERMS_VERSION } from "@/lib/order-terms";

/**
 * Order-level terms acceptance block.
 *
 * Rendered on every order page after item cards and contact details and
 * before the final Submit Order action. Contains a REQUIRED Terms &
 * Conditions checkbox and an OPTIONAL portfolio-permission checkbox.
 * Pricing and order calculations are not affected by either.
 */

export { TERMS_VERSION };

export interface OrderTermsData {
  /** Required: must be true to enable Submit Order. */
  accepted: boolean;
  /**
   * Optional: client lets us use anonymized before/after examples from
   * this order in our portfolio or marketing materials.
   */
  allowPortfolio: boolean;
}

export const emptyOrderTerms: OrderTermsData = {
  accepted: false,
  allowPortfolio: false,
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
  errorMessage = "Accept the terms before submitting.",
}: OrderTermsBlockProps) {
  const errorId = `${useId()}-terms-error`;
  const displayError = showError && !data.accepted;
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
            displayError ? "border-red-300" : "border-border"
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
            aria-invalid={displayError || undefined}
            aria-describedby={displayError ? errorId : undefined}
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
        {displayError && (
          <p id={errorId} role="alert" className="-mt-2 text-xs text-red-600">
            {errorMessage}
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
