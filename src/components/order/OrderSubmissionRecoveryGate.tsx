"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ORDER_SUBMISSION_RECOVERY_EVENT,
  recoverAnyAmbiguousOrderSubmission,
  type OrderSubmissionRecoveryResult,
} from "@/lib/orders/submission-recovery";
import { retryOrderSubmission } from "@/lib/submit-order";

type GateState =
  | { status: "checking" | "retrying" }
  | { status: "ready" }
  | Exclude<OrderSubmissionRecoveryResult, { status: "none" }>;

export default function OrderSubmissionRecoveryGate({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<GateState>({ status: "checking" });
  const [retryError, setRetryError] = useState<string>();
  const busy = useRef(false);

  const applyRecovery = useCallback((result: OrderSubmissionRecoveryResult) => {
    if (result.status === "none") {
      setState({ status: "ready" });
      return;
    }
    setState(result);
    if (result.status === "committed") {
      window.location.replace(`/dashboard/jobs/${encodeURIComponent(result.orderId)}`);
    }
  }, []);

  const checkAgain = useCallback(async (showChecking = true) => {
    if (busy.current) return;
    busy.current = true;
    if (showChecking) setState({ status: "checking" });
    try {
      applyRecovery(await recoverAnyAmbiguousOrderSubmission());
    } finally {
      busy.current = false;
    }
  }, [applyRecovery]);

  useEffect(() => {
    let active = true;
    void recoverAnyAmbiguousOrderSubmission().then((result) => {
      if (active) applyRecovery(result);
    });
    return () => {
      active = false;
    };
  }, [applyRecovery]);

  useEffect(() => {
    // Local validation/upload errors have no uncertain POST. Keep the current
    // form (including File objects) mounted unless recovery actually blocks it.
    const recover = () => { void checkAgain(false); };
    window.addEventListener(ORDER_SUBMISSION_RECOVERY_EVENT, recover);
    return () => window.removeEventListener(ORDER_SUBMISSION_RECOVERY_EVENT, recover);
  }, [checkAgain]);

  const retryOriginal = async () => {
    if (state.status !== "retryable" || !state.canRetry || busy.current) return;
    busy.current = true;
    setRetryError(undefined);
    setState({ status: "retrying" });
    try {
      const result = await retryOrderSubmission(state.serviceType);
      if (result.success && result.orderId && result.orderNumber) {
        applyRecovery({ status: "committed", submissionId: state.submissionId, orderId: result.orderId, orderNumber: result.orderNumber });
      } else if (result.errorCode === "unauthorized") {
        applyRecovery({ status: "unauthorized", submissionId: state.submissionId });
      } else {
        setRetryError(result.error);
        applyRecovery(await recoverAnyAmbiguousOrderSubmission());
      }
    } finally {
      busy.current = false;
    }
  };

  if (state.status === "ready") {
    return <>{children}</>;
  }

  const message = state.status === "committed"
    ? `Order ${state.orderNumber} was already created. Opening it now…`
    : state.status === "processing"
      ? "Your previous order submission is still processing. No files or order data have been changed."
      : state.status === "retrying"
        ? "Retrying your original order submission with its saved details and uploaded files…"
      : state.status === "retryable"
        ? state.canRetry
          ? "You can retry the original submission. We will use its saved details and uploaded files and check for an existing order before creating one."
          : "This earlier submission does not include the saved order details needed for a safe retry. Check again for an existing order, or contact support with the submission ID below."
      : state.status === "unauthorized"
        ? "Sign in again to check the previous order submission before starting another."
        : state.status === "error"
          ? "The previous order outcome could not be confirmed. No new submission has been started."
          : "Checking the previous order submission…";

  return (
    <section className="min-h-[50vh] bg-surface px-4 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-primary">Recovering your order</h1>
        <p role="status" className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        {retryError && <p role="alert" className="mt-3 text-sm text-amber-900">{retryError}</p>}
        {state.status === "retryable" && !state.canRetry && (
          <p className="mt-3 break-all text-xs text-slate-500">Submission ID: {state.submissionId}</p>
        )}
        {state.status === "retryable" && state.canRetry && (
          <button
            type="button"
            onClick={() => void retryOriginal()}
            className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
          >
            Retry original submission
          </button>
        )}
        {(state.status === "processing" || state.status === "error" || state.status === "retryable") && (
          <button
            type="button"
            onClick={() => void checkAgain()}
            className="mx-2 mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
          >
            Check again
          </button>
        )}
        {state.status === "unauthorized" && (
          // Full navigation preserves the existing session-recovery boundary; [locale] overmatches in Next lint.
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a
            href="/login?redirectTo=%2Fdashboard%2Forders%2Fnew"
            className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
          >
            Sign in
          </a>
        )}
      </div>
    </section>
  );
}
