import { SITE_URL } from "../../lib/seo.ts";
import type { PropertyBranding, PropertyShowcase } from "./types";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
// Kept local because this module is also imported by the public Client Component.
const PROPERTY_MEDIA_BUCKET = "site-media";

export interface ActivePropertyBranding {
  brandName: string;
  logoUrl?: string;
  websiteUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  showPicchuSpotCredit: boolean;
}

function hasEncodedPathControl(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes("%2e") || lower.includes("%2f") || lower.includes("%5c");
}

export function isValidPropertyBrandColor(value: string | undefined): boolean {
  return Boolean(value && HEX_COLOR.test(value));
}

export function normalizePropertyBrandWebsiteUrl(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  try {
    const url = new URL(trimmed);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * Brand logos are intentionally limited to the current site or the existing
 * public property-media bucket. That keeps Next Image, CSP, and storage
 * ownership aligned without introducing another upload surface.
 */
export function isValidPropertyBrandLogoUrl(
  value: string | undefined,
  slug?: string,
): boolean {
  const trimmed = value?.trim();
  if (!trimmed || hasEncodedPathControl(trimmed)) return false;

  try {
    const siteOrigin = new URL(SITE_URL).origin;
    const url = new URL(trimmed, SITE_URL);
    if (url.protocol !== "https:" || url.username || url.password) return false;

    if (trimmed.startsWith("/")) {
      return !trimmed.startsWith("//") && url.origin === siteOrigin;
    }

    if (url.origin === siteOrigin) return true;
    if (!url.hostname.endsWith(".supabase.co")) return false;

    const mediaPrefix = `/storage/v1/object/public/${PROPERTY_MEDIA_BUCKET}/properties/`;
    if (!url.pathname.startsWith(mediaPrefix)) return false;
    return slug ? url.pathname.startsWith(`${mediaPrefix}${slug}/`) : true;
  } catch {
    return false;
  }
}

function activeBrandLogoUrl(
  property: PropertyShowcase,
  branding: PropertyBranding,
): string | undefined {
  const configured = branding.logoUrl?.trim();
  if (isValidPropertyBrandLogoUrl(configured, property.slug)) return configured;

  const existingAgencyLogo = property.agent.logoUrl?.trim();
  return isValidPropertyBrandLogoUrl(existingAgencyLogo, property.slug)
    ? existingAgencyLogo
    : undefined;
}

/** Returns presentation-safe defaults; absent/disabled branding preserves legacy UI. */
export function getActivePropertyBranding(
  property: PropertyShowcase,
): ActivePropertyBranding | null {
  const branding = property.branding;
  const brandName = branding?.brandName?.trim();
  if (!branding?.enabled || !brandName) return null;

  const websiteUrl = normalizePropertyBrandWebsiteUrl(branding.websiteUrl);

  return {
    brandName,
    logoUrl: activeBrandLogoUrl(property, branding),
    websiteUrl,
    primaryColor: isValidPropertyBrandColor(branding.primaryColor)
      ? branding.primaryColor
      : undefined,
    accentColor: isValidPropertyBrandColor(branding.accentColor)
      ? branding.accentColor
      : undefined,
    showPicchuSpotCredit: branding.showPicchuSpotCredit !== false,
  };
}
