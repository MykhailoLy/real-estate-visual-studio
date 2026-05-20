"use client";

import { formatUSD } from "@/lib/utils";

interface ItemSubtotalProps {
  totalCents: number;
}

export default function ItemSubtotal({ totalCents }: ItemSubtotalProps) {
  return (
    <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
      <span className="text-sm font-medium text-muted">Item Subtotal</span>
      <span className="text-base font-bold text-primary">
        {formatUSD(totalCents)}
      </span>
    </div>
  );
}
