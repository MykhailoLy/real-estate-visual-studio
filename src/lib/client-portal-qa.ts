import "server-only";

import type { ClientUser } from "@/lib/client-auth";
import type { ClientProfile } from "@/lib/client-profile";

/** The only environments where the non-production portal QA render mode exists. */
export interface ClientPortalQaEnvironment {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}

/**
 * Production always wins. Preview deployments and local development may render
 * the client portal with the fixed QA identity when no real session exists.
 */
export function isClientPortalQaEnvironment(
  environment: ClientPortalQaEnvironment = process.env,
): boolean {
  if (environment.VERCEL_ENV === "production") return false;

  return (
    environment.VERCEL_ENV === "preview" ||
    environment.NODE_ENV === "development"
  );
}

export interface DashboardRequestUser extends ClientUser {
  /** Render-only marker. Never use this identity for ownership or API access. */
  isQaPreview: boolean;
}

/** Fixed preview-only identity. It is never stored in Supabase or a session. */
export const CLIENT_PORTAL_QA_USER: DashboardRequestUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "qa-preview@picchuspot.invalid",
  displayName: "QA Preview",
  firstName: "QA",
  avatarUrl: null,
  isQaPreview: true,
};

/**
 * Minimum complete client profile for render-only order-form QA. The profile is
 * deliberately fake and remains in memory; no client_profiles row is created.
 */
export const CLIENT_PORTAL_QA_PROFILE: ClientProfile = {
  id: "00000000-0000-4000-8000-000000000002",
  user_id: CLIENT_PORTAL_QA_USER.id,
  first_name: "QA",
  last_name: "Preview",
  full_name: "QA Preview",
  company_name: "Preview only",
  phone: "+1 202-555-0100",
  country: "Preview environment",
  industry: "Preview only",
  how_found_us: "Preview only",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

/**
 * A verified session always wins, including in preview and local development.
 * The synthetic identity is therefore unreachable for authenticated users.
 */
export function resolveDashboardRequestUser(
  verifiedUser: ClientUser | null,
  environment: ClientPortalQaEnvironment = process.env,
): DashboardRequestUser | null {
  if (verifiedUser) return { ...verifiedUser, isQaPreview: false };

  return isClientPortalQaEnvironment(environment)
    ? CLIENT_PORTAL_QA_USER
    : null;
}

/** Use the fake profile only for the fixed QA identity; preserve real profiles. */
export function resolveDashboardRequestProfile(
  user: DashboardRequestUser | null,
  verifiedProfile: ClientProfile | null,
): ClientProfile | null {
  return user?.isQaPreview ? CLIENT_PORTAL_QA_PROFILE : verifiedProfile;
}
