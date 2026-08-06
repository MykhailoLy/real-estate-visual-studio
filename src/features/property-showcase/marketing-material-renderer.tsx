/* eslint-disable @next/next/no-img-element -- ImageResponse requires native image elements. */
import { ImageResponse } from "next/og";
import { focalPointToObjectPosition } from "./focal-point.ts";
import { effectiveLandscapeLayout } from "./marketing-materials.ts";
import type { PreparedPropertyMarketingAssets, PreparedMarketingImage } from "./marketing-material-assets.ts";
import type { PropertySocialCardRenderInput } from "./social-image-response.ts";

const NAVY = "#0B1F3A";
const GOLD = "#B88A44";

interface SharedRenderModel {
  title: string;
  location: string;
  price: string;
  facts: Array<{ key: string; label: string; value: string }>;
  copy: string;
  highlights: string[];
  disclaimer: string;
  brandingMode: "picchuspot" | "agency" | "unbranded";
  agencyName: string;
  agentName: string;
  agentRole: string;
  agentPhone: string;
  images: PreparedMarketingImage[];
  agencyLogoUrl?: string;
  agentPortraitUrl?: string;
  qrCodeUrl?: string;
}

function ImageTile({
  image,
  width,
  height,
}: {
  image: PreparedMarketingImage;
  width: number | string;
  height: number | string;
}) {
  return (
    <div style={{ width, height, display: "flex", overflow: "hidden", background: "#e7e1d3" }}>
      <img
        src={image.imageUrl}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: focalPointToObjectPosition(image.focalPoint),
        }}
      />
    </div>
  );
}

function Brand({ model, large = false }: { model: SharedRenderModel; large?: boolean }) {
  if (model.brandingMode === "unbranded") {
    return <div style={{ display: "flex", width: large ? 90 : 52, height: large ? 7 : 4, background: GOLD }} />;
  }
  if (model.brandingMode === "agency") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: large ? 24 : 14 }}>
        {model.agencyLogoUrl ? (
          <img src={model.agencyLogoUrl} alt="" style={{ width: large ? 150 : 72, height: large ? 90 : 54, objectFit: "contain" }} />
        ) : null}
        <span style={{ display: "flex", fontSize: large ? 34 : 21, fontWeight: 700 }}>
          {model.agencyName || "Agency"}
        </span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", fontSize: large ? 42 : 25, fontWeight: 700 }}>
      <span>Picchu</span><span style={{ color: GOLD }}>Spot</span>
    </div>
  );
}

function Facts({ model, large = false }: { model: SharedRenderModel; large?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", width: "100%", borderTop: "1px solid rgba(255,255,255,.2)", paddingTop: large ? 30 : 18, marginTop: large ? 34 : 24 }}>
      {model.facts.slice(0, 4).map((fact) => (
        <div key={fact.key} style={{ width: "50%", display: "flex", flexDirection: "column", paddingRight: 16, marginBottom: large ? 26 : 15 }}>
          <span style={{ display: "flex", color: "rgba(255,255,255,.56)", fontSize: large ? 17 : 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2 }}>{fact.label}</span>
          <span style={{ display: "flex", marginTop: 6, fontSize: large ? 31 : 21, fontWeight: 700 }}>{fact.value}</span>
        </div>
      ))}
    </div>
  );
}

function LandscapeComposition({
  model,
  width,
  height,
  requestedLayout,
}: {
  model: SharedRenderModel;
  width: number;
  height: number;
  requestedLayout: "single-hero" | "hero-two-square" | "hero-four-grid";
}) {
  const layout = effectiveLandscapeLayout(requestedLayout, model.images.length);
  const panelWidth = Math.round(width * (layout === "single-hero" ? 0.38 : 0.34));
  const photoWidth = width - panelWidth;
  const primary = model.images[0];
  const supporting = model.images.slice(1, layout === "hero-four-grid" ? 5 : 3);
  const compact = width <= 1200;
  const gap = compact ? 4 : 8;
  const supportWidth = supporting.length > 0
    ? layout === "hero-four-grid" ? Math.round(photoWidth * 0.36) : Math.round(photoWidth * 0.31)
    : 0;
  const mainWidth = photoWidth - supportWidth - (supportWidth ? gap : 0);

  return (
    <div style={{ width, height, display: "flex", overflow: "hidden", background: "#ebe7de", color: "white", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ width: photoWidth, height, display: "flex", gap }}>
        {primary ? <ImageTile image={primary} width={mainWidth} height={height} /> : (
          <div style={{ width: mainWidth, height, display: "flex", alignItems: "center", justifyContent: "center", color: NAVY, fontSize: compact ? 34 : 58, padding: 60, textAlign: "center" }}>{model.title}</div>
        )}
        {supporting.length > 0 ? (
          <div style={{ width: supportWidth, height, display: "flex", flexWrap: "wrap", gap }}>
            {supporting.map((image) => (
              <ImageTile
                key={image.id}
                image={image}
                width={layout === "hero-four-grid" ? `calc(50% - ${gap / 2}px)` : "100%"}
                height={layout === "hero-four-grid" ? `calc(50% - ${gap / 2}px)` : `calc(${100 / supporting.length}% - ${gap / 2}px)`}
              />
            ))}
          </div>
        ) : null}
      </div>
      <div style={{ width: panelWidth, height, display: "flex", flexDirection: "column", padding: compact ? "34px 30px" : "66px 58px 54px", background: NAVY }}>
        <Brand model={model} large={!compact} />
        <div style={{ display: "flex", flexDirection: "column", marginTop: compact ? 28 : 54 }}>
          {model.location ? <span style={{ display: "flex", color: "rgba(255,255,255,.7)", fontSize: compact ? 17 : 27 }}>{model.location}</span> : null}
          <span style={{ display: "flex", marginTop: model.location ? 14 : 0, fontSize: compact ? 35 : 54, lineHeight: 1.08, fontWeight: 700 }}>{model.title}</span>
          {model.price ? <span style={{ display: "flex", marginTop: compact ? 18 : 28, color: "#dec373", fontSize: compact ? 33 : 50, fontWeight: 700 }}>{model.price}</span> : null}
          {model.copy ? <span style={{ display: "flex", marginTop: compact ? 16 : 26, color: "rgba(255,255,255,.72)", fontSize: compact ? 14 : 22, lineHeight: 1.4 }}>{model.copy}</span> : null}
        </div>
        <Facts model={model} large={!compact} />
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto" }}>
          {model.agentName ? (
            <div style={{ display: "flex", alignItems: "center", gap: compact ? 10 : 18 }}>
              {model.agentPortraitUrl ? <img src={model.agentPortraitUrl} alt="" style={{ width: compact ? 48 : 76, height: compact ? 48 : 76, borderRadius: 999, objectFit: "cover" }} /> : null}
              <div style={{ display: "flex", flexDirection: "column" }}><span style={{ display: "flex", fontSize: compact ? 13 : 20, fontWeight: 700 }}>{model.agentName}</span><span style={{ display: "flex", color: "rgba(255,255,255,.55)", fontSize: compact ? 10 : 15 }}>{model.agentRole}</span></div>
            </div>
          ) : <div style={{ display: "flex" }} />}
          {model.qrCodeUrl ? <img src={model.qrCodeUrl} alt="" style={{ width: compact ? 82 : 132, height: compact ? 82 : 132 }} /> : null}
        </div>
      </div>
    </div>
  );
}

function PortraitComposition({ model, layout }: { model: SharedRenderModel; layout: "a4-classic" | "a4-editorial" }) {
  const width = 2480;
  const height = 3508;
  const editorial = layout === "a4-editorial";
  const primary = model.images[0];
  const supporting = model.images.slice(1, editorial ? 6 : 4);
  const heroHeight = editorial ? 1580 : 1420;
  const supportHeight = supporting.length > 0 ? 500 : 0;
  return (
    <div style={{ width, height, display: "flex", flexDirection: "column", overflow: "hidden", background: editorial ? "#f7f4ed" : "white", color: NAVY, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ width, height: heroHeight, display: "flex", position: "relative" }}>
        {primary ? <ImageTile image={primary} width={width} height={heroHeight} /> : <div style={{ width, height: heroHeight, display: "flex", alignItems: "center", justifyContent: "center", background: "#ebe7de", fontSize: 84, fontWeight: 700 }}>{model.title}</div>}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 540, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "100px 130px", background: "linear-gradient(0deg, rgba(11,31,58,.9), rgba(11,31,58,0))", color: "white" }}>
          {model.location ? <span style={{ display: "flex", fontSize: 34, color: "rgba(255,255,255,.8)" }}>{model.location}</span> : null}
          <span style={{ display: "flex", marginTop: 18, fontSize: 82, lineHeight: 1.05, fontWeight: 700 }}>{model.title}</span>
          {model.price ? <span style={{ display: "flex", marginTop: 22, color: "#e2c779", fontSize: 62, fontWeight: 700 }}>{model.price}</span> : null}
        </div>
      </div>
      {supporting.length > 0 ? (
        <div style={{ width, height: supportHeight, display: "flex", gap: 10, padding: editorial ? "10px 80px 0" : "10px 0 0" }}>
          {supporting.map((image) => <ImageTile key={image.id} image={image} width={`${100 / supporting.length}%`} height={supportHeight - 10} />)}
        </div>
      ) : null}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: editorial ? "90px 130px 70px" : "80px 120px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><Brand model={model} large />{model.qrCodeUrl ? <img src={model.qrCodeUrl} alt="" style={{ width: 250, height: 250 }} /> : null}</div>
        <div style={{ display: "flex", marginTop: 55, gap: 70 }}>
          <div style={{ width: "65%", display: "flex", flexDirection: "column" }}>
            {model.copy ? <span style={{ display: "flex", fontSize: 38, lineHeight: 1.5, color: "#334155" }}>{model.copy}</span> : null}
            {model.highlights.length > 0 ? <div style={{ display: "flex", flexDirection: "column", marginTop: 34 }}>{model.highlights.map((highlight) => <span key={highlight} style={{ display: "flex", marginTop: 14, fontSize: 31, fontWeight: 700 }}>• {highlight}</span>)}</div> : null}
          </div>
          <div style={{ width: "35%", display: "flex", flexWrap: "wrap", alignContent: "flex-start" }}>{model.facts.map((fact) => <div key={fact.key} style={{ width: "50%", display: "flex", flexDirection: "column", marginBottom: 35 }}><span style={{ display: "flex", color: "#64748b", fontSize: 18, fontWeight: 700, textTransform: "uppercase" }}>{fact.label}</span><span style={{ display: "flex", marginTop: 8, fontSize: 34, fontWeight: 700 }}>{fact.value}</span></div>)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: "auto", borderTop: "2px solid #d7dce2", paddingTop: 42 }}>
          {model.agentPortraitUrl ? <img src={model.agentPortraitUrl} alt="" style={{ width: 150, height: 150, borderRadius: 999, objectFit: "cover" }} /> : null}
          {model.agentName || model.agencyName ? <div style={{ display: "flex", flexDirection: "column", marginLeft: model.agentPortraitUrl ? 28 : 0 }}><span style={{ display: "flex", fontSize: 31, fontWeight: 700 }}>{model.agentName || model.agencyName}</span>{model.agentRole ? <span style={{ display: "flex", marginTop: 6, color: "#64748b", fontSize: 22 }}>{model.agentRole}</span> : null}{model.agentPhone ? <span style={{ display: "flex", marginTop: 8, fontSize: 23 }}>{model.agentPhone}</span> : null}</div> : null}
          {model.disclaimer ? <span style={{ display: "flex", width: 900, marginLeft: "auto", textAlign: "right", color: "#64748b", fontSize: 18, lineHeight: 1.4 }}>{model.disclaimer}</span> : null}
        </div>
      </div>
    </div>
  );
}

function modelFromAssets(assets: PreparedPropertyMarketingAssets, portrait: boolean): SharedRenderModel {
  const { view } = assets;
  return {
    title: view.title,
    location: view.location,
    price: view.price,
    facts: view.facts,
    copy: view.copy,
    highlights: view.highlights,
    disclaimer: view.disclaimer,
    brandingMode: view.config.brandingMode,
    agencyName: view.agent?.agencyName ?? "",
    agentName: view.agent?.name ?? "",
    agentRole: view.agent?.role ?? "",
    agentPhone: view.agent?.phone ?? "",
    images: portrait ? assets.portraitImages : assets.landscapeImages,
    agencyLogoUrl: assets.agencyLogoUrl,
    agentPortraitUrl: assets.agentPortraitUrl,
    qrCodeUrl: assets.qrCodeUrl,
  };
}

export function renderPropertyMarketingPng(
  assets: PreparedPropertyMarketingAssets,
  kind: "landscape" | "portrait",
) {
  if (kind === "portrait") {
    return new ImageResponse(
      <PortraitComposition model={modelFromAssets(assets, true)} layout={assets.view.config.portrait.layout} />,
      { width: 2480, height: 3508 },
    );
  }
  return new ImageResponse(
    <LandscapeComposition model={modelFromAssets(assets, false)} width={1920} height={1080} requestedLayout={assets.view.config.landscape.layout} />,
    { width: 1920, height: 1080 },
  );
}

export function renderPropertySocialCardPng(input: PropertySocialCardRenderInput) {
  const model: SharedRenderModel = {
    title: input.property.title[input.property.primaryLanguage ?? "en"] ?? input.property.title.en,
    location: input.preview.location,
    price: input.preview.price,
    facts: input.preview.facts,
    copy: "",
    highlights: [],
    disclaimer: "",
    brandingMode: input.preview.brandingMode,
    agencyName: input.preview.brandingName ?? input.preview.agencyName ?? "",
    agentName: "",
    agentRole: "",
    agentPhone: "",
    images: input.propertyImages.map((image, index) => ({
      id: image.imageId ?? `social-${index}`,
      imageUrl: image.imageUrl,
      imageAlt: image.imageAlt,
      focalPoint: image.focalPoint ?? { x: 0.5, y: 0.5 },
    })),
    agencyLogoUrl: input.brandingLogo?.imageUrl,
  };
  const layout = input.preview.layout === "minimal" ? "single-hero" : "hero-two-square";
  return new ImageResponse(
    <LandscapeComposition model={model} width={1200} height={630} requestedLayout={layout} />,
    { width: 1200, height: 630 },
  );
}
