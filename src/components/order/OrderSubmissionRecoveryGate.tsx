"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  recoverAnyAmbiguousOrderSubmission,
  type OrderSubmissionRecoveryResult,
} from "@/lib/orders/submission-recovery";

type GateState =
  | { status: "checking" }
  | { status: "ready"; notice?: string }
  | Exclude<OrderSubmissionRecoveryResult, { status: "none" | "unavailable" }>;

export default function OrderSubmissionRecoveryGate({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<GateState>({ status: "checking" });

  const applyRecovery = useCallback((result: OrderSubmissionRecoveryResult) => {
    if (result.status === "none") {
      setState({ status: "ready" });
      return;
    }
    if (result.status === "unavailable") {
      setState({
        status: "ready",
        notice: "The previous submission is unavailable. Review the order before starting a new submission.",
      });
      return;
    }
    setState(result);
    if (result.status === "committed") {
      window.location.replace(`/dashboard/jobs/${encodeURIComponent(result.orderId)}`);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void recoverAnyAmbiguousOrderSubmission().then((result) => {
      if (active) applyRecovery(result);
    });
    return () => {
      active = false;
    };
  }, [applyRecovery]);

  const checkAgain = useCallback(async () => {
    setState({ status: "checking" });
    applyRecovery(await recoverAnyAmbiguousOrderSubmission());
  }, [applyRecovery]);

  if (state.status === "ready") {
    return (
      <>
        {state.notice && (
          <div className="mx-auto mt-6 max-w-5xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {state.notice}
          </div>
        )}
        {children}
      </>
    );
  }

  const message = state.status === "committed"
    ? `Order ${state.orderNumber} was already created. Opening it now…`
    : state.status === "processing"
      ? "Your previous order submission is still processing. No files or order data have been changed."
      : state.status === "unauthorized"
        ? "Sign in again to check the previous order submission before starting another."
        : state.status === "error"
          ? "The previous order outcome could not be confirmed. No new submission has been started."
          : "Checking the previous order submission…";

  return (
    <section className="min-h-[50vh] bg-surface px-4 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-navy">Recovering your order</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        {(state.status === "processing" || state.status === "error") && (
          <button
            type="button"
            onClick={() => void checkAgain()}
            className="mt-5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
          >
            Check again
          </button>
        )}
        {state.status === "unauthorized" && (
          <a
            href="/login?redirectTo=%2Fdashboard%2Forders%2Fnew"
            className="mt-5 inline-flex rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
          >
            Sign in
          </a>
        )}
      </div>
    </section>
  );
}
