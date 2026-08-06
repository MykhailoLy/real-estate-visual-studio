import QRCode from "qrcode";
import sharp from "sharp";
import { loadPropertySocialImageSource } from "./social-image-source.ts";
import {
  createPropertyMarketingMaterialView,
  type PropertyMarketingMaterialView,
  type PropertyMarketingSelectedImage,
} from "./marketing-materials.ts";
import type { PropertyImageFocalPoint, PropertyShowcase } from "./types.ts";

export interface PreparedMarketingImage {
  id: string;
  imageUrl: string;
  imageAlt: string;
  focalPoint: PropertyImageFocalPoint;
}

export interface PreparedPropertyMarketingAssets {
  view: PropertyMarketingMaterialView;
  images: PreparedMarketingImage[];
  agencyLogoUrl?: string;
  agentPortraitUrl?: string;
  qrCodeUrl?: string;
}

interface PreparePropertyMarketingAssetsOptions {
  preview?: boolean;
}

function dataUri(contentType: "image/jpeg" | "image/png", bytes: Buffer) {
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

async function preparePhoto(
  property: PropertyShowcase,
  image: PropertyMarketingSelectedImage,
  preview: boolean,
): Promise<PreparedMarketingImage | null> {
  const source = await loadPropertySocialImageSource(
    property,
    image.imageUrl,
    "photo",
    {
      timeoutMs: preview ? 3500 : 5500,
      maxSourceBytes: 10 * 1024 * 1024,
    },
  );
  if (!source.ok) return null;
  try {
    const maximumDimension = preview ? 1000 : 2200;
    const normalized = await sharp(source.source.bytes, {
      failOn: "error",
      limitInputPixels: 60_000_000,
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: maximumDimension,
        height: maximumDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: preview ? 78 : 88, mozjpeg: true })
      .timeout({ seconds: preview ? 5 : 8 })
      .toBuffer();
    if (normalized.length > (preview ? 1024 * 1024 : 3 * 1024 * 1024)) {
      return null;
    }
    return { ...image, imageUrl: dataUri("image/jpeg", normalized) };
  } catch {
    return null;
  }
}

async function prepareSmallImage(
  property: PropertyShowcase,
  imageUrl: string | undefined,
  kind: "photo" | "logo",
  preview: boolean,
): Promise<string | undefined> {
  if (!imageUrl) return undefined;
  const source = await loadPropertySocialImageSource(property, imageUrl, kind, {
    timeoutMs: preview ? 3000 : 5000,
    maxSourceBytes: 8 * 1024 * 1024,
  });
  if (!source.ok) return undefined;
  try {
    const pipeline = sharp(source.source.bytes, {
      failOn: "error",
      limitInputPixels: 30_000_000,
      sequentialRead: true,
    }).rotate().resize({
      width: kind === "logo" ? (preview ? 280 : 480) : (preview ? 320 : 600),
      height: kind === "logo" ? (preview ? 140 : 240) : (preview ? 320 : 600),
      fit: kind === "logo" ? "inside" : "cover",
      withoutEnlargement: true,
    });
    const normalized = kind === "logo"
      ? await pipeline.png({ compressionLevel: 9 }).timeout({ seconds: 5 }).toBuffer()
      : await pipeline.jpeg({ quality: preview ? 76 : 86, mozjpeg: true }).timeout({ seconds: 5 }).toBuffer();
    return dataUri(kind === "logo" ? "image/png" : "image/jpeg", normalized);
  } catch {
    return undefined;
  }
}

async function prepareImages(
  property: PropertyShowcase,
  selected: readonly PropertyMarketingSelectedImage[],
  preview: boolean,
): Promise<PreparedMarketingImage[]> {
  const uniqueImages = [...new Map(selected.map((image) => [image.id, image])).values()];
  const prepared = await Promise.all(
    uniqueImages.map((image) => preparePhoto(property, image, preview)),
  );
  return prepared.filter((image): image is PreparedMarketingImage => Boolean(image));
}

export async function preparePropertyMarketingAssets(
  property: PropertyShowcase,
  canonicalUrl: string,
  options: PreparePropertyMarketingAssetsOptions = {},
): Promise<PreparedPropertyMarketingAssets> {
  const preview = options.preview === true;
  const view = createPropertyMarketingMaterialView(property, canonicalUrl);
  const [images, agencyLogoUrl, agentPortraitUrl, qrCodeUrl] = await Promise.all([
    prepareImages(property, view.brochureImages, preview),
    view.config.includeAgencyLogo
      ? prepareSmallImage(property, view.agent?.logoUrl, "logo", preview)
      : undefined,
    view.config.includeAgent
      ? prepareSmallImage(property, view.agent?.portraitUrl, "photo", preview)
      : undefined,
    view.config.includeQrCode
      ? QRCode.toDataURL(canonicalUrl, {
          errorCorrectionLevel: "M",
          margin: 4,
          width: preview ? 180 : 420,
          color: { dark: "#0B1F3A", light: "#FFFFFFFF" },
        })
      : undefined,
  ]);

  return {
    view,
    images,
    agencyLogoUrl,
    agentPortraitUrl,
    qrCodeUrl,
  };
}
