// ============================================================
// ORDER ACCOUNT OWNERSHIP — shared server-side helpers (PR 1)
//
// Single source of truth for "which orders does this client own?".
//
// OWNERSHIP RULE
// ─────────────────────────────────────────────────────────
// An order is owned by the authenticated client when EITHER:
//   (a) orders.user_id === the authenticated user id           (strong)
//   (b) orders.user_id IS NULL AND orders.client_email matches
//       the verified session email, case-insensitively         (legacy)
//
// An order whose user_id is NON-NULL and belongs to a DIFFERENT
// user is NEVER owned — even if its client_email happens to equal
// this user's email. This closes the spoofing gap that pure
// email matching had before user_id existed.
//
// SECURITY CONTRACT
//   - `userId` and `email` MUST come from getClientUser() (the
//     server-validated Supabase SSR session). They are NEVER
//     accepted from the request body, query string, cookies, or
//     any other client-controlled input.
//
// These helpers are pure (no DB access) so they can be reused by
// every client-facing ownership check and unit-reasoned about.
// ============================================================

/** Verified identity of the authenticated client. */
export interface OrderOwnership {
  /** auth.users.id — matches orders.user_id. */
  userId: string;
  /** Confirmed session email — used for the legacy NULL fallback. */
  email: string;
}

/** The columns every ownership decision needs from an order row. */
export interface OwnableOrderRow {
  user_id?: string | null;
  client_email?: string | null;
}

/**
 * Build an `OrderOwnership` from a verified ClientUser (getClientUser()).
 * Keeps callers from constructing the object inline and accidentally
 * sourcing the id/email from anywhere untrusted.
 */
export function toOrderOwnership(user: {
  id: string;
  email: string;
}): OrderOwnership {
  return { userId: user.id, email: user.email };
}

/**
 * Escape PostgREST/PostgreSQL ILIKE metacharacters so a value is
 * matched literally (i.e. as case-insensitive equality, not as a
 * wildcard pattern). Emails may legitimately contain `_`, which ILIKE
 * would otherwise treat as "any single char".
 */
export function escapeIlikeLiteral(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}

/**
 * PostgREST `.or()` filter string for the `orders` table selecting
 * only rows the user owns:
 *
 *   user_id.eq.<id>,and(user_id.is.null,client_email.ilike.<email>)
 *
 * The email is ILIKE-escaped so the legacy branch behaves as exact
 * case-insensitive equality. Callers should ALSO apply isOrderOwned()
 * to the returned rows as defense-in-depth.
 */
export function ownedOrdersOrFilter(ownership: OrderOwnership): string {
  const email = escapeIlikeLiteral(ownership.email);
  return `user_id.eq.${ownership.userId},and(user_id.is.null,client_email.ilike.${email})`;
}

/**
 * Authoritative JS ownership predicate. Enforces the rule exactly,
 * regardless of how the row was fetched:
 *   - non-null user_id  → must equal the authenticated user id
 *   - null user_id      → client_email must equal the session email
 *                         (case-insensitive, trimmed)
 */
export function isOrderOwned(
  row: OwnableOrderRow,
  ownership: OrderOwnership,
): boolean {
  if (row.user_id != null && row.user_id !== "") {
    return row.user_id === ownership.userId;
  }
  const rowEmail = (row.client_email ?? "").trim().toLowerCase();
  const sessionEmail = ownership.email.trim().toLowerCase();
  return rowEmail.length > 0 && rowEmail === sessionEmail;
}
