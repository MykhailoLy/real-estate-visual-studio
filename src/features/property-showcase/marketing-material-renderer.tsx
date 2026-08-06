/* eslint-disable @next/next/no-img-element -- ImageResponse requires native image elements. */
import { ImageResponse } from "next/og";
import { focalPointToObjectPosition } from "./focal-point.ts";
import {
  effectiveLandscapeLayout,
  getPropertyMarketingRenderDimensions,
  isPortraitBrochureTemplate,
} from "./marketing-materials.ts";
import type {
  PreparedMarketingImage,
  PreparedPropertyMarketingAssets,
} from "./marketing-material-assets.ts";
import type { PropertySocialCardRenderInput } from "./social-image-response.ts";
import type {
  PropertyMarketingLandscapeLayout,
  PropertyMarketingPortraitLayout,
} from "./types.ts";

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
    <div style={{ width, height, display: "flex", overflow: "hidden" }}>
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

function Brand({ model, scale }: { model: SharedRenderModel; scale: number }) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  if (model.brandingMode === "unbranded") {
    return <div style={{ display: "flex", width: s(90), height: s(7), background: GOLD }} />;
  }
  if (model.brandingMode === "agency") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: s(20) }}>
        {model.agencyLogoUrl ? (
          <img
            src={model.agencyLogoUrl}
            alt=""
            style={{ width: s(140), height: s(78), objectFit: "contain" }}
          />
        ) : null}
        <span style={{ display: "flex", fontSize: s(32), fontWeight: 700 }}>
          {model.agencyName || "Agency"}
        </span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", fontSize: s(40), fontWeight: 700 }}>
      <span>Picchu</span><span style={{ color: GOLD }}>Spot</span>
    </div>
  );
}

function LandscapeFacts({ model, scale }: { model: SharedRenderModel; scale: number }) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  if (model.facts.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", width: "100%", borderTop: `${s(1)}px solid rgba(255,255,255,.2)`, paddingTop: s(25), marginTop: s(30) }}>
      {model.facts.slice(0, 4).map((fact) => (
        <div key={fact.key} style={{ width: "50%", display: "flex", flexDirection: "column", paddingRight: s(12), marginBottom: s(22) }}>
          <span style={{ display: "flex", color: "rgba(255,255,255,.56)", fontSize: s(15), fontWeight: 700, textTransform: "uppercase", letterSpacing: s(1) }}>{fact.label}</span>
          <span style={{ display: "flex", marginTop: s(5), fontSize: s(28), fontWeight: 700 }}>{fact.value}</span>
        </div>
      ))}
    </div>
  );
}

function LandscapeMedia({
  images,
  width,
  height,
  requestedLayout,
  title,
}: {
  images: PreparedMarketingImage[];
  width: number;
  height: number;
  requestedLayout: PropertyMarketingLandscapeLayout;
  title: string;
}) {
  const layout = effectiveLandscapeLayout(requestedLayout, images.length);
  const gap = Math.max(2, Math.round(width / 320));
  const primary = images[0];
  const supporting = images.slice(1, layout === "hero-four-grid" ? 5 : 3);
  if (!primary) {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", padding: Math.round(width * 0.08), background: NAVY, color: "white", textAlign: "center", fontSize: Math.round(width * 0.055), fontWeight: 700 }}>
        {title}
      </div>
    );
  }
  if (layout === "single-hero" || supporting.length === 0) {
    return <ImageTile image={primary} width={width} height={height} />;
  }
  const supportWidth = Math.round(width * (layout === "hero-four-grid" ? 0.39 : 0.33));
  const mainWidth = width - supportWidth - gap;
  return (
    <div style={{ width, height, display: "flex", gap }}>
      <ImageTile image={primary} width={mainWidth} height={height} />
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
  requestedLayout: PropertyMarketingLandscapeLayout;
}) {
  const scale = width / 1920;
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  const panelWidth = Math.round(width * 0.35);
  const photoWidth = width - panelWidth;
  return (
    <div style={{ width, height, display: "flex", overflow: "hidden", background: NAVY, color: "white", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <LandscapeMedia
        images={model.images}
        width={photoWidth}
        height={height}
        requestedLayout={requestedLayout}
        title={model.title}
      />
      <div style={{ width: panelWidth, height, display: "flex", flexDirection: "column", padding: `${s(58)}px ${s(48)}px ${s(46)}px`, background: NAVY }}>
        <Brand model={model} scale={scale} />
        <div style={{ display: "flex", flexDirection: "column", marginTop: s(42) }}>
          {model.location ? <span style={{ display: "flex", color: "rgba(255,255,255,.72)", fontSize: s(23) }}>{model.location}</span> : null}
          <span style={{ display: "flex", marginTop: model.location ? s(12) : 0, fontSize: s(47), lineHeight: 1.08, fontWeight: 700 }}>{model.title}</span>
          {model.price ? <span style={{ display: "flex", marginTop: s(22), color: "#dec373", fontSize: s(43), fontWeight: 700 }}>{model.price}</span> : null}
          {model.copy ? <span style={{ display: "flex", marginTop: s(20), color: "rgba(255,255,255,.74)", fontSize: s(19), lineHeight: 1.4 }}>{model.copy}</span> : null}
        </div>
        <LandscapeFacts model={model} scale={scale} />
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto", gap: s(18) }}>
          {model.agentName || model.agencyName ? (
            <div style={{ display: "flex", alignItems: "center", minWidth: 0, gap: s(15) }}>
              {model.agentPortraitUrl ? <img src={model.agentPortraitUrl} alt="" style={{ width: s(68), height: s(68), borderRadius: 999, objectFit: "cover" }} /> : null}
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ display: "flex", fontSize: s(17), fontWeight: 700 }}>{model.agentName || model.agencyName}</span>
                {model.agentRole ? <span style={{ display: "flex", color: "rgba(255,255,255,.58)", fontSize: s(13) }}>{model.agentRole}</span> : null}
              </div>
            </div>
          ) : <div style={{ display: "flex" }} />}
          {model.qrCodeUrl ? <img src={model.qrCodeUrl} alt="" style={{ width: s(118), height: s(118) }} /> : null}
        </div>
      </div>
    </div>
  );
}

function PortraitFacts({ model, scale }: { model: SharedRenderModel; scale: number }) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  if (model.facts.length === 0) return null;
  return (
    <div style={{ display: "flex", width: "100%", marginTop: s(46), padding: `${s(30)}px ${s(34)}px`, borderRadius: s(18), background: "#eef1f4" }}>
      {model.facts.slice(0, 4).map((fact) => (
        <div key={fact.key} style={{ width: `${100 / Math.min(model.facts.length, 4)}%`, display: "flex", flexDirection: "column", paddingRight: s(18) }}>
          <span style={{ display: "flex", color: "#64748b", fontSize: s(17), fontWeight: 700, textTransform: "uppercase" }}>{fact.label}</span>
          <span style={{ display: "flex", marginTop: s(8), color: NAVY, fontSize: s(32), fontWeight: 700 }}>{fact.value}</span>
        </div>
      ))}
    </div>
  );
}

function PortraitComposition({
  model,
  width,
  height,
  layout,
}: {
  model: SharedRenderModel;
  width: number;
  height: number;
  layout: PropertyMarketingPortraitLayout;
}) {
  const scale = width / 2480;
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  const editorial = layout === "a4-editorial";
  const primary = model.images[0];
  const supporting = model.images.slice(1, editorial ? 6 : 4);
  const heroHeight = Math.round(height * (editorial ? 0.49 : 0.43));
  const supportHeight = supporting.length > 0 ? Math.round(height * (editorial ? 0.125 : 0.15)) : 0;
  const contentPadding = editorial ? `${s(64)}px ${s(118)}px ${s(58)}px` : `${s(58)}px ${s(108)}px ${s(52)}px`;
  const hasAgent = Boolean(model.agentName || model.agencyName || model.agentPortraitUrl);
  return (
    <div style={{ width, height, display: "flex", flexDirection: "column", overflow: "hidden", background: editorial ? "#f7f4ed" : "white", color: NAVY, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ width, height: heroHeight, display: "flex", position: "relative", background: NAVY }}>
        {primary ? <ImageTile image={primary} width={width} height={heroHeight} /> : (
          <div style={{ width, height: heroHeight, display: "flex", alignItems: "center", justifyContent: "center", padding: s(120), color: "white", textAlign: "center", fontSize: s(78), fontWeight: 700 }}>{model.title}</div>
        )}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, minHeight: s(510), display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: `${s(82)}px ${s(118)}px`, background: "linear-gradient(0deg, rgba(11,31,58,.94), rgba(11,31,58,0))", color: "white" }}>
          {model.location ? <span style={{ display: "flex", fontSize: s(31), color: "rgba(255,255,255,.82)" }}>{model.location}</span> : null}
          <span style={{ display: "flex", marginTop: model.location ? s(16) : 0, fontSize: s(76), lineHeight: 1.04, fontWeight: 700 }}>{model.title}</span>
          {model.price ? <span style={{ display: "flex", marginTop: s(20), color: "#e2c779", fontSize: s(55), fontWeight: 700 }}>{model.price}</span> : null}
        </div>
      </div>
      {supporting.length > 0 ? (
        <div style={{ width, height: supportHeight, display: "flex", gap: s(8), padding: editorial ? `${s(10)}px ${s(72)}px 0` : `${s(10)}px 0 0` }}>
          {supporting.map((image) => (
            <ImageTile key={image.id} image={image} width={`${100 / supporting.length}%`} height={supportHeight - s(10)} />
          ))}
        </div>
      ) : null}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: contentPadding }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: s(34) }}>
          <Brand model={model} scale={scale} />
          {model.qrCodeUrl ? <img src={model.qrCodeUrl} alt="" style={{ width: s(190), height: s(190) }} /> : null}
        </div>
        <PortraitFacts model={model} scale={scale} />
        {model.copy || model.highlights.length > 0 ? (
          <div style={{ display: "flex", marginTop: s(42), gap: s(54) }}>
            {model.copy ? <span style={{ display: "flex", width: model.highlights.length > 0 ? "58%" : "100%", color: "#334155", fontSize: s(31), lineHeight: 1.45 }}>{model.copy}</span> : null}
            {model.highlights.length > 0 ? (
              <div style={{ width: model.copy ? "42%" : "100%", display: "flex", flexDirection: "column" }}>
                {model.highlights.map((highlight) => <span key={highlight} style={{ display: "flex", marginBottom: s(13), fontSize: s(27), lineHeight: 1.3, fontWeight: 700 }}>• {highlight}</span>)}
              </div>
            ) : null}
          </div>
        ) : null}
        {hasAgent || model.disclaimer ? (
          <div style={{ display: "flex", alignItems: "center", marginTop: "auto", borderTop: `${s(2)}px solid #d7dce2`, paddingTop: s(32), gap: s(26) }}>
            {hasAgent ? (
              <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                {model.agentPortraitUrl ? <img src={model.agentPortraitUrl} alt="" style={{ width: s(118), height: s(118), borderRadius: 999, objectFit: "cover" }} /> : null}
                <div style={{ display: "flex", flexDirection: "column", marginLeft: model.agentPortraitUrl ? s(24) : 0 }}>
                  <span style={{ display: "flex", fontSize: s(27), fontWeight: 700 }}>{model.agentName || model.agencyName}</span>
                  {model.agentRole ? <span style={{ display: "flex", marginTop: s(5), color: "#64748b", fontSize: s(19) }}>{model.agentRole}</span> : null}
                  {model.agentPhone ? <span style={{ display: "flex", marginTop: s(6), fontSize: s(20) }}>{model.agentPhone}</span> : null}
                </div>
              </div>
            ) : null}
            {model.disclaimer ? <span style={{ display: "flex", maxWidth: hasAgent ? "52%" : "100%", marginLeft: hasAgent ? "auto" : 0, textAlign: hasAgent ? "right" : "left", color: "#64748b", fontSize: s(16), lineHeight: 1.4 }}>{model.disclaimer}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function modelFromAssets(assets: PreparedPropertyMarketingAssets): SharedRenderModel {
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
    images: assets.images,
    agencyLogoUrl: assets.agencyLogoUrl,
    agentPortraitUrl: assets.agentPortraitUrl,
    qrCodeUrl: assets.qrCodeUrl,
  };
}

export function renderPropertyMarketingPng(
  assets: PreparedPropertyMarketingAssets,
  options: { preview?: boolean } = {},
) {
  const orientation = assets.view.config.brochure.orientation;
  const dimensions = getPropertyMarketingRenderDimensions(
    orientation,
    options.preview === true,
  );
  const template = assets.view.config.brochure.template;
  if (orientation === "portrait") {
    const layout = isPortraitBrochureTemplate(template) ? template : "a4-editorial";
    return new ImageResponse(
      <PortraitComposition
        model={modelFromAssets(assets)}
        width={dimensions.width}
        height={dimensions.height}
        layout={layout}
      />,
      dimensions,
    );
  }
  const layout = isPortraitBrochureTemplate(template) ? "hero-two-square" : template;
  return new ImageResponse(
    <LandscapeComposition
      model={modelFromAssets(assets)}
      width={dimensions.width}
      height={dimensions.height}
      requestedLayout={layout}
    />,
    dimensions,
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
    <LandscapeComposition
      model={model}
      width={1200}
      height={630}
      requestedLayout={layout}
    />,
    { width: 1200, height: 630 },
  );
}
