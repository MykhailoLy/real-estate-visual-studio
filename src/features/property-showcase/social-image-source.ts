import type { PropertyShowcase } from "./types.ts";
import { resolvePropertySocialImageUrl } from "./social-preview.ts";

export const PROPERTY_SOCIAL_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const PROPERTY_SOCIAL_IMAGE_TIMEOUT_MS = 5000;

const TRUSTED_REMOTE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type PropertySocialImageFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

async function readLimitedResponseBody(
  response: Response,
  maxBytes: number,
): Promise<Buffer | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(value));
  }

  return totalBytes > 0 ? Buffer.concat(chunks, totalBytes) : null;
}

export async function fetchPropertySocialImageDataUri(
  property: Pick<PropertyShowcase, "slug">,
  imageUrl: string,
  options: {
    fetchImpl?: PropertySocialImageFetch;
    timeoutMs?: number;
    maxBytes?: number;
  } = {},
): Promise<string | null> {
  const trustedUrl = resolvePropertySocialImageUrl(property, imageUrl);
  if (!trustedUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? PROPERTY_SOCIAL_IMAGE_TIMEOUT_MS,
  );

  try {
    const response = await (options.fetchImpl ?? fetch)(trustedUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg",
      },
    });
    if (!response.ok) return null;

    const contentType = response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (!contentType || !TRUSTED_REMOTE_IMAGE_TYPES.has(contentType)) {
      return null;
    }

    const maxBytes = options.maxBytes ?? PROPERTY_SOCIAL_IMAGE_MAX_BYTES;
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return null;
    }

    const data = await readLimitedResponseBody(response, maxBytes);
    if (!data) return null;
    return `data:${contentType};base64,${data.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
