/* eslint-disable @next/next/no-img-element -- ImageResponse requires native image elements. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ImageResponse } from "next/og";
import { getPropertyShowcase } from "@/features/property-showcase/registry";
import { getPublishedPropertyShowcase } from "@/features/property-showcase/server";
import {
  preparePropertySocialAssets,
} from "@/features/property-showcase/social-image-preparation";
import { PROPERTY_SOCIAL_CARD_LAYOUTS } from "@/features/property-showcase/social-card";
import {
  createPropertySocialImageHandler,
  type PropertySocialCardRenderInput,
} from "@/features/property-showcase/social-image-response";

const size = { width: 1200, height: 630 };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PropertyOpenGraphImageContext {
  params: Promise<{ slug: string }>;
}

function renderSocialCard({
  property,
  preview,
  propertyImages,
  brandingLogo,
}: PropertySocialCardRenderInput) {
  const primaryImage = propertyImages[0];
  const layout = PROPERTY_SOCIAL_CARD_LAYOUTS[preview.layout];
  const supportingImages = layout.showSupportingImages
    ? propertyImages.slice(1, 3)
    : [];
  const supportHeight = preview.layout === "balanced" ? 200 : 190;
  const primaryHeight = supportingImages.length > 0
    ? size.height - supportHeight
    : size.height;
  const compactPanel = layout.panelWidth <= 320;
  const title =
    property.title[property.primaryLanguage ?? "en"] ?? property.title.en;
  const titleSize = title.length > 56
    ? compactPanel ? 28 : 34
    : compactPanel ? 34 : 42;

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
            width: layout.imageWidth,
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
                height: primaryHeight,
                display: "flex",
                overflow: "hidden",
              }}
            >
              <img
                src={primaryImage.imageUrl}
                alt=""
                width={layout.imageWidth}
                height={primaryHeight}
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
                height: supportHeight,
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
                    width={
                      supportingImages.length === 1
                        ? layout.imageWidth
                        : Math.floor((layout.imageWidth - 4) / 2)
                    }
                    height={supportHeight}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          style={{
            width: layout.panelWidth,
            height: 630,
            display: "flex",
            flexDirection: "column",
            padding: compactPanel ? "30px 28px 28px" : "38px 40px 34px",
            background: "#0B1F3A",
          }}
        >
          {preview.brandingMode === "picchuspot" ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 24, fontWeight: 700 }}>
                <span>Picchu</span>
                <span style={{ color: "#B88A44" }}>Spot</span>
              </div>
              {preview.brandingAttribution ? (
                <span
                  style={{
                    display: "flex",
                    marginTop: 5,
                    color: "rgba(255,255,255,0.56)",
                    fontSize: 11,
                  }}
                >
                  {preview.brandingAttribution}
                </span>
              ) : null}
            </div>
          ) : preview.brandingMode === "agency" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {brandingLogo ? (
                <img
                  src={brandingLogo.imageUrl}
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
                {preview.brandingAttribution ? (
                  <span
                    style={{
                      display: "flex",
                      marginTop: 5,
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 11,
                    }}
                  >
                    {preview.brandingAttribution}
                  </span>
                ) : null}
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
              marginTop: compactPanel ? 26 : 34,
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
                  fontSize: compactPanel ? 31 : 38,
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
              marginTop: compactPanel ? 22 : 28,
              paddingTop: compactPanel ? 18 : 22,
              borderTop: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            {preview.facts.map(({ key, label, value }) => (
                <div
                  key={key}
                  style={{
                    width: compactPanel ? "100%" : "50%",
                    display: "flex",
                    flexDirection: "column",
                    marginBottom: compactPanel ? 12 : 18,
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
                  <span
                    style={{
                      marginTop: 5,
                      fontSize: compactPanel ? 18 : 22,
                      fontWeight: 700,
                    }}
                  >
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

const getPropertySocialImage = createPropertySocialImageHandler({
  resolveProperty: async (slug) =>
    (await getPublishedPropertyShowcase(slug)) ?? getPropertyShowcase(slug),
  prepareAssets: preparePropertySocialAssets,
  renderCard: renderSocialCard,
  loadEmergencyPng: () =>
    readFile(
      resolve(
        process.cwd(),
        "public",
        "brand",
        "property-social-emergency.png",
      ),
    ),
});

export async function GET(
  request: Request,
  context: PropertyOpenGraphImageContext,
) {
  return getPropertySocialImage(request, context);
}

export async function HEAD(
  request: Request,
  context: PropertyOpenGraphImageContext,
) {
  const response = await getPropertySocialImage(request, context);
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
