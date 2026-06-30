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
  | { ok: false; code: "production_only" | "load_failed" | "timeout" };

export interface CrispSupportHandoffOptions {
  language: SupportChatLanguage;
  name: string;
  email: string;
  pagePath: string;
  contextMessage: string;
  hostname?: string;
  sdkLoader?: () => Promise<PicchuSpotCrispSdk>;
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
    onLoaded(callback: () => void): void;
    offLoaded(): void;
  };
  message: {
    sendText(content: string): void;
  };
  chat: {
    show(): void;
    open(): void;
  };
}

let configured = false;
let activated = false;
let activeAttempt: Promise<CrispSupportResult> | null = null;
let contextSent = false;

export async function startCrispSupportHandoff(
  options: CrispSupportHandoffOptions,
): Promise<CrispSupportResult> {
  const hostname = options.hostname ?? getCurrentHostname();
  if (!isCrispProductionHostname(hostname)) {
    return { ok: false, code: "production_only" };
  }

  if (activated) {
    const sdk = await (options.sdkLoader ?? loadCrispSdk)();
    sdk.chat.show();
    sdk.chat.open();
    return { ok: true };
  }

  if (activeAttempt) return activeAttempt;

  activeAttempt = runCrispHandoff(options).then((result) => {
    if (result.ok) {
      activated = true;
      return result;
    }

    activeAttempt = null;
    return result;
  });

  return activeAttempt;
}

export function resetCrispSupportClientForTests() {
  configured = false;
  activated = false;
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
  timeoutMs = CRISP_LOAD_TIMEOUT_MS,
}: CrispSupportHandoffOptions): Promise<CrispSupportResult> {
  let sdk: PicchuSpotCrispSdk;

  try {
    sdk = await sdkLoader();
  } catch {
    return { ok: false, code: "load_failed" };
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
    return { ok: false, code: "load_failed" };
  }

  const loaded = await loadCrispSession(sdk, timeoutMs);
  if (!loaded.ok) return loaded;

  try {
    if (!contextSent) {
      sdk.message.sendText(contextMessage);
      contextSent = true;
    }
    sdk.chat.show();
    sdk.chat.open();
    return { ok: true };
  } catch {
    return { ok: false, code: "load_failed" };
  }
}

function loadCrispSession(
  sdk: PicchuSpotCrispSdk,
  timeoutMs: number,
): Promise<CrispSupportResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: CrispSupportResult) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      sdk.session.offLoaded();
      resolve(result);
    };

    try {
      sdk.session.onLoaded(() => finish({ ok: true }));
      timeoutId = setTimeout(
        () => finish({ ok: false, code: "timeout" }),
        timeoutMs,
      );
      sdk.load();
    } catch {
      finish({ ok: false, code: "load_failed" });
    }
  });
}

async function loadCrispSdk(): Promise<PicchuSpotCrispSdk> {
  const { Crisp } = await import("crisp-sdk-web");
  return Crisp as unknown as PicchuSpotCrispSdk;
}

function getCurrentHostname() {
  return typeof window === "undefined" ? "" : window.location.hostname;
}
