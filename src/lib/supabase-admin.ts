import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class SupabaseAdminConfigurationError extends Error {
  constructor(message = "Supabase admin client is not configured.") {
    super(message);
    this.name = "SupabaseAdminConfigurationError";
  }
}

export function getSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new SupabaseAdminConfigurationError(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
