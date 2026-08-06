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
  landscapeImages: PreparedMarketingImage[];
  portraitImages: PreparedMarketingImage[];
  agencyLogoUrl?: string;
  agentPortraitUrl?: string;
  qrCodeUrl?: string;
}

function dataUri(contentType: "image/jpeg" | "image/png", bytes: Buffer) {
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

async function preparePhoto(
  property: PropertyShowcase,
  image: PropertyMarketingSelectedImage,
): Promise<PreparedMarketingImage | null> {
  const source = await loadPropertySocialImageSource(
    property,
    image.imageUrl,
    "photo",
    { timeoutMs: 6000, maxSourceBytes: 10 * 1024 * 1024 },
  );
  if (!source.ok) return null;
  try {
    const normalized = await sharp(source.source.bytes, {
      failOn: "error",
      limitInputPixels: 60_000_000,
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: 2200,
        height: 2200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .timeout({ seconds: 8 })
      .toBuffer();
    if (normalized.length > 3 * 1024 * 1024) return null;
    return { ...image, imageUrl: dataUri("image/jpeg", normalized) };
  } catch {
    return null;
  }
}

async function prepareSmallImage(
  property: PropertyShowcase,
  imageUrl: string | undefined,
  kind: "photo" | "logo",
): Promise<string | undefined> {
  if (!imageUrl) return undefined;
  const source = await loadPropertySocialImageSource(property, imageUrl, kind, {
    timeoutMs: 5000,
    maxSourceBytes: 8 * 1024 * 1024,
  });
  if (!source.ok) return undefined;
  try {
    const pipeline = sharp(source.source.bytes, {
      failOn: "error",
      limitInputPixels: 30_000_000,
      sequentialRead: true,
    }).rotate().resize({
      width: kind === "logo" ? 480 : 600,
      height: kind === "logo" ? 240 : 600,
      fit: kind === "logo" ? "inside" : "cover",
      withoutEnlargement: true,
    });
    const normalized = kind === "logo"
      ? await pipeline.png({ compressionLevel: 9 }).timeout({ seconds: 5 }).toBuffer()
      : await pipeline.jpeg({ quality: 86, mozjpeg: true }).timeout({ seconds: 5 }).toBuffer();
    return dataUri(kind === "logo" ? "image/png" : "image/jpeg", normalized);
  } catch {
    return undefined;
  }
}

async function prepareImages(
  property: PropertyShowcase,
  selected: readonly PropertyMarketingSelectedImage[],
): Promise<PreparedMarketingImage[]> {
  const prepared: PreparedMarketingImage[] = [];
  for (const image of selected) {
    const result = await preparePhoto(property, image);
    if (result) prepared.push(result);
  }
  return prepared;
}

export async function preparePropertyMarketingAssets(
  property: PropertyShowcase,
  canonicalUrl: string,
): Promise<PreparedPropertyMarketingAssets> {
  const view = createPropertyMarketingMaterialView(property, canonicalUrl);
  const landscapeImages = await prepareImages(property, view.landscapeImages);
  const portraitImages = await prepareImages(property, view.portraitImages);
  const [agencyLogoUrl, agentPortraitUrl, qrCodeUrl] = await Promise.all([
    view.config.includeAgencyLogo
      ? prepareSmallImage(property, view.agent?.logoUrl, "logo")
      : undefined,
    view.config.includeAgent
      ? prepareSmallImage(property, view.agent?.portraitUrl, "photo")
      : undefined,
    view.config.includeQrCode
      ? QRCode.toDataURL(canonicalUrl, {
          errorCorrectionLevel: "M",
          margin: 4,
          width: 420,
          color: { dark: "#0B1F3A", light: "#FFFFFFFF" },
        })
      : undefined,
  ]);

  return {
    view,
    landscapeImages,
    portraitImages,
    agencyLogoUrl,
    agentPortraitUrl,
    qrCodeUrl,
  };
}
