/* eslint-disable @next/next/no-img-element -- ImageResponse requires native image elements. */
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { ImageResponse } from "next/og";
import { getPropertyShowcase } from "@/features/property-showcase/registry";
import { getPublishedPropertyShowcase } from "@/features/property-showcase/server";
import {
  PROPERTY_SOCIAL_IMAGE_MAX_BYTES,
  fetchPropertySocialImageDataUri,
} from "@/features/property-showcase/social-image-source";
import {
  getPropertySocialPreview,
  resolvedPropertySocialImages,
} from "@/features/property-showcase/social-preview";
import type { PropertyShowcase } from "@/features/property-showcase/types";
import { SITE_URL } from "@/lib/seo";

const size = { width: 1200, height: 630 };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PropertyOpenGraphImageContext = {
  params: Promise<{ slug: string }>;
};

const localImageMimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function hasEncodedPathControl(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes("%2e") || lower.includes("%2f") || lower.includes("%5c");
}

async function loadLocalImageDataUri(imageUrl: string): Promise<string | null> {
  try {
    const url = new URL(imageUrl);
    if (
      url.origin !== new URL(SITE_URL).origin ||
      hasEncodedPathControl(url.pathname)
    ) {
      return null;
    }

    const publicRoot = resolve(process.cwd(), "public");
    const filePath = resolve(publicRoot, `.${decodeURIComponent(url.pathname)}`);
    if (!filePath.startsWith(`${publicRoot}${sep}`)) return null;
    const mimeType = localImageMimeTypes[extname(filePath).toLowerCase()];
    if (!mimeType) return null;

    const data = await readFile(filePath);
    if (data.length === 0 || data.length > PROPERTY_SOCIAL_IMAGE_MAX_BYTES) {
      return null;
    }
    return `data:${mimeType};base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}

async function loadPropertySocialImageSource(
  property: Pick<PropertyShowcase, "slug">,
  imageUrl: string,
): Promise<string | null> {
  return (
    (await loadLocalImageDataUri(imageUrl)) ??
    (await fetchPropertySocialImageDataUri(property, imageUrl))
  );
}

async function loadUsableSocialImages(property: PropertyShowcase) {
  const usable: Array<{ imageUrl: string; imageAlt: string }> = [];
  for (const image of resolvedPropertySocialImages(property)) {
    const imageUrl = await loadPropertySocialImageSource(property, image.imageUrl);
    if (imageUrl) usable.push({ ...image, imageUrl });
    if (usable.length === 3) break;
  }
  return usable;
}

export async function GET(
  _request: Request,
  { params }: PropertyOpenGraphImageContext,
) {
  const { slug } = await params;
  const property =
    (await getPublishedPropertyShowcase(slug)) ?? getPropertyShowcase(slug);

  if (!property) return new Response("Property not found", { status: 404 });

  const preview = getPropertySocialPreview(property);
  const images = await loadUsableSocialImages(property);
  const primaryImage = images[0];
  const supportingImages = images.slice(1, 3);
  const brandingLogo = preview.brandingLogoUrl
    ? await loadPropertySocialImageSource(property, preview.brandingLogoUrl)
    : null;
  const title =
    property.title[property.primaryLanguage ?? "en"] ?? property.title.en;
  const titleSize = title.length > 56 ? 34 : 42;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          overflow: "hidden",
          background: "#eef0ef",
          color: "#ffffff",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            width: 760,
            height: 630,
            display: "flex",
            flexDirection: "column",
            background: primaryImage ? "#dfe3e1" : "#e7e1d3",
          }}
        >
          {primaryImage ? (
            <div
              style={{
                width: "100%",
                height: supportingImages.length > 0 ? 430 : 630,
                display: "flex",
                overflow: "hidden",
              }}
            >
              <img
                src={primaryImage.imageUrl}
                alt=""
                width={760}
                height={supportingImages.length > 0 ? 430 : 630}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : (
            <div
              data-testid="social-card-branded-fallback"
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 70,
                color: "#0B1F3A",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 76,
                  height: 4,
                  display: "flex",
                  background: "#B88A44",
                  marginBottom: 28,
                }}
              />
              <div style={{ display: "flex", fontSize: 20, fontWeight: 700 }}>
                {preview.location || "Property showcase"}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 16,
                  fontSize: 42,
                  fontWeight: 700,
                  lineHeight: 1.08,
                }}
              >
                {title}
              </div>
            </div>
          )}
          {supportingImages.length > 0 ? (
            <div
              style={{
                width: "100%",
                height: 200,
                display: "flex",
                gap: 4,
                borderTop: "4px solid #ffffff",
              }}
            >
              {supportingImages.map((image) => (
                <div
                  key={image.imageUrl}
                  style={{
                    flex: 1,
                    height: "100%",
                    display: "flex",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={image.imageUrl}
                    alt=""
                    width={supportingImages.length === 1 ? 760 : 378}
                    height={200}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          style={{
            width: 440,
            height: 630,
            display: "flex",
            flexDirection: "column",
            padding: "38px 40px 34px",
            background: "#0B1F3A",
          }}
        >
          {preview.brandingMode === "picchuspot" ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 24, fontWeight: 700 }}>
                <span>Picchu</span>
                <span style={{ color: "#B88A44" }}>Spot</span>
              </div>
              <span
                style={{
                  display: "flex",
                  marginTop: 5,
                  color: "rgba(255,255,255,0.56)",
                  fontSize: 11,
                }}
              >
                Property Showcase by PicchuSpot
              </span>
            </div>
          ) : preview.brandingMode === "agency" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {brandingLogo ? (
                <img
                  src={brandingLogo}
                  alt=""
                  width={64}
                  height={48}
                  style={{ width: 64, height: 48, objectFit: "contain" }}
                />
              ) : null}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ display: "flex", fontSize: 20, fontWeight: 700 }}>
                  {preview.brandingName ?? "Agency"}
                </span>
                <span
                  style={{
                    display: "flex",
                    marginTop: 5,
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 11,
                  }}
                >
                  Powered by PicchuSpot
                </span>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                width: 52,
                height: 3,
                background: "#B88A44",
              }}
            />
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 34,
            }}
          >
            {preview.location ? (
              <div
                style={{
                  display: "flex",
                  color: "rgba(255,255,255,0.72)",
                  fontSize: 18,
                  lineHeight: 1.35,
                }}
              >
                {preview.location}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                marginTop: preview.location ? 14 : 0,
                fontSize: titleSize,
                fontWeight: 700,
                lineHeight: 1.08,
              }}
            >
              {title}
            </div>
            {preview.price ? (
              <div
                style={{
                  display: "flex",
                  marginTop: 18,
                  color: "#d6b665",
                  fontSize: 38,
                  fontWeight: 700,
                }}
              >
                {preview.price}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              marginTop: 28,
              paddingTop: 22,
              borderTop: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            {[
              [preview.referenceLabel, preview.reference],
              ["Bedrooms", preview.bedrooms],
              ["Bathrooms", preview.bathrooms],
              ["Built area", preview.builtArea],
            ]
              .filter((item) => item[1])
              .map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    width: "50%",
                    display: "flex",
                    flexDirection: "column",
                    marginBottom: 18,
                    paddingRight: 12,
                  }}
                >
                  <span
                    style={{
                      color: "rgba(255,255,255,0.58)",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 1.2,
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ marginTop: 5, fontSize: 22, fontWeight: 700 }}>
                    {value}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
