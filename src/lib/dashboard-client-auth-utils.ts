import type { ClientUser } from "./client-auth.ts";
import { hasVerifiedAuthenticatedSubject } from "./supabase/auth-claims.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Map verified JWT claims to presentation-only dashboard identity fields. */
export function mapDashboardClientUserFromClaims(
  claims: unknown,
): ClientUser | null {
  if (!hasVerifiedAuthenticatedSubject(claims)) return null;

  const email = typeof claims.email === "string" ? claims.email : "";
  const meta = isRecord(claims.user_metadata) ? claims.user_metadata : {};
  const emailName = email.split("@")[0];
  const rawName =
    typeof meta.full_name === "string" && meta.full_name.trim()
      ? meta.full_name.trim()
      : emailName || "Client";
  const avatarCandidate =
    typeof meta.avatar_url === "string"
      ? meta.avatar_url
      : typeof meta.picture === "string"
        ? meta.picture
        : null;
  let avatarUrl: string | null = null;
  if (avatarCandidate) {
    try {
      const parsed = new URL(avatarCandidate);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        avatarUrl = parsed.toString();
      }
    } catch {
      avatarUrl = null;
    }
  }

  return {
    id: claims.sub,
    email,
    displayName: rawName,
    firstName: rawName.split(" ")[0],
    avatarUrl,
  };
}
