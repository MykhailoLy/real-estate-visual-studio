// ============================================================
// CLIENT AUTH — pure utility helpers
//
// Split out from client-auth.ts so client components can import
// getInitials() without pulling in the next/headers dependency
// that lives in getClientUser() / isClientAuthenticated().
//
// Safe to import from both server and client components.
// ============================================================

/**
 * Build initials from a display name or email address.
 * "John Smith"       → "JS"
 * "jane@example.com" → "JA"
 * "alice"            → "AL"
 */
export function getInitials(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}
