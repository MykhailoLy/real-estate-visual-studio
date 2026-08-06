import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { PropertyShowcase } from "./types.ts";
import { resolvePropertySocialImageUrl } from "./social-preview.ts";
import { SITE_URL } from "../../lib/seo.ts";

export const PROPERTY_SOCIAL_IMAGE_MAX_SOURCE_BYTES = 8 * 1024 * 1024;
export const PROPERTY_SOCIAL_IMAGE_FETCH_TIMEOUT_MS = 5000;

export type PropertySocialImageKind = "photo" | "logo";
export type PropertySocialImageFailureReason =
  | "untrusted-url"
  | "fetch-failed"
  | "fetch-timeout"
  | "http-error"
  | "unsupported-content-type"
  | "source-too-large"
  | "empty-body"
  | "local-read-failed";

export interface PropertySocialImageSource {
  bytes: Buffer;
  contentType: string;
}

export type PropertySocialImageSourceResult =
  | { ok: true; source: PropertySocialImageSource }
  | { ok: false; reason: PropertySocialImageFailureReason };

export type PropertySocialImageFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

interface LoadPropertySocialImageSourceOptions {
  fetchImpl?: PropertySocialImageFetch;
  timeoutMs?: number;
  maxSourceBytes?: number;
}

const LOCAL_IMAGE_MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const PHOTO_SOURCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const LOGO_SOURCE_TYPES = new Set([...PHOTO_SOURCE_TYPES, "image/svg+xml"]);

function supportsSourceType(
  kind: PropertySocialImageKind,
  contentType: string,
): boolean {
  return (kind === "logo" ? LOGO_SOURCE_TYPES : PHOTO_SOURCE_TYPES).has(
    contentType,
  );
}

async function readLimitedResponseBody(
  response: Response,
  maxBytes: number,
): Promise<{ bytes: Buffer | null; exceededLimit: boolean }> {
  if (!response.body) return { bytes: null, exceededLimit: false };
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return { bytes: null, exceededLimit: true };
    }
    chunks.push(Buffer.from(value));
  }

  return {
    bytes: totalBytes > 0 ? Buffer.concat(chunks, totalBytes) : null,
    exceededLimit: false,
  };
}

async function loadLocalPropertySocialImageSource(
  trustedUrl: string,
  kind: PropertySocialImageKind,
  maxSourceBytes: number,
): Promise<PropertySocialImageSourceResult | null> {
  const url = new URL(trustedUrl);
  if (url.origin !== new URL(SITE_URL).origin) return null;

  const publicRoot = resolve(process.cwd(), "public");
  const filePath = resolve(publicRoot, `.${decodeURIComponent(url.pathname)}`);
  if (!filePath.startsWith(`${publicRoot}${sep}`)) {
    return { ok: false, reason: "untrusted-url" };
  }

  const contentType = LOCAL_IMAGE_MIME_TYPES[extname(filePath).toLowerCase()];
  if (!contentType || !supportsSourceType(kind, contentType)) {
    return { ok: false, reason: "unsupported-content-type" };
  }

  try {
    const file = await stat(filePath);
    if (file.size === 0) return { ok: false, reason: "empty-body" };
    if (file.size > maxSourceBytes) {
      return { ok: false, reason: "source-too-large" };
    }

    const bytes = await readFile(filePath);
    return { ok: true, source: { bytes, contentType } };
  } catch {
    // Public assets may be deployed separately from the function bundle. In
    // that case the same trusted URL is fetched below instead.
    return null;
  }
}

async function fetchRemotePropertySocialImageSource(
  trustedUrl: string,
  kind: PropertySocialImageKind,
  options: LoadPropertySocialImageSourceOptions,
): Promise<PropertySocialImageSourceResult> {
  const maxSourceBytes =
    options.maxSourceBytes ?? PROPERTY_SOCIAL_IMAGE_MAX_SOURCE_BYTES;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? PROPERTY_SOCIAL_IMAGE_FETCH_TIMEOUT_MS,
  );

  try {
    const response = await (options.fetchImpl ?? fetch)(trustedUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept:
          kind === "logo"
            ? "image/svg+xml,image/webp,image/png,image/jpeg"
            : "image/webp,image/png,image/jpeg",
      },
    });
    if (!response.ok) return { ok: false, reason: "http-error" };

    const contentType = response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (!contentType || !supportsSourceType(kind, contentType)) {
      return { ok: false, reason: "unsupported-content-type" };
    }

    const declaredLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > maxSourceBytes
    ) {
      return { ok: false, reason: "source-too-large" };
    }

    const body = await readLimitedResponseBody(response, maxSourceBytes);
    if (body.exceededLimit) {
      return { ok: false, reason: "source-too-large" };
    }
    if (!body.bytes) return { ok: false, reason: "empty-body" };
    return { ok: true, source: { bytes: body.bytes, contentType } };
  } catch {
    return {
      ok: false,
      reason: controller.signal.aborted ? "fetch-timeout" : "fetch-failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadPropertySocialImageSource(
  property: Pick<PropertyShowcase, "slug">,
  imageUrl: string,
  kind: PropertySocialImageKind,
  options: LoadPropertySocialImageSourceOptions = {},
): Promise<PropertySocialImageSourceResult> {
  const trustedUrl = resolvePropertySocialImageUrl(property, imageUrl);
  if (!trustedUrl) return { ok: false, reason: "untrusted-url" };

  const maxSourceBytes =
    options.maxSourceBytes ?? PROPERTY_SOCIAL_IMAGE_MAX_SOURCE_BYTES;
  const local = await loadLocalPropertySocialImageSource(
    trustedUrl,
    kind,
    maxSourceBytes,
  );
  if (local) return local;

  return fetchRemotePropertySocialImageSource(trustedUrl, kind, options);
}
