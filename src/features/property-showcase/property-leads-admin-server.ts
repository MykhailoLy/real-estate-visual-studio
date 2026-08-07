import "server-only";

import { createServerClient } from "@/lib/supabase";
import {
  isMissingPropertyLeadsSchemaError,
  resolvePropertyLeadsForAdmin,
  type AdminPropertyLeadsResult,
  type PropertyLeadDatabaseRow,
  type PropertyLeadQueryResponse,
} from "./property-leads-admin";

type PropertyLeadAdminQuery = () => Promise<PropertyLeadQueryResponse>;

export type { AdminPropertyLead, AdminPropertyLeadsResult } from "./property-leads-admin";

export function isPropertyLeadsSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function queryPropertyLeads(): Promise<PropertyLeadQueryResponse> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("property_leads")
    .select(
      "id, property_slug, name, email, phone, preferred_date, preferred_time, message, locale, source, created_at, notification_email_status",
    )
    .order("created_at", { ascending: false });

  return {
    data: (data ?? null) as PropertyLeadDatabaseRow[] | null,
    error: error ? { code: error.code } : null,
  };
}

export async function getPropertyLeadsForAdmin(options: {
  configured?: boolean;
  query?: PropertyLeadAdminQuery;
} = {}): Promise<AdminPropertyLeadsResult> {
  const configured = options.configured ?? isPropertyLeadsSupabaseConfigured();
  if (!configured) return resolvePropertyLeadsForAdmin({ configured });

  try {
    const { data, error } = await (options.query ?? queryPropertyLeads)();
    if (error && !isMissingPropertyLeadsSchemaError(error)) {
      console.error("property-leads: admin inbox unavailable", {
        code: error.code ?? "unknown",
      });
    }

    return resolvePropertyLeadsForAdmin({ configured, response: { data, error } });
  } catch {
    console.error("property-leads: admin inbox init failed");
    return resolvePropertyLeadsForAdmin({ configured });
  }
}
