import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase-admin.ts";

export class AccountPricingError extends Error {
  constructor() {
    super("Account pricing could not be verified. Please retry.");
    this.name = "AccountPricingError";
  }
}

/** userId must come from the verified session or an admin's server-loaded order. */
export async function getPartnerClient(
  userId: string,
  supabase: SupabaseClient = getSupabaseAdminClient(),
): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("account_pricing")
      .select("partner_client").eq("user_id", userId).maybeSingle();
    if (error || (data !== null && typeof data?.partner_client !== "boolean")) {
      throw new AccountPricingError();
    }
    return data?.partner_client ?? false;
  } catch {
    throw new AccountPricingError();
  }
}
