export interface AuthenticatedSubjectClaims extends Record<string, unknown> {
  sub: string;
}

/**
 * Accept only claims with a non-empty subject. Callers must pass claims that
 * have already been signature-verified by Supabase Auth's getClaims().
 */
export function hasVerifiedAuthenticatedSubject(
  claims: unknown,
): claims is AuthenticatedSubjectClaims {
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
    return false;
  }

  const subject = (claims as Record<string, unknown>).sub;
  return typeof subject === "string" && subject.trim().length > 0;
}
