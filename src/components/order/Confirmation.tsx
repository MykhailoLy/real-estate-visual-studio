"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

interface ConfirmationProps {
  orderNumber: string;
  email: string;
  onNewOrder: () => void;
}

export default function Confirmation({
  orderNumber,
  email,
  onNewOrder,
}: ConfirmationProps) {
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">
        Thank You! Order {orderNumber} Received.
      </h2>

      <p className="text-muted mb-6 leading-relaxed">
        Your order has been received. We&apos;ll review your files and contact
        you shortly to confirm the final details.
      </p>

      <div className="bg-surface border border-border rounded-xl p-5 mb-8 text-left">
        <h3 className="text-sm font-semibold text-foreground mb-2">
          What happens next?
        </h3>
        <ol className="text-sm text-muted space-y-2 list-decimal list-inside">
          <li>We review your uploaded files and instructions</li>
          <li>We confirm the final price and send an invoice</li>
          <li>Once paid, our team begins work immediately</li>
          <li>You receive completed files within 24-48 hours</li>
        </ol>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onNewOrder}
          className="px-6 py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary-light transition-colors"
        >
          Place Another Order
        </button>
        <Link
          href="/"
          className="px-6 py-3 border border-border text-foreground rounded-lg font-semibold text-sm hover:bg-surface transition-colors"
        >
          Back to Homepage
        </Link>
      </div>
    </div>
  );
}
