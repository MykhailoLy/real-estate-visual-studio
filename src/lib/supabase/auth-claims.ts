export interface AuthenticatedSubjectClaims extends Record<string, unknown> {
  sub: string;
  role: "authenticated";
}

/**
 * Accept only authenticated-role claims with a non-empty subject. Callers
 * must pass claims already signature-verified by Supabase Auth's getClaims().
 */
export function hasVerifiedAuthenticatedSubject(
  claims: unknown,
): claims is AuthenticatedSubjectClaims {
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
    return false;
  }

  const claimRecord = claims as Record<string, unknown>;
  const subject = claimRecord.sub;
  return (
    typeof subject === "string" &&
    subject.trim().length > 0 &&
    claimRecord.role === "authenticated"
  );
}
