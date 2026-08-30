import { ArrowRight } from "lucide-react";

interface OrderReviewActionProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

/** Shared configure-stage progression area for two-step order flows. */
export default function OrderReviewAction({
  children,
  onClick,
  disabled = false,
}: OrderReviewActionProps) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-7 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 max-w-2xl text-sm leading-6 text-muted">
        {children}
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-56"
      >
        Review Order
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
