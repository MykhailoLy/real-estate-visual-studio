import "server-only";
import { createServerClient } from "@/lib/supabase";
import { sendPropertyLeadEmail } from "@/lib/email/send-property-lead-email";
import { PropertyShowcaseSchema } from "./schema";
import type {
  PropertyLeadDependencies,
  PropertyLeadInsert,
  PublishedPropertyLeadContext,
} from "./property-leads";
import {
  checkPropertyLeadRateLimit,
  verifyPropertyLeadTurnstile,
} from "./property-lead-security";

interface PropertyRow {
  id: string;
  slug: string;
  content: unknown;
  published: boolean;
}

async function findPublishedProperty(
  slug: string,
): Promise<PublishedPropertyLeadContext | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("property_showcases")
    .select("id, slug, content, published")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw new Error(`Property lookup failed: ${error.code}`);
  if (!data) return null;

  const row = data as PropertyRow;
  const property = PropertyShowcaseSchema.safeParse(row.content);
  if (!property.success || property.data.slug !== row.slug || !row.published) {
    return null;
  }
  return { id: row.id, property: property.data };
}

async function insertLead(input: PropertyLeadInsert): Promise<{ id: string }> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("property_leads")
    .insert({
      property_id: input.propertyId,
      property_slug: input.propertySlug,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      preferred_date: input.preferredDate ?? null,
      preferred_time: input.preferredTime ?? null,
      message: input.message ?? null,
      locale: input.locale,
      source: input.source,
      notification_email_status: input.notificationEmailStatus,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Lead insert failed: ${error?.code ?? "unknown"}`);
  return data as { id: string };
}

async function updateNotification(
  input: Parameters<PropertyLeadDependencies["updateNotification"]>[0],
): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("property_leads")
    .update({
      notification_email_status: input.status,
      notification_email_error: input.error?.slice(0, 1000) ?? null,
    })
    .eq("id", input.leadId);
  if (error) throw new Error(`Lead notification update failed: ${error.code}`);
}

export function createPropertyLeadDependencies(): PropertyLeadDependencies {
  return {
    checkRateLimit: ({ request, propertySlug }) =>
      checkPropertyLeadRateLimit(request, propertySlug),
    verifySpam: ({ request, token }) =>
      verifyPropertyLeadTurnstile({ request, token }),
    findPublishedProperty,
    insertLead,
    updateNotification,
    sendNotification: sendPropertyLeadEmail,
    logError: (message, details) => {
      if (
        message === "property-leads: turnstile unavailable" &&
        details &&
        typeof details === "object" &&
        !Array.isArray(details)
      ) {
        console.error({ event: message, ...details });
        return;
      }
      console.error(message, details);
    },
  };
}
