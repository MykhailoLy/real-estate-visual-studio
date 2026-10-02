import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPartnerClient } from "./account-pricing-server.ts";

export const ADMIN_CLIENTS_PAGE_SIZE = 50;
export const PartnerPricingBody = z.object({ partnerClient: z.boolean() }).strict();
export const PartnerInviteBody = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) }).strict();

export class AdminClientsError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "AdminClientsError";
    this.status = status;
    this.code = code;
  }
}

/** Supabase sends the only invitation email; the returned Auth ID owns pricing. */
export async function inviteAdminPartnerClient(body: unknown): Promise<void> {
  if (!(await isAdminAuthenticated())) throw new AdminClientsError(401, "Unauthorized.");
  const parsed = PartnerInviteBody.safeParse(body);
  if (!parsed.success) throw new AdminClientsError(400, "A valid email address is required. Send only email.");

  let invitationCreated = false;
  try {
    const supabase = getSupabaseAdminClient();
    // Use trusted deployment configuration, never the request Host/Origin/body.
    const redirectTo = new URL("/auth/invite", process.env.NEXT_PUBLIC_SITE_URL || "https://picchuspot.com").toString();
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(parsed.data.email, { redirectTo });
    if (error) {
      if (error.code === "email_exists" || error.code === "user_already_exists") {
        throw new AdminClientsError(409, "This email already has an account. Enable Partner Pricing from the client row.", "account-exists");
      }
      throw error;
    }
    invitationCreated = true;
    if (!data.user || data.user.is_anonymous || data.user.email?.trim().toLowerCase() !== parsed.data.email) {
      throw new Error("Invitation identity could not be confirmed");
    }
    // Reuses the same authenticated, identity-checked, account-only upsert as
    // Clients and Order Detail. Re-inviting an unconfirmed account is safe.
    await setAdminClientPartner(data.user.id, true, supabase);
  } catch (error) {
    if (invitationCreated) {
      throw new AdminClientsError(503,
        "Invitation created, but Partner Pricing could not be confirmed. Reload Admin Clients and enable Partner Pricing before the client places an order.",
        "partner-assignment-unconfirmed");
    }
    if (error instanceof AdminClientsError) throw error;
    throw new AdminClientsError(503,
      "Invitation could not be confirmed. Check Admin Clients before retrying; an invitation or account may already exist.",
      "invite-unconfirmed");
  }
}

export interface AdminClientRow {
  userId: string;
  name: string | null;
  email: string | null;
  company: string | null;
  joined: string | null;
  partnerClient: boolean | null;
  deletionPending?: boolean;
}

export interface AdminClientsPageData {
  clients: AdminClientRow[];
  page: number;
  hasNextPage: boolean;
  profilesUnavailable: boolean;
  pricingUnavailable: boolean;
}

export function parseAdminClientsPage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= 1_000_000 ? page : 1;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** Auth is the account source; Orders are deliberately not queried. */
export async function listAdminClients(page: number): Promise<AdminClientsPageData> {
  if (!(await isAdminAuthenticated())) throw new AdminClientsError(401, "Unauthorized.");
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) {
    throw new AdminClientsError(400, "Invalid page.");
  }
  try {
    const supabase = getSupabaseAdminClient();
    // The Auth service's default order is created_at descending. The installed
    // SDK exposes page/perPage only, so keep its bounded, server-side pagination.
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: ADMIN_CLIENTS_PAGE_SIZE });
    if (error || !Array.isArray(data?.users)) throw new Error("Auth list unavailable");
    const users = data.users.filter((user) => !user.is_anonymous);
    const hasNextPage = data.total > 0
      ? page * ADMIN_CLIENTS_PAGE_SIZE < data.total
      : data.users.length === ADMIN_CLIENTS_PAGE_SIZE;
    if (users.length === 0) return { clients: [], page, hasNextPage, profilesUnavailable: false, pricingUnavailable: false };

    const deletionRequests = await supabase.from("account_deletion_requests").select("user_id")
      .in("user_id", users.map((user) => user.id));
    if (deletionRequests.error || !deletionRequests.data) throw new Error("Account deletion state unavailable");
    const pendingIds = new Set(deletionRequests.data.map((row) => row.user_id));
    const ids = users.map((user) => user.id);
    const [profiles, pricing] = await Promise.allSettled([
      supabase.from("client_profiles").select("user_id, first_name, last_name, full_name, company_name").in("user_id", ids),
      supabase.from("account_pricing").select("user_id, partner_client").in("user_id", ids),
    ]);
    const profilesUnavailable = profiles.status === "rejected" || Boolean(profiles.value.error) || !Array.isArray(profiles.value.data);
    const pricingUnavailable = pricing.status === "rejected" || Boolean(pricing.value.error) || !Array.isArray(pricing.value.data);
    const profileRows = !profilesUnavailable && profiles.status === "fulfilled" ? profiles.value.data! : [];
    const pricingRows = !pricingUnavailable && pricing.status === "fulfilled" ? pricing.value.data! : [];
    return {
      page, hasNextPage, profilesUnavailable, pricingUnavailable,
      clients: users.map((user) => {
        const profile = profileRows.find((row) => row.user_id === user.id);
        const pricingRow = pricingRows.find((row) => row.user_id === user.id);
        // Whitelist display fields; never forward an Auth User/metadata object.
        return {
          userId: user.id,
          deletionPending: pendingIds.has(user.id),
          name: text(profile?.full_name) ??
            text([text(profile?.first_name), text(profile?.last_name)].filter(Boolean).join(" ")) ??
            text(user.user_metadata?.full_name) ?? text(user.user_metadata?.name),
          email: text(user.email),
          company: text(profile?.company_name),
          joined: text(user.created_at),
          partnerClient: pricingUnavailable ? null : !pricingRow ? false :
            typeof pricingRow.partner_client === "boolean" ? pricingRow.partner_client : null,
        };
      }),
    };
  } catch {
    throw new AdminClientsError(503, "Registered clients could not be loaded. Please retry.");
  }
}

/** Shared by the Clients mutation and the existing Order Detail shortcut. */
export async function setAdminClientPartner(
  userId: string,
  partnerClient: boolean,
  suppliedSupabase?: SupabaseClient,
): Promise<void> {
  if (!(await isAdminAuthenticated())) throw new AdminClientsError(401, "Unauthorized.");
  if (!z.string().uuid().safeParse(userId).success || typeof partnerClient !== "boolean") {
    throw new AdminClientsError(400, "Invalid client or Partner status.");
  }
  try {
    const supabase = suppliedSupabase ?? getSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) {
      if (error.status === 404 || error.code === "user_not_found") {
        throw new AdminClientsError(404, "Registered client not found.");
      }
      throw error;
    }
    if (!data.user || data.user.is_anonymous) throw new AdminClientsError(404, "Registered client not found.");
    if (data.user.id !== userId) throw new Error("Account identity mismatch");
    // Do not mutate when the existing account pricing state cannot be verified.
    await getPartnerClient(userId, supabase);
    const { error: writeError } = await supabase.from("account_pricing").upsert({
      user_id: data.user.id,
      partner_client: partnerClient,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (writeError) throw writeError;
  } catch (error) {
    if (error instanceof AdminClientsError) throw error;
    throw new AdminClientsError(503, "Could not update Partner pricing. Please retry.");
  }
}
