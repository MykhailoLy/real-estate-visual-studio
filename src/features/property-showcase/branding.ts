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

export interface PropertyBrandPalette {
  primary: string;
  accent: string;
  accentTextColor: string;
  primaryForeground: "#0B1020" | "#FFFFFF";
}

export const PROPERTY_BRAND_DEFAULTS = {
  primary: "#071A2B",
  accent: "#C7A94E",
} as const;

function hasEncodedPathControl(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes("%2e") || lower.includes("%2f") || lower.includes("%5c");
}

export function isValidPropertyBrandColor(value: string | undefined): boolean {
  return Boolean(value && HEX_COLOR.test(value));
}

function channel(value: string, offset: number): number {
  return Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
}

function linearize(channelValue: number): number {
  return channelValue <= 0.03928
    ? channelValue / 12.92
    : ((channelValue + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: string): number {
  return (
    0.2126 * linearize(channel(color, 1)) +
    0.7152 * linearize(channel(color, 3)) +
    0.0722 * linearize(channel(color, 5))
  );
}

function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)]
    .sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** A deterministic foreground choice for validated customer brand surfaces. */
export function propertyBrandForeground(color: string): "#0B1020" | "#FFFFFF" {
  if (!isValidPropertyBrandColor(color)) return "#FFFFFF";
  const luminance = relativeLuminance(color);
  // White and near-black have equal contrast at roughly 0.18 relative
  // luminance; selecting the stronger side guarantees at least ~4.6:1.
  return luminance > 0.18 ? "#0B1020" : "#FFFFFF";
}

export function getPropertyBrandPalette(
  branding?: Pick<PropertyBranding, "primaryColor" | "accentColor"> | null,
): PropertyBrandPalette {
  const primaryCandidate = branding?.primaryColor;
  const accentCandidate = branding?.accentColor;
  const primary = isValidPropertyBrandColor(primaryCandidate)
    ? primaryCandidate ?? PROPERTY_BRAND_DEFAULTS.primary
    : PROPERTY_BRAND_DEFAULTS.primary;
  const accent = isValidPropertyBrandColor(accentCandidate)
    ? accentCandidate ?? PROPERTY_BRAND_DEFAULTS.accent
    : PROPERTY_BRAND_DEFAULTS.accent;

  return {
    primary,
    accent,
    accentTextColor:
      contrastRatio(primary, accent) >= 4.5 ? accent : propertyBrandForeground(primary),
    primaryForeground: propertyBrandForeground(primary),
  };
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

    const mediaPrefix =
      `/storage/v1/object/public/${PROPERTY_MEDIA_BUCKET}/property-showcases/`;
    if (!url.pathname.startsWith(mediaPrefix)) return false;
    return slug
      ? url.pathname.startsWith(`${mediaPrefix}${slug}/`)
      : true;
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
