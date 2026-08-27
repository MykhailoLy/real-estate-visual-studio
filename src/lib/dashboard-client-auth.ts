import "server-only";

import { mapDashboardClientUserFromClaims } from "@/lib/dashboard-client-auth-utils";
import type { ClientUser } from "@/lib/client-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Read verified, presentation-only identity for the dashboard shell.
 * Order ownership and other security-sensitive paths continue to use
 * getClientUser(), which fetches the current Auth user record.
 */
export async function getDashboardClientUserFromClaims(): Promise<ClientUser | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error || !data) return null;
    return mapDashboardClientUserFromClaims(data.claims);
  } catch {
    return null;
  }
}
