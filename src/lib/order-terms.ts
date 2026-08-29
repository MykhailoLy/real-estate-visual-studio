import { LEGAL_VERSION } from "@/lib/legal";

export const TERMS_VERSION = LEGAL_VERSION;

export type CurrentTermsAcceptance = {
  accepted: true;
  version: typeof TERMS_VERSION;
};

export type CurrentTermsAcceptanceResult =
  | { ok: true; acceptance: CurrentTermsAcceptance }
  | { ok: false; reason: "not_accepted" | "version_mismatch" };

/**
 * Treats the browser value as a version handshake only. Callers may use the
 * returned acceptance in trusted persistence and fingerprint inputs.
 */
export function resolveCurrentTermsAcceptance(input: {
  accepted: boolean;
  version?: string | null;
}): CurrentTermsAcceptanceResult {
  if (!input.accepted) {
    return { ok: false, reason: "not_accepted" };
  }
  if (input.version !== TERMS_VERSION) {
    return { ok: false, reason: "version_mismatch" };
  }
  return {
    ok: true,
    acceptance: {
      accepted: true,
      version: TERMS_VERSION,
    },
  };
}
