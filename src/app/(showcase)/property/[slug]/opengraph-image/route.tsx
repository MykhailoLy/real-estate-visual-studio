/* eslint-disable @next/next/no-img-element -- ImageResponse requires native image elements. */
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { ImageResponse } from "next/og";
import { getPropertyShowcase } from "@/features/property-showcase/registry";
import { getPublishedPropertyShowcase } from "@/features/property-showcase/server";
import {
  getPropertySocialPreview,
  resolvedPropertySocialImages,
} from "@/features/property-showcase/social-preview";
import { SITE_URL } from "@/lib/seo";

const size = {
  width: 1200,
  height: 630,
};
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PropertyOpenGraphImageContext = {
  params: Promise<{
    slug: string;
  }>;
};

const localImageMimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

async function loadPropertySocialImageSource(imageUrl: string): Promise<string> {
  try {
    const url = new URL(imageUrl);
    if (url.origin !== new URL(SITE_URL).origin) return imageUrl;

    const publicRoot = resolve(process.cwd(), "public");
    const filePath = resolve(publicRoot, `.${decodeURIComponent(url.pathname)}`);
    if (!filePath.startsWith(`${publicRoot}${sep}`)) return imageUrl;

    const mimeType = localImageMimeTypes[extname(filePath).toLowerCase()];
    if (!mimeType) return imageUrl;
    const data = await readFile(filePath);
    return `data:${mimeType};base64,${data.toString("base64")}`;
  } catch {
    return imageUrl;
  }
}

export async function GET(
  _request: Request,
  { params }: PropertyOpenGraphImageContext,
) {
  const { slug } = await params;
  const property =
    (await getPublishedPropertyShowcase(slug)) ?? getPropertyShowcase(slug);

  if (!property) {
    return new Response("Property not found", { status: 404 });
  }

  const preview = getPropertySocialPreview(property);
  const images = await Promise.all(
    resolvedPropertySocialImages(property).map(async (image) => ({
      ...image,
      imageUrl: await loadPropertySocialImageSource(image.imageUrl),
    })),
  );
  const primaryImage = images[0];
  const supportingImages = images.slice(1, 3);
  const titleSize = preview.title.length > 56 ? 34 : 42;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          overflow: "hidden",
          background: "#e8e7e2",
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
            background: "#d7d9da",
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
              {/* ImageResponse supports remote HTTPS image sources. */}
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
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0B1F3A",
                fontSize: 28,
              }}
            >
              Property showcase
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
          <div style={{ display: "flex", alignItems: "center", fontSize: 24, fontWeight: 700 }}>
            <span>Picchu</span>
            <span style={{ color: "#B88A44" }}>Spot</span>
          </div>

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
              {property.title[property.primaryLanguage ?? "en"] ?? property.title.en}
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
            ].filter((item) => item[1]).map(([label, value]) => (
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

          {preview.agencyName ? (
            <div
              style={{
                display: "flex",
                marginTop: "auto",
                color: "rgba(255,255,255,0.65)",
                fontSize: 14,
              }}
            >
              Presented by {preview.agencyName}
            </div>
          ) : null}
        </div>
      </div>
    ),
    size,
  );
}
