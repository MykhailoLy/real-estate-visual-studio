"use client";

import type { SupportChatLanguage } from "./support-chat-copy.ts";
import { isCrispProductionHostname } from "./support-handoff.ts";

export { isCrispProductionHostname };

export const CRISP_WEBSITE_ID = "e6bb27b3-4a95-47d7-ad37-5fb0a741847f";
export const CRISP_COOKIE_DOMAIN = "picchuspot.com";
export const CRISP_COOKIE_EXPIRE_SECONDS = 2592000;
export const CRISP_LOAD_TIMEOUT_MS = 10000;

export type CrispSupportResult =
  | { ok: true }
  | {
      ok: false;
      code: "production_only" | "load_failed" | "timeout" | "cancelled";
    };

export interface CrispSupportHandoffOptions {
  language: SupportChatLanguage;
  name: string;
  email: string;
  pagePath: string;
  contextMessage: string;
  hostname?: string;
  sdkLoader?: () => Promise<PicchuSpotCrispSdk>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface PicchuSpotCrispSdk {
  configure(
    websiteId: string,
    options: {
      autoload: false;
      locale: SupportChatLanguage;
      cookieDomain: typeof CRISP_COOKIE_DOMAIN;
      cookieExpire: typeof CRISP_COOKIE_EXPIRE_SECONDS;
      safeMode: true;
    },
  ): void;
  load(): void;
  setAvailabilityTooltip(enabled: boolean): void;
  toggleOperatorCount(enabled: boolean): void;
  setPosition(position: "right"): void;
  setHideOnMobile(enabled: boolean): void;
  user: {
    setNickname(nickname: string): void;
    setEmail(email: string): void;
  };
  session: {
    setData(data: Record<string, boolean | string>): void;
    getIdentifier(): string | null;
    onLoaded(callback: () => void): void;
    offLoaded(): void;
  };
  message: {
    sendText(content: string): void;
  };
  chat: {
    show(): void;
    open(): void;
    close(): void;
    hide(): void;
  };
}

interface ActiveAttempt {
  promise: Promise<CrispSupportResult>;
  signal?: AbortSignal;
  token: symbol;
}

let configured = false;
let activated = false;
let activeSdk: PicchuSpotCrispSdk | null = null;
let activeAttempt: ActiveAttempt | null = null;
let contextSent = false;

export async function startCrispSupportHandoff(
  options: CrispSupportHandoffOptions,
): Promise<CrispSupportResult> {
  const hostname = options.hostname ?? getCurrentHostname();
  if (!isCrispProductionHostname(hostname)) {
    return { ok: false, code: "production_only" };
  }

  if (isSignalCancelled(options.signal)) {
    return { ok: false, code: "cancelled" };
  }

  if (activated && activeSdk) {
    if (isSignalCancelled(options.signal)) {
      return { ok: false, code: "cancelled" };
    }

    try {
      activeSdk.chat.show();
      activeSdk.chat.open();
      return { ok: true };
    } catch {
      safeCloseAndHideCrisp(activeSdk);
      return { ok: false, code: "load_failed" };
    }
  }

  if (activeAttempt && !isSignalCancelled(activeAttempt.signal)) {
    return activeAttempt.promise;
  }

  const token = Symbol("crisp-support-attempt");
  const promise = runCrispHandoff(options)
    .catch<CrispSupportResult>(() => ({ ok: false, code: "load_failed" }))
    .finally(() => {
      if (activeAttempt?.token === token) {
        activeAttempt = null;
      }
    });

  activeAttempt = {
    promise,
    signal: options.signal,
    token,
  };

  return promise;
}

export function setActiveCrispSupportVisibility(visible: boolean) {
  if (!activated || !activeSdk) return;

  try {
    if (visible) {
      activeSdk.chat.show();
      return;
    }

    activeSdk.chat.close();
    activeSdk.chat.hide();
  } catch {
    // Visibility changes should never interrupt route transitions.
  }
}

export function resetCrispSupportClientForTests() {
  configured = false;
  activated = false;
  activeSdk = null;
  activeAttempt = null;
  contextSent = false;
}

async function runCrispHandoff({
  language,
  name,
  email,
  pagePath,
  contextMessage,
  sdkLoader = loadCrispSdk,
  signal,
  timeoutMs = CRISP_LOAD_TIMEOUT_MS,
}: CrispSupportHandoffOptions): Promise<CrispSupportResult> {
  if (isSignalCancelled(signal)) {
    return { ok: false, code: "cancelled" };
  }

  let sdk: PicchuSpotCrispSdk;

  try {
    sdk = await sdkLoader();
  } catch {
    return { ok: false, code: "load_failed" };
  }

  if (isSignalCancelled(signal)) {
    safeCloseAndHideCrisp(sdk);
    return { ok: false, code: "cancelled" };
  }

  try {
    if (!configured) {
      sdk.configure(CRISP_WEBSITE_ID, {
        autoload: false,
        locale: language,
        cookieDomain: CRISP_COOKIE_DOMAIN,
        cookieExpire: CRISP_COOKIE_EXPIRE_SECONDS,
        safeMode: true,
      });
      configured = true;
    }

    sdk.setAvailabilityTooltip(false);
    sdk.toggleOperatorCount(false);
    sdk.setPosition("right");
    sdk.setHideOnMobile(false);

    if (isSignalCancelled(signal)) {
      safeCloseAndHideCrisp(sdk);
      return { ok: false, code: "cancelled" };
    }

    if (name) {
      sdk.user.setNickname(name);
    }
    sdk.user.setEmail(email);
    sdk.session.setData({
      picchuspot_handoff: true,
      picchuspot_locale: language,
      picchuspot_page: pagePath,
    });
  } catch {
    safeCloseAndHideCrisp(sdk);
    return { ok: false, code: "load_failed" };
  }

  if (isSignalCancelled(signal)) {
    safeCloseAndHideCrisp(sdk);
    return { ok: false, code: "cancelled" };
  }

  const loaded = await loadCrispSession(sdk, timeoutMs, signal);
  if (!loaded.ok) {
    safeCloseAndHideCrisp(sdk);
    return loaded;
  }

  if (isSignalCancelled(signal)) {
    safeCloseAndHideCrisp(sdk);
    return { ok: false, code: "cancelled" };
  }

  try {
    if (!contextSent) {
      sdk.message.sendText(contextMessage);
      contextSent = true;
    }

    if (isSignalCancelled(signal)) {
      safeCloseAndHideCrisp(sdk);
      return { ok: false, code: "cancelled" };
    }

    sdk.chat.show();
    sdk.chat.open();
    activated = true;
    activeSdk = sdk;
    return { ok: true };
  } catch {
    safeCloseAndHideCrisp(sdk);
    return { ok: false, code: "load_failed" };
  }
}

function loadCrispSession(
  sdk: PicchuSpotCrispSdk,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<CrispSupportResult> {
  if (isSignalCancelled(signal)) {
    return Promise.resolve({ ok: false, code: "cancelled" });
  }

  if (safeGetSessionIdentifier(sdk)) {
    return Promise.resolve({ ok: true });
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: CrispSupportResult) => {
      if (settled) return;
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      try {
        signal?.removeEventListener("abort", onAbort);
      } catch {
        // Cleanup is best-effort so handoff resolution is never blocked.
      }
      safeOffLoaded(sdk);
      resolve(result);
    };

    const onAbort = () => finish({ ok: false, code: "cancelled" });

    try {
      sdk.session.onLoaded(() => finish({ ok: true }));
      timeoutId = setTimeout(
        () => finish({ ok: false, code: "timeout" }),
        timeoutMs,
      );
      signal?.addEventListener("abort", onAbort, { once: true });

      if (isSignalCancelled(signal)) {
        finish({ ok: false, code: "cancelled" });
        return;
      }

      sdk.load();
      sdk.chat.close();
      sdk.chat.hide();

      if (safeGetSessionIdentifier(sdk)) {
        finish({ ok: true });
      }
    } catch {
      safeCloseAndHideCrisp(sdk);
      finish({ ok: false, code: "load_failed" });
    }
  });
}

function safeGetSessionIdentifier(sdk: PicchuSpotCrispSdk) {
  try {
    const sessionId = sdk.session.getIdentifier();
    return typeof sessionId === "string" && sessionId.trim()
      ? sessionId
      : null;
  } catch {
    return null;
  }
}

function safeOffLoaded(sdk: PicchuSpotCrispSdk) {
  try {
    sdk.session.offLoaded();
  } catch {
    // Listener cleanup must never prevent success, timeout, or cancellation.
  }
}

function safeCloseAndHideCrisp(sdk: PicchuSpotCrispSdk) {
  try {
    sdk.chat.close();
  } catch {
    // Best-effort UI suppression only.
  }

  try {
    sdk.chat.hide();
  } catch {
    // Best-effort UI suppression only.
  }
}

function isSignalCancelled(signal: AbortSignal | undefined) {
  return signal?.aborted === true;
}

async function loadCrispSdk(): Promise<PicchuSpotCrispSdk> {
  const { Crisp } = await import("crisp-sdk-web");
  return Crisp as unknown as PicchuSpotCrispSdk;
}

function getCurrentHostname() {
  return typeof window === "undefined" ? "" : window.location.hostname;
}
