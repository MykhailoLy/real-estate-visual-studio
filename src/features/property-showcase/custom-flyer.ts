export const PROPERTY_CUSTOM_FLYER_FORMATS = {
  pdf: {
    mime: "application/pdf",
    maxBytes: 25 * 1024 * 1024,
    extension: "pdf",
    uploadKind: "flyer-pdf",
  },
  jpg: {
    mime: "image/jpeg",
    maxBytes: 15 * 1024 * 1024,
    extension: "jpg",
    uploadKind: "flyer-jpg",
  },
  png: {
    mime: "image/png",
    maxBytes: 20 * 1024 * 1024,
    extension: "png",
    uploadKind: "flyer-png",
  },
} as const;

export type PropertyCustomFlyerFormat = keyof typeof PROPERTY_CUSTOM_FLYER_FORMATS;
export type PropertyCustomFlyerUploadKind =
  (typeof PROPERTY_CUSTOM_FLYER_FORMATS)[PropertyCustomFlyerFormat]["uploadKind"];

export function safePropertyCustomFlyerFilename(
  slug: string,
  format: PropertyCustomFlyerFormat,
): string {
  const safeSlug =
    slug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "property";
  return `${safeSlug}-brochure.${PROPERTY_CUSTOM_FLYER_FORMATS[format].extension}`;
}

export function customFlyerFormatFromUploadKind(
  kind: string,
): PropertyCustomFlyerFormat | null {
  return (Object.keys(PROPERTY_CUSTOM_FLYER_FORMATS) as PropertyCustomFlyerFormat[])
    .find((format) => PROPERTY_CUSTOM_FLYER_FORMATS[format].uploadKind === kind) ?? null;
}

function hasMagicBytes(format: PropertyCustomFlyerFormat, bytes: Uint8Array): boolean {
  if (format === "pdf") {
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  }
  if (format === "jpg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return png.every((byte, index) => bytes[index] === byte);
}

export function validatePropertyCustomFlyerBinary(params: {
  format: PropertyCustomFlyerFormat;
  contentType: string;
  bytes: Uint8Array;
}): string | null {
  const format = PROPERTY_CUSTOM_FLYER_FORMATS[params.format];
  if (params.contentType.toLowerCase() !== format.mime) {
    return `Expected ${format.mime}.`;
  }
  if (params.bytes.byteLength === 0 || params.bytes.byteLength > format.maxBytes) {
    return `File must be no larger than ${format.maxBytes / (1024 * 1024)} MB.`;
  }
  if (!hasMagicBytes(params.format, params.bytes)) {
    return "The uploaded file content does not match its declared format.";
  }
  return null;
}
