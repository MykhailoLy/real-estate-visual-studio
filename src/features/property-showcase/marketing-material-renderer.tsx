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

const WHITE = "#ffffff";
const NAVY = "#0B1F3A";
const GOLD = "#B88A44";
const CHARCOAL = "#182230";
const MUTED = "#667085";
const BORDER = "#dfe4ea";

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

function truncate(value: string, maximum: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximum) return normalized;
  const candidate = normalized.slice(0, maximum + 1);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary > maximum * 0.65 ? boundary : maximum).trim()}…`;
}

function ImageTile({
  image,
  width,
  height,
}: {
  image: PreparedMarketingImage;
  width: number;
  height: number;
}) {
  return (
    <div style={{ width, height, display: "flex", flexShrink: 0, overflow: "hidden" }}>
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

function MediaRow({
  images,
  width,
  height,
  gap,
}: {
  images: PreparedMarketingImage[];
  width: number;
  height: number;
  gap: number;
}) {
  const available = width - gap * Math.max(0, images.length - 1);
  const baseWidth = Math.floor(available / Math.max(1, images.length));
  return (
    <div style={{ width, height, display: "flex", gap }}>
      {images.map((image, index) => {
        const used = baseWidth * (images.length - 1);
        const tileWidth = index === images.length - 1 ? available - used : baseWidth;
        return <ImageTile key={image.id} image={image} width={tileWidth} height={height} />;
      })}
    </div>
  );
}

function MediaColumn({
  images,
  width,
  height,
  gap,
}: {
  images: PreparedMarketingImage[];
  width: number;
  height: number;
  gap: number;
}) {
  const available = height - gap * Math.max(0, images.length - 1);
  const baseHeight = Math.floor(available / Math.max(1, images.length));
  return (
    <div style={{ width, height, display: "flex", flexDirection: "column", gap }}>
      {images.map((image, index) => {
        const used = baseHeight * (images.length - 1);
        const tileHeight = index === images.length - 1 ? available - used : baseHeight;
        return <ImageTile key={image.id} image={image} width={width} height={tileHeight} />;
      })}
    </div>
  );
}

function LandscapeMedia({
  images,
  width,
  height,
  requestedLayout,
  title,
  fallbackBackground = WHITE,
  fallbackColor = NAVY,
  supportingWidthRatio,
}: {
  images: PreparedMarketingImage[];
  width: number;
  height: number;
  requestedLayout: PropertyMarketingLandscapeLayout;
  title: string;
  fallbackBackground?: string;
  fallbackColor?: string;
  supportingWidthRatio?: number;
}) {
  const layout = effectiveLandscapeLayout(requestedLayout, images.length);
  const gap = Math.max(2, Math.round(width / 320));
  const primary = images[0];
  const supporting = images.slice(1, layout === "hero-four-grid" ? 5 : 3);
  if (!primary) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: Math.round(width * 0.08),
          background: fallbackBackground,
          color: fallbackColor,
          textAlign: "center",
          fontSize: Math.round(width * 0.055),
          fontWeight: 700,
        }}
      >
        {title}
      </div>
    );
  }
  if (layout === "single-hero" || supporting.length === 0) {
    return <ImageTile image={primary} width={width} height={height} />;
  }

  const supportWidth = Math.round(
    width * (supportingWidthRatio ?? (layout === "hero-four-grid" ? 0.38 : 0.31)),
  );
  const mainWidth = width - supportWidth - gap;
  if (layout === "hero-two-square") {
    return (
      <div style={{ width, height, display: "flex", gap, background: fallbackBackground }}>
        <ImageTile image={primary} width={mainWidth} height={height} />
        <MediaColumn images={supporting} width={supportWidth} height={height} gap={gap} />
      </div>
    );
  }

  const firstRow = supporting.length === 3
    ? supporting.slice(0, 1)
    : supporting.slice(0, 2);
  const secondRow = supporting.slice(firstRow.length);
  const firstHeight = Math.floor((height - gap) / 2);
  const secondHeight = height - gap - firstHeight;
  return (
    <div style={{ width, height, display: "flex", gap, background: fallbackBackground }}>
      <ImageTile image={primary} width={mainWidth} height={height} />
      <div style={{ width: supportWidth, height, display: "flex", flexDirection: "column", gap }}>
        <MediaRow images={firstRow} width={supportWidth} height={firstHeight} gap={gap} />
        <MediaRow images={secondRow} width={supportWidth} height={secondHeight} gap={gap} />
      </div>
    </div>
  );
}

function BrochureBrand({
  model,
  scale,
  portrait = false,
}: {
  model: SharedRenderModel;
  scale: number;
  portrait?: boolean;
}) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  const showAgencyIdentity =
    model.brandingMode === "agency" ||
    (model.brandingMode === "unbranded" && Boolean(model.agencyLogoUrl));
  if (showAgencyIdentity) {
    if (model.agencyLogoUrl) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <img
            src={model.agencyLogoUrl}
            alt=""
            style={{ width: s(portrait ? 390 : 270), height: s(portrait ? 170 : 124), objectFit: "contain", objectPosition: "left center" }}
          />
          {model.agencyName ? (
            <span style={{ display: "flex", marginTop: s(8), color: MUTED, fontSize: s(18), fontWeight: 700 }}>
              {truncate(model.agencyName, 58)}
            </span>
          ) : null}
        </div>
      );
    }
    return model.agencyName ? (
      <span style={{ display: "flex", color: NAVY, fontSize: s(36), fontWeight: 700 }}>
        {truncate(model.agencyName, 58)}
      </span>
    ) : null;
  }
  if (model.brandingMode === "unbranded") return null;
  return (
    <div style={{ display: "flex", color: NAVY, fontSize: s(42), fontWeight: 700, letterSpacing: s(-1) }}>
      <span>Picchu</span><span style={{ color: GOLD }}>Spot</span>
    </div>
  );
}

function identityName(model: SharedRenderModel): string {
  return model.agentName;
}

function hasRealtor(model: SharedRenderModel): boolean {
  return Boolean(identityName(model) || model.agentRole || model.agentPhone || model.agentPortraitUrl);
}

function hasBrochureBrand(model: SharedRenderModel): boolean {
  return model.brandingMode !== "unbranded" || Boolean(model.agencyLogoUrl);
}

function RealtorIdentity({
  model,
  scale,
  portrait = false,
}: {
  model: SharedRenderModel;
  scale: number;
  portrait?: boolean;
}) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  const name = identityName(model);
  if (!hasRealtor(model)) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", minWidth: 0, gap: s(portrait ? 30 : 22) }}>
      {model.agentPortraitUrl ? (
        <img
          src={model.agentPortraitUrl}
          alt=""
          style={{
            width: s(portrait ? 154 : 112),
            height: s(portrait ? 154 : 112),
            borderRadius: 999,
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        {name ? (
          <span style={{ display: "flex", color: CHARCOAL, fontSize: s(portrait ? 48 : 40), lineHeight: 1.05, fontWeight: 700 }}>
            {truncate(name, 48)}
          </span>
        ) : null}
        {model.agentRole ? (
          <span style={{ display: "flex", marginTop: s(7), color: MUTED, fontSize: s(portrait ? 24 : 21), lineHeight: 1.15 }}>
            {truncate(model.agentRole, 54)}
          </span>
        ) : null}
        {model.agentPhone ? (
          <span style={{ display: "flex", marginTop: s(10), color: NAVY, fontSize: s(portrait ? 38 : 32), lineHeight: 1, fontWeight: 700 }}>
            {truncate(model.agentPhone, 32)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function LandscapeFacts({ model, scale }: { model: SharedRenderModel; scale: number }) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  if (model.facts.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", width: "100%", borderTop: `${s(1)}px solid ${BORDER}`, paddingTop: s(22), marginTop: s(26) }}>
      {model.facts.slice(0, 4).map((fact) => (
        <div key={fact.key} style={{ width: "50%", display: "flex", flexDirection: "column", paddingRight: s(12), marginBottom: s(18) }}>
          <span style={{ display: "flex", color: MUTED, fontSize: s(15), fontWeight: 700, textTransform: "uppercase", letterSpacing: s(1) }}>{fact.label}</span>
          <span style={{ display: "flex", marginTop: s(5), color: CHARCOAL, fontSize: s(27), fontWeight: 700 }}>{fact.value}</span>
        </div>
      ))}
    </div>
  );
}

function MarketingCopy({ model, scale }: { model: SharedRenderModel; scale: number }) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  if (!model.copy && model.highlights.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: s(18) }}>
      {model.copy ? (
        <span style={{ display: "flex", color: "#475467", fontSize: s(18), lineHeight: 1.4 }}>
          {truncate(model.copy, 190)}
        </span>
      ) : null}
      {model.highlights.slice(0, 3).map((highlight) => (
        <div key={highlight} style={{ display: "flex", alignItems: "flex-start", marginTop: s(9), color: CHARCOAL, fontSize: s(18), lineHeight: 1.28, fontWeight: 600 }}>
          <span style={{ display: "flex", marginRight: s(10), color: NAVY }}>•</span>
          <span style={{ display: "flex" }}>{truncate(highlight, 76)}</span>
        </div>
      ))}
    </div>
  );
}

function LandscapeBrochureComposition({
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
  const panelWidth = Math.round(width * 0.33);
  const photoWidth = width - panelWidth;
  return (
    <div style={{ width, height, display: "flex", overflow: "hidden", background: WHITE, color: CHARCOAL, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <LandscapeMedia
        images={model.images}
        width={photoWidth}
        height={height}
        requestedLayout={requestedLayout}
        title={model.title}
      />
      <div style={{ width: panelWidth, height, display: "flex", flexDirection: "column", padding: `${s(42)}px ${s(42)}px ${s(36)}px`, borderLeft: `${s(1)}px solid ${BORDER}`, background: WHITE }}>
        <BrochureBrand model={model} scale={scale} />
        {hasRealtor(model) ? (
          <div style={{ display: "flex", marginTop: s(28) }}>
            <RealtorIdentity model={model} scale={scale} />
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", marginTop: s(hasRealtor(model) ? 28 : 34) }}>
          {model.location ? <span style={{ display: "flex", color: MUTED, fontSize: s(21), lineHeight: 1.2 }}>{truncate(model.location, 68)}</span> : null}
          <span style={{ display: "flex", marginTop: model.location ? s(9) : 0, color: CHARCOAL, fontSize: s(45), lineHeight: 1.04, fontWeight: 700 }}>{truncate(model.title, 82)}</span>
          {model.price ? <span style={{ display: "flex", marginTop: s(17), color: NAVY, fontSize: s(39), lineHeight: 1, fontWeight: 700 }}>{truncate(model.price, 32)}</span> : null}
        </div>
        <LandscapeFacts model={model} scale={scale} />
        <MarketingCopy model={model} scale={scale} />
        {model.qrCodeUrl || model.disclaimer ? (
          <div style={{ display: "flex", alignItems: "flex-end", marginTop: "auto", paddingTop: s(18), gap: s(18) }}>
            {model.qrCodeUrl ? <img src={model.qrCodeUrl} alt="" style={{ width: s(116), height: s(116), flexShrink: 0 }} /> : null}
            {model.disclaimer ? <span style={{ display: "flex", color: MUTED, fontSize: s(13), lineHeight: 1.35 }}>{truncate(model.disclaimer, 150)}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PortraitFacts({ model, scale }: { model: SharedRenderModel; scale: number }) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  if (model.facts.length === 0) return null;
  return (
    <div style={{ display: "flex", width: "100%", marginTop: s(38), padding: `${s(25)}px 0`, borderTop: `${s(2)}px solid ${BORDER}`, borderBottom: `${s(2)}px solid ${BORDER}` }}>
      {model.facts.slice(0, 4).map((fact) => (
        <div key={fact.key} style={{ width: `${100 / Math.min(model.facts.length, 4)}%`, display: "flex", flexDirection: "column", paddingRight: s(18) }}>
          <span style={{ display: "flex", color: MUTED, fontSize: s(17), fontWeight: 700, textTransform: "uppercase" }}>{fact.label}</span>
          <span style={{ display: "flex", marginTop: s(7), color: CHARCOAL, fontSize: s(31), fontWeight: 700 }}>{fact.value}</span>
        </div>
      ))}
    </div>
  );
}

function PortraitMedia({
  images,
  width,
  height,
  layout,
  title,
}: {
  images: PreparedMarketingImage[];
  width: number;
  height: number;
  layout: PropertyMarketingPortraitLayout;
  title: string;
}) {
  const gap = Math.max(3, Math.round(width / 310));
  const primary = images[0];
  const supporting = images.slice(1, layout === "a4-editorial" ? 6 : 4);
  if (!primary) {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", padding: Math.round(width * 0.09), background: WHITE, color: NAVY, textAlign: "center", fontSize: Math.round(width * 0.048), fontWeight: 700 }}>
        {title}
      </div>
    );
  }
  if (supporting.length === 0) return <ImageTile image={primary} width={width} height={height} />;

  if (layout === "a4-editorial") {
    const supportWidth = Math.round(width * 0.28);
    const mainWidth = width - supportWidth - gap;
    return (
      <div style={{ width, height, display: "flex", gap, background: WHITE }}>
        <ImageTile image={primary} width={mainWidth} height={height} />
        <MediaColumn images={supporting} width={supportWidth} height={height} gap={gap} />
      </div>
    );
  }

  const stripHeight = Math.round(height * 0.25);
  const mainHeight = height - stripHeight - gap;
  return (
    <div style={{ width, height, display: "flex", flexDirection: "column", gap, background: WHITE }}>
      <ImageTile image={primary} width={width} height={mainHeight} />
      <MediaRow images={supporting} width={width} height={stripHeight} gap={gap} />
    </div>
  );
}

function PortraitBrochureComposition({
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
  const hasHeader = hasRealtor(model) || hasBrochureBrand(model);
  const headerHeight = hasHeader ? Math.round(height * 0.105) : 0;
  const mediaHeight = Math.round(height * (layout === "a4-editorial" ? (hasHeader ? 0.48 : 0.56) : (hasHeader ? 0.45 : 0.53)));
  return (
    <div style={{ width, height, display: "flex", flexDirection: "column", overflow: "hidden", background: WHITE, color: CHARCOAL, fontFamily: "Arial, Helvetica, sans-serif" }}>
      {hasHeader ? (
        <div style={{ width, height: headerHeight, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${s(48)}px ${s(104)}px`, borderBottom: `${s(2)}px solid ${BORDER}`, background: WHITE, gap: s(45) }}>
          <RealtorIdentity model={model} scale={scale} portrait />
          <BrochureBrand model={model} scale={scale} portrait />
        </div>
      ) : null}
      <PortraitMedia images={model.images} width={width} height={mediaHeight} layout={layout} title={model.title} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: `${s(55)}px ${s(108)}px ${s(45)}px`, background: WHITE }}>
        {model.location ? <span style={{ display: "flex", color: MUTED, fontSize: s(27), lineHeight: 1.2, textTransform: "uppercase", letterSpacing: s(1) }}>{truncate(model.location, 92)}</span> : null}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: s(40), marginTop: model.location ? s(12) : 0 }}>
          <span style={{ display: "flex", maxWidth: model.price ? "72%" : "100%", color: CHARCOAL, fontSize: s(68), lineHeight: 1.03, fontWeight: 700 }}>{truncate(model.title, 96)}</span>
          {model.price ? <span style={{ display: "flex", flexShrink: 0, color: NAVY, fontSize: s(50), lineHeight: 1, fontWeight: 700 }}>{truncate(model.price, 34)}</span> : null}
        </div>
        <PortraitFacts model={model} scale={scale} />
        {model.copy || model.highlights.length > 0 ? (
          <div style={{ display: "flex", marginTop: s(34), gap: s(48) }}>
            {model.copy ? <span style={{ display: "flex", width: "100%", color: "#475467", fontSize: s(28), lineHeight: 1.42 }}>{truncate(model.copy, 200)}</span> : null}
            {model.highlights.length > 0 ? (
              <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
                {model.highlights.slice(0, 3).map((highlight) => (
                  <div key={highlight} style={{ display: "flex", marginBottom: s(12), color: CHARCOAL, fontSize: s(27), lineHeight: 1.28, fontWeight: 600 }}>
                    <span style={{ display: "flex", marginRight: s(14), color: NAVY }}>•</span>
                    <span style={{ display: "flex" }}>{truncate(highlight, 92)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {model.qrCodeUrl || model.disclaimer ? (
          <div style={{ display: "flex", alignItems: "flex-end", marginTop: "auto", paddingTop: s(24), borderTop: `${s(2)}px solid ${BORDER}`, gap: s(28) }}>
            {model.qrCodeUrl ? <img src={model.qrCodeUrl} alt="" style={{ width: s(205), height: s(205), flexShrink: 0 }} /> : null}
            {model.disclaimer ? <span style={{ display: "flex", color: MUTED, fontSize: s(16), lineHeight: 1.4 }}>{truncate(model.disclaimer, 180)}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SocialBrand({ model, scale }: { model: SharedRenderModel; scale: number }) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  if (model.brandingMode === "unbranded") {
    return <div style={{ display: "flex", width: s(90), height: s(7), background: GOLD }} />;
  }
  if (model.brandingMode === "agency") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: s(20) }}>
        {model.agencyLogoUrl ? <img src={model.agencyLogoUrl} alt="" style={{ width: s(140), height: s(78), objectFit: "contain" }} /> : null}
        <span style={{ display: "flex", fontSize: s(32), fontWeight: 700 }}>{model.agencyName || "Agency"}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", fontSize: s(40), fontWeight: 700 }}>
      <span>Picchu</span><span style={{ color: GOLD }}>Spot</span>
    </div>
  );
}

function SocialFacts({ model, scale }: { model: SharedRenderModel; scale: number }) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  if (model.facts.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", width: "100%", borderTop: `${s(1)}px solid rgba(255,255,255,.2)`, paddingTop: s(25), marginTop: s(30) }}>
      {model.facts.slice(0, 4).map((fact) => (
        <div key={fact.key} style={{ width: "50%", display: "flex", flexDirection: "column", paddingRight: s(12), marginBottom: s(22) }}>
          <span style={{ display: "flex", color: "rgba(255,255,255,.56)", fontSize: s(15), fontWeight: 700, textTransform: "uppercase", letterSpacing: s(1) }}>{fact.label}</span>
          <span style={{ display: "flex", marginTop: s(5), color: WHITE, fontSize: s(28), fontWeight: 700 }}>{fact.value}</span>
        </div>
      ))}
    </div>
  );
}

function SocialLandscapeComposition({
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
    <div style={{ width, height, display: "flex", overflow: "hidden", background: NAVY, color: WHITE, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <LandscapeMedia
        images={model.images}
        width={photoWidth}
        height={height}
        requestedLayout={requestedLayout}
        title={model.title}
        fallbackBackground={NAVY}
        fallbackColor={WHITE}
        supportingWidthRatio={requestedLayout === "hero-four-grid" ? 0.39 : 0.33}
      />
      <div style={{ width: panelWidth, height, display: "flex", flexDirection: "column", padding: `${s(58)}px ${s(48)}px ${s(46)}px`, background: NAVY }}>
        <SocialBrand model={model} scale={scale} />
        <div style={{ display: "flex", flexDirection: "column", marginTop: s(42) }}>
          {model.location ? <span style={{ display: "flex", color: "rgba(255,255,255,.72)", fontSize: s(23) }}>{model.location}</span> : null}
          <span style={{ display: "flex", marginTop: model.location ? s(12) : 0, fontSize: s(47), lineHeight: 1.08, fontWeight: 700 }}>{model.title}</span>
          {model.price ? <span style={{ display: "flex", marginTop: s(22), color: "#dec373", fontSize: s(43), fontWeight: 700 }}>{model.price}</span> : null}
        </div>
        <SocialFacts model={model} scale={scale} />
      </div>
    </div>
  );
}

function modelFromAssets(assets: PreparedPropertyMarketingAssets): SharedRenderModel {
  const { view } = assets;
  const useHighlights = view.config.marketingCopyMode === "highlights";
  return {
    title: view.title,
    location: view.location,
    price: view.price,
    facts: view.facts,
    copy: useHighlights ? "" : view.copy,
    highlights: useHighlights ? view.highlights : [],
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
  const dimensions = getPropertyMarketingRenderDimensions(orientation, options.preview === true);
  const template = assets.view.config.brochure.template;
  if (orientation === "portrait") {
    const layout = isPortraitBrochureTemplate(template) ? template : "a4-editorial";
    return new ImageResponse(
      <PortraitBrochureComposition model={modelFromAssets(assets)} width={dimensions.width} height={dimensions.height} layout={layout} />,
      dimensions,
    );
  }
  const layout = isPortraitBrochureTemplate(template) ? "hero-two-square" : template;
  return new ImageResponse(
    <LandscapeBrochureComposition model={modelFromAssets(assets)} width={dimensions.width} height={dimensions.height} requestedLayout={layout} />,
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
    <SocialLandscapeComposition model={model} width={1200} height={630} requestedLayout={layout} />,
    { width: 1200, height: 630 },
  );
}
