export const TURNSTILE_SITE_KEY_ENV = "NEXT_PUBLIC_TURNSTILE_SITE_KEY";

export const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";

export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export type TurnstileAction =
  | "login"
  | "signup"
  | "password_reset"
  | "property_lead";

export type TurnstileCopy = {
  loading: string;
  required: string;
  failed: string;
  retry: string;
};

export const DEFAULT_TURNSTILE_COPY: TurnstileCopy = {
  loading: "Completing security check...",
  required: "Please complete the security check.",
  failed: "Security check failed. Please try again.",
  retry: "Retry security check",
};

export function normalizeTurnstileSiteKey(
  siteKey: string | null | undefined,
): string | null {
  const trimmed = siteKey?.trim();
  return trimmed ? trimmed : null;
}

export function getTurnstileSiteKeyFromEnv(): string | null {
  return normalizeTurnstileSiteKey(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

