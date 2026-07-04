"use client";

import Script from "next/script";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  DEFAULT_TURNSTILE_COPY,
  TURNSTILE_SCRIPT_ID,
  TURNSTILE_SCRIPT_SRC,
  normalizeTurnstileSiteKey,
  type TurnstileAction,
  type TurnstileCopy,
} from "@/components/auth/turnstile";

type TurnstileStatus = "loading" | "ready" | "error";

export default function TurnstileWidget({
  siteKey,
  action,
  resetSignal = 0,
  copy = DEFAULT_TURNSTILE_COPY,
  onTokenChange,
}: {
  siteKey: string | null | undefined;
  action: TurnstileAction;
  resetSignal?: number;
  copy?: TurnstileCopy;
  onTokenChange: (token: string | null) => void;
}) {
  const normalizedSiteKey = normalizeTurnstileSiteKey(siteKey);
  const statusId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  const [scriptAttempt, setScriptAttempt] = useState(0);
  const [scriptReady, setScriptReady] = useState(false);
  const [status, setStatus] = useState<TurnstileStatus>("loading");

  const clearToken = useCallback(() => {
    onTokenChange(null);
  }, [onTokenChange]);

  const renderWidget = useCallback(() => {
    if (!normalizedSiteKey || !containerRef.current || widgetIdRef.current) {
      return;
    }

    if (typeof window === "undefined" || !window.turnstile) {
      return;
    }

    try {
      setStatus("loading");
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: normalizedSiteKey,
        action,
        callback: (token) => {
          setStatus("ready");
          onTokenChange(token);
        },
        "expired-callback": () => {
          setStatus("loading");
          clearToken();
        },
        "error-callback": () => {
          setStatus("error");
          clearToken();
        },
      });
    } catch {
      setStatus("error");
      clearToken();
    }
  }, [action, clearToken, normalizedSiteKey, onTokenChange]);

  const resetWidget = useCallback(() => {
    clearToken();
    setStatus("loading");

    if (typeof window === "undefined" || !window.turnstile) {
      return;
    }

    const widgetId = widgetIdRef.current;

    try {
      if (widgetId && window.turnstile.reset) {
        window.turnstile.reset(widgetId);
        return;
      }

      if (widgetId && window.turnstile.remove) {
        window.turnstile.remove(widgetId);
        widgetIdRef.current = null;
      }

      renderWidget();
    } catch {
      setStatus("error");
      clearToken();
    }
  }, [clearToken, renderWidget]);

  const retryWidget = useCallback(() => {
    if (typeof window !== "undefined" && !window.turnstile) {
      clearToken();
      setScriptReady(false);
      setStatus("loading");
      widgetIdRef.current = null;

      document
        .querySelectorAll(`script[src="${TURNSTILE_SCRIPT_SRC}"]`)
        .forEach((script) => script.remove());
      setScriptAttempt((value) => value + 1);
      return;
    }

    resetWidget();
  }, [clearToken, resetWidget]);

  useEffect(() => {
    if (!normalizedSiteKey || !scriptReady) return;

    let active = true;
    queueMicrotask(() => {
      if (active) renderWidget();
    });

    return () => {
      active = false;
      const widgetId = widgetIdRef.current;
      widgetIdRef.current = null;
      clearToken();

      if (
        widgetId &&
        typeof window !== "undefined" &&
        window.turnstile?.remove
      ) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [clearToken, normalizedSiteKey, renderWidget, scriptReady]);

  useEffect(() => {
    if (!normalizedSiteKey) return;

    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    queueMicrotask(() => {
      resetWidget();
    });
  }, [normalizedSiteKey, resetSignal, resetWidget]);

  if (!normalizedSiteKey) {
    return null;
  }

  const scriptId =
    scriptAttempt === 0
      ? TURNSTILE_SCRIPT_ID
      : `${TURNSTILE_SCRIPT_ID}-${scriptAttempt}`;

  return (
    <div className="space-y-2">
      <Script
        key={scriptId}
        id={scriptId}
        src={TURNSTILE_SCRIPT_SRC}
        strategy="afterInteractive"
        onReady={() => {
          setScriptReady(true);
        }}
        onError={() => {
          setStatus("error");
          clearToken();
        }}
      />

      <div className="min-h-[78px] flex items-center justify-center">
        <div
          ref={containerRef}
          className="min-h-[65px]"
          aria-describedby={statusId}
        />
      </div>

      {status === "loading" && (
        <p
          id={statusId}
          role="status"
          aria-live="polite"
          className="text-center text-xs text-muted"
        >
          {copy.loading}
        </p>
      )}

      {status === "ready" && (
        <p id={statusId} className="sr-only">
          Security check complete.
        </p>
      )}

      {status === "error" && (
        <div
          id={statusId}
          role="alert"
          className="flex items-start justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-relaxed text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          <div className="space-y-1">
            <p>{copy.failed}</p>
            <button
              type="button"
              onClick={retryWidget}
              className="font-semibold text-red-800 underline underline-offset-2 transition-colors hover:text-red-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
            >
              {copy.retry}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
