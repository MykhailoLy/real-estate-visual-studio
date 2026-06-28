import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { SupportAssistantRateLimitUnavailableError } from "./types.ts";

export const SUPPORT_RATE_LIMIT_LOCAL_IDENTITY = "local-development";
export const SUPPORT_RATE_LIMIT_SECRET_MIN_LENGTH = 32;

export type SupportAssistantRuntimeEnv = Record<string, string | undefined>;

export type TrustedSupportClientIdentityResult =
  | { ok: true; identity: string }
  | { ok: false };

export function resolveTrustedSupportClientIdentity(
  request: Request,
  env: SupportAssistantRuntimeEnv = process.env,
): TrustedSupportClientIdentityResult {
  if (env.VERCEL === "1") {
    const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
    if (vercelForwardedFor !== null) {
      return trustedIpIdentity(vercelForwardedFor);
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor !== null) {
      return trustedIpIdentity(forwardedFor);
    }

    return { ok: false };
  }

  if (env.NODE_ENV !== "production") {
    return { ok: true, identity: SUPPORT_RATE_LIMIT_LOCAL_IDENTITY };
  }

  return { ok: false };
}

export function createSupportRateLimitIdentifier(
  identity: string,
  secret: string | undefined,
): string {
  const normalizedSecret = secret?.trim();
  if (
    !normalizedSecret ||
    normalizedSecret.length < SUPPORT_RATE_LIMIT_SECRET_MIN_LENGTH
  ) {
    throw new SupportAssistantRateLimitUnavailableError(
      "SUPPORT_RATE_LIMIT_SECRET is not configured.",
    );
  }

  return createHmac("sha256", normalizedSecret)
    .update(identity)
    .digest("hex");
}

function trustedIpIdentity(value: string): TrustedSupportClientIdentityResult {
  const candidate = value.split(",")[0]?.trim();
  if (!candidate || isIP(candidate) === 0) {
    return { ok: false };
  }

  return { ok: true, identity: candidate };
}
