"use client";

import { CheckCircle2, Mail } from "lucide-react";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import OrderPaymentPanel from "@/components/payments/OrderPaymentPanel";

interface ConfirmationProps {
  orderId: string;
  orderNumber: string;
  email: string;
  /** Order-level Job Title to echo back on the confirmation screen. */
  jobTitle?: string;
  /**
   * True when the post-submit confirmation email was actually
   * accepted by Resend. We only surface "we emailed you" when this
   * is true so we never lie to the user if email is misconfigured
   * or transiently down — the order is saved either way.
   */
  confirmationEmailSent?: boolean;
  onNewOrder: () => void;
}

export default function Confirmation({
  orderId,
  orderNumber,
  email,
  jobTitle,
  confirmationEmailSent,
  onNewOrder,
}: ConfirmationProps) {
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">
        Order received
      </h2>

      <p className="text-muted mb-6 leading-relaxed">
        Order <span className="font-semibold text-foreground">{orderNumber}</span>{" "}
        has been securely recorded. Review the payment status below before
        leaving this page.
      </p>

      {jobTitle?.trim() ? (
        <p className="text-sm text-foreground mb-6">
          <span className="text-muted">Job title: </span>
          <span className="font-semibold">{jobTitle.trim()}</span>
        </p>
      ) : null}

      {confirmationEmailSent && email ? (
        <div className="inline-flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 mb-6 text-sm text-left">
          <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            A confirmation email has been sent to{" "}
            <span className="font-semibold break-all">{email}</span>.
          </span>
        </div>
      ) : null}

      <div className="mb-8">
        <OrderPaymentPanel
          orderId={orderId}
          secondaryHref={`/dashboard/jobs/${encodeURIComponent(orderId)}`}
          secondaryLabel="View order"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onNewOrder}
          className="px-6 py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary-light transition-colors"
        >
          Place Another Order
        </button>
        <ClientPortalLink
          href="/dashboard/jobs"
          className="px-6 py-3 border border-border text-foreground rounded-lg font-semibold text-sm hover:bg-surface transition-colors"
        >
          Back to jobs
        </ClientPortalLink>
      </div>
    </div>
  );
}
