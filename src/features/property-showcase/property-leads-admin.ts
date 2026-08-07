const MISSING_SCHEMA_CODES = new Set(["42P01", "PGRST205"]);

export interface AdminPropertyLead {
  id: string;
  propertySlug: string;
  name: string;
  email: string;
  phone: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  message: string | null;
  locale: string;
  source: string;
  createdAt: string;
  notificationEmailStatus: string | null;
}

export interface PropertyLeadDatabaseRow {
  id: string;
  property_slug: string;
  name: string;
  email: string;
  phone: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  message: string | null;
  locale: string;
  source: string;
  created_at: string;
  notification_email_status: string | null;
}

export type PropertyLeadQueryResponse = {
  data: PropertyLeadDatabaseRow[] | null;
  error: { code?: string | null } | null;
};

export type AdminPropertyLeadsResult =
  | { state: "ready"; leads: AdminPropertyLead[] }
  | { state: "unconfigured"; leads: [] }
  | { state: "unavailable"; leads: [] };

export function sortPropertyLeadsNewestFirst(
  leads: AdminPropertyLead[],
): AdminPropertyLead[] {
  return [...leads].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function toAdminPropertyLead(row: PropertyLeadDatabaseRow): AdminPropertyLead {
  return {
    id: row.id,
    propertySlug: row.property_slug,
    name: row.name,
    email: row.email,
    phone: row.phone,
    preferredDate: row.preferred_date,
    preferredTime: row.preferred_time,
    message: row.message,
    locale: row.locale,
    source: row.source,
    createdAt: row.created_at,
    notificationEmailStatus: row.notification_email_status,
  };
}

export function resolvePropertyLeadsForAdmin({
  configured,
  response,
}: {
  configured: boolean;
  response?: PropertyLeadQueryResponse;
}): AdminPropertyLeadsResult {
  if (!configured) return { state: "unconfigured", leads: [] };
  if (!response || response.error) return { state: "unavailable", leads: [] };

  return {
    state: "ready",
    leads: sortPropertyLeadsNewestFirst(
      (response.data ?? []).map(toAdminPropertyLead),
    ),
  };
}

export function isMissingPropertyLeadsSchemaError(
  error: PropertyLeadQueryResponse["error"],
): boolean {
  return Boolean(error && MISSING_SCHEMA_CODES.has(error.code ?? ""));
}
