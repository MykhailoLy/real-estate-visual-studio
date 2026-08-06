/* eslint-disable @next/next/no-img-element -- ImageResponse requires native image elements. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ImageResponse } from "next/og";
import { getPropertyShowcase } from "@/features/property-showcase/registry";
import { getPublishedPropertyShowcase } from "@/features/property-showcase/server";
import {
  preparePropertySocialAssets,
} from "@/features/property-showcase/social-image-preparation";
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
  const supportingImages = propertyImages.slice(1, 3);
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
