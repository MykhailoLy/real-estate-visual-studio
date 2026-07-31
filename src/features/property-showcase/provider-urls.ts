import type { PropertyTourProvider } from "./types";

function extractIframeSrc(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  const match = trimmed.match(/<iframe[^>]*\ssrc=["']([^"']+)["'][^>]*>/i);
  return (match?.[1] ?? trimmed).replace(/&amp;/g, "&").trim();
}

function safeHttpUrl(value: string | undefined): URL | null {
  const extracted = extractIframeSrc(value);
  if (!extracted) return null;

  try {
    const url = new URL(extracted);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export function normalizeTourEmbedUrl(
  provider: PropertyTourProvider,
  value: string | undefined,
): string | undefined {
  const url = safeHttpUrl(value);
  if (!url) return undefined;

  if (provider === "kuula") {
    const hostname = url.hostname.toLowerCase();
    if (hostname === "mls.kuu.la" || hostname === "mls.kuula.co") {
      url.hostname = "kuula.co";
    }
    if (url.pathname.startsWith("/post/")) {
      url.pathname = url.pathname.replace(/^\/post\//, "/share/");
    }
    url.searchParams.set("initload", "1");
    if (!url.searchParams.has("fs")) url.searchParams.set("fs", "1");
  }

  return url.toString();
}

export function normalizeExternalInteractiveUrl(
  value: string | undefined,
): string | undefined {
  return safeHttpUrl(value)?.toString();
}

export function repairPropertyMediaUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed
    .replace("/storage/v1/obmuject/", "/storage/v1/object/")
    .replace("/storage/v1/objet/", "/storage/v1/object/");
}

export function isPublicSupabaseObjectUrl(value: string | undefined): boolean {
  return Boolean(value?.includes("/storage/v1/object/public/"));
}
