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

const WHITE = "#FFFFFF";
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
  customFacts: Array<{ key: string; label: string; value: string }>;
  copy: string;
  highlights: string[];
  qrLabel: string;
  qrFeatures: string[];
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
  primaryColor: string;
  accentColor: string;
  accentTextColor: string;
  primaryForeground: "#0B1020" | "#FFFFFF";
  brandingAttribution?: string;
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
  if (model.brandingMode === "picchuspot") return true;
  return Boolean(model.agencyName || model.agencyLogoUrl);
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

function portraitFactGlyph(key: string): string {
  if (key === "bedrooms") return "B";
  if (key === "bathrooms") return "W";
  if (key === "parking") return "P";
  if (key === "built-area" || key === "plot-area") return "A";
  if (key === "year-built") return "Y";
  return "i";
}

function PortraitFacts({ model, scale }: { model: SharedRenderModel; scale: number }) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  const facts = model.facts.slice(0, 6);
  if (facts.length === 0) return null;
  const count = facts.length;
  return (
    <div style={{ display: "flex", width: "100%", marginTop: s(30), padding: `${s(23)}px 0`, borderTop: `${s(2)}px solid ${BORDER}`, borderBottom: `${s(2)}px solid ${BORDER}` }}>
      {facts.map((fact, index) => (
        <div key={fact.key} style={{ width: `${100 / count}%`, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: `0 ${s(10)}px`, borderRight: index === count - 1 ? "none" : `${s(1)}px solid ${BORDER}` }}>
          <span style={{ width: s(26), height: s(26), display: "flex", alignItems: "center", justifyContent: "center", color: NAVY, border: `${s(1)}px solid ${NAVY}`, borderRadius: s(13), fontSize: s(15), lineHeight: 1, fontWeight: 700 }}>{portraitFactGlyph(fact.key)}</span>
          <span style={{ display: "flex", marginTop: s(5), color: CHARCOAL, fontSize: s(count > 5 ? 34 : 38), lineHeight: 1, fontWeight: 700 }}>{truncate(fact.value, 15)}</span>
          <span style={{ display: "flex", marginTop: s(8), color: MUTED, fontSize: s(count > 5 ? 15 : 17), lineHeight: 1.05, fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: s(1) }}>{truncate(fact.label, 18)}</span>
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
  const supporting = images.slice(1, 3);
  if (!primary) {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", padding: Math.round(width * 0.09), background: WHITE, color: NAVY, textAlign: "center", fontSize: Math.round(width * 0.048), fontWeight: 700 }}>
        {title}
      </div>
    );
  }
  if (supporting.length === 0) return <ImageTile image={primary} width={width} height={height} />;

  const supportWidth = Math.round(width * (layout === "a4-editorial" ? 0.33 : 0.32));
  const mainWidth = width - supportWidth - gap;
  return (
    <div style={{ width, height, display: "flex", gap, background: WHITE }}>
      <ImageTile image={primary} width={mainWidth} height={height} />
      <MediaColumn images={supporting} width={supportWidth} height={height} gap={gap} />
    </div>
  );
}

function PortraitEditorialDetails({
  model,
  scale,
  contentHeight,
}: {
  model: SharedRenderModel;
  scale: number;
  contentHeight: number;
}) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  const availableHeight = Math.max(
    s(180),
    contentHeight - s(model.copy ? 470 : 360),
  );
  const customRowHeight = Math.max(
    s(
      model.customFacts.length > 10
        ? 34
        : model.customFacts.length > 6
          ? 40
          : 48,
    ),
    s(30),
  );
  const maxCustomFacts = Math.max(
    1,
    Math.floor((availableHeight - s(58)) / customRowHeight),
  );
  const visibleCustomFacts = model.customFacts.slice(0, maxCustomFacts);
  const hasMoreCustomFacts = model.customFacts.length > visibleCustomFacts.length;
  const maxHighlights = Math.max(
    1,
    Math.floor((availableHeight - s(58)) / s(38)),
  );
  const visibleHighlights = model.highlights.slice(0, maxHighlights);
  const columnWidth = model.highlights.length > 0 && model.customFacts.length > 0
    ? "50%"
    : "100%";
  const spreadSparseRows =
    model.highlights.length + model.customFacts.length <= 4;
  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, marginTop: s(28), gap: s(54) }}>
      {model.highlights.length > 0 ? (
        <div style={{ width: columnWidth, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ display: "flex", color: GOLD, fontSize: s(22), lineHeight: 1, fontWeight: 700, letterSpacing: s(1), textTransform: "uppercase" }}>Highlights</span>
          <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: spreadSparseRows ? "space-between" : "flex-start", marginTop: s(20), gap: spreadSparseRows ? 0 : s(12) }}>
            {visibleHighlights.map((highlight, index) => (
              <div key={`${highlight}-${index}`} style={{ display: "flex", minWidth: 0, color: CHARCOAL, fontSize: s(22), lineHeight: 1.2 }}>
                <span style={{ width: s(9), height: s(9), display: "flex", flexShrink: 0, marginTop: s(8), marginRight: s(12), borderRadius: s(9), background: GOLD }} />
                <span style={{ display: "flex", minWidth: 0 }}>{truncate(highlight, 112)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {model.customFacts.length > 0 ? (
        <div style={{ width: columnWidth, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ display: "flex", color: GOLD, fontSize: s(22), lineHeight: 1, fontWeight: 700, letterSpacing: s(1), textTransform: "uppercase" }}>Custom facts</span>
          <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: spreadSparseRows ? "space-between" : "flex-start", marginTop: s(16), borderTop: `${s(1)}px solid ${BORDER}` }}>
            {visibleCustomFacts.map((fact) => (
              <div key={fact.key} style={{ minHeight: customRowHeight, display: "flex", alignItems: "center", justifyContent: "space-between", gap: s(18), borderBottom: `${s(1)}px solid ${BORDER}` }}>
                <span style={{ display: "flex", minWidth: 0, color: MUTED, fontSize: s(model.customFacts.length > 10 ? 17 : 19), lineHeight: 1.1 }}>{truncate(fact.label, 36)}</span>
                <span style={{ display: "flex", maxWidth: "52%", color: CHARCOAL, fontSize: s(model.customFacts.length > 10 ? 17 : 19), lineHeight: 1.1, fontWeight: 700, textAlign: "right" }}>{truncate(fact.value, 32)}</span>
              </div>
            ))}
          </div>
          {hasMoreCustomFacts ? <span style={{ display: "flex", marginTop: s(13), color: MUTED, fontSize: s(16), lineHeight: 1.2 }}>More property details available online</span> : null}
        </div>
      ) : null}
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
  const hasFooter = Boolean(model.qrCodeUrl || model.disclaimer);
  const headerHeight = hasHeader ? Math.round(height * 0.09) : 0;
  const footerHeight = hasFooter ? Math.round(height * 0.095) : 0;
  const contentWeight =
    model.highlights.length + model.customFacts.length + (model.copy ? 2 : 0);
  const hasSparseDetails = contentWeight < 7;
  const mediaHeight = Math.round(height * (hasSparseDetails ? 0.47 : 0.405));
  const detailsHeight = height - headerHeight - mediaHeight - footerHeight;
  return (
    <div style={{ width, height, display: "flex", flexDirection: "column", overflow: "hidden", background: WHITE, color: CHARCOAL, fontFamily: "Arial, Helvetica, sans-serif" }}>
      {hasHeader ? (
        <div style={{ width, height: headerHeight, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${s(38)}px ${s(104)}px`, borderBottom: `${s(2)}px solid ${BORDER}`, background: WHITE, gap: s(45) }}>
          <RealtorIdentity model={model} scale={scale} portrait />
          <BrochureBrand model={model} scale={scale} portrait />
        </div>
      ) : null}
      <PortraitMedia images={model.images} width={width} height={mediaHeight} layout={layout} title={model.title} />
      <div style={{ height: detailsHeight, minHeight: 0, display: "flex", flexDirection: "column", padding: `${s(40)}px ${s(108)}px ${s(24)}px`, background: WHITE }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
        {model.location ? <span style={{ display: "flex", color: MUTED, fontSize: s(24), lineHeight: 1.2, textTransform: "uppercase", letterSpacing: s(1.4) }}>{truncate(model.location, 106)}</span> : null}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: s(40), marginTop: model.location ? s(12) : 0 }}>
          <span style={{ display: "flex", maxWidth: model.price ? "70%" : "100%", color: NAVY, fontSize: s(64), lineHeight: 1.03, fontWeight: 700 }}>{truncate(model.title, 82)}</span>
          {model.price ? <span style={{ display: "flex", flexShrink: 0, color: GOLD, fontSize: s(50), lineHeight: 1, fontWeight: 700 }}>{truncate(model.price, 34)}</span> : null}
        </div>
        <PortraitFacts model={model} scale={scale} />
        </div>
        {model.copy ? <span style={{ display: "flex", marginTop: s(22), color: "#475467", fontSize: s(22), lineHeight: 1.35 }}>{truncate(model.copy, 330)}</span> : null}
        <PortraitEditorialDetails model={model} scale={scale} contentHeight={detailsHeight} />
      </div>
      {hasFooter ? (
        <div style={{ height: footerHeight, display: "flex", flexDirection: "column", padding: `0 ${s(108)}px ${s(24)}px`, background: WHITE }}>
          <div style={{ display: "flex", flex: 1, alignItems: "center", borderTop: `${s(2)}px solid ${BORDER}`, gap: s(28) }}>
            {model.qrCodeUrl ? <img src={model.qrCodeUrl} alt="" style={{ width: s(178), height: s(178), flexShrink: 0 }} /> : null}
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: s(9) }}>
              {model.qrCodeUrl ? <span style={{ display: "flex", color: CHARCOAL, fontSize: s(23), lineHeight: 1.15, fontWeight: 700, textTransform: "uppercase" }}>{model.qrLabel}</span> : null}
              {model.qrFeatures.length > 0 ? <span style={{ display: "flex", color: MUTED, fontSize: s(18), lineHeight: 1.2 }}>{model.qrFeatures.join("  |  ")}</span> : null}
              {model.disclaimer ? <span style={{ display: "flex", color: MUTED, fontSize: s(14), lineHeight: 1.25 }}>{truncate(model.disclaimer, 190)}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SocialBrand({ model, scale }: { model: SharedRenderModel; scale: number }) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  if (model.brandingMode === "unbranded") {
    return <div style={{ display: "flex", width: s(48), height: s(4), background: model.accentColor }} />;
  }
  const agency = model.brandingMode === "agency";
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: s(5) }}>
      <div style={{ display: "flex", alignItems: "center", minWidth: 0, gap: s(12) }}>
        {agency && model.agencyLogoUrl ? (
          <div style={{ width: s(98), height: s(48), display: "flex", flexShrink: 0, alignItems: "center", justifyContent: "center", padding: s(7), borderRadius: s(6), background: "#f8f8f6" }}>
            <img src={model.agencyLogoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        ) : !agency ? (
          <div style={{ width: s(98), height: s(48), display: "flex", flexShrink: 0, alignItems: "center", justifyContent: "center", padding: s(7), borderRadius: s(6), background: "#f8f8f6" }}>
          <span style={{ display: "flex", color: NAVY, fontSize: s(18), fontWeight: 700, letterSpacing: s(-0.5) }}><span>Picchu</span><span style={{ color: GOLD }}>Spot</span></span>
          </div>
        ) : null}
        {agency || model.agencyName ? <span style={{ display: "flex", minWidth: 0, color: model.primaryForeground, fontSize: s(16), lineHeight: 1.1, fontWeight: 700 }}>{truncate(model.agencyName || "Agency", 26)}</span> : null}
      </div>
      {model.brandingAttribution ? <span style={{ display: "flex", color: model.primaryForeground === WHITE ? "rgba(255,255,255,.56)" : "rgba(11,16,32,.56)", fontSize: s(9), lineHeight: 1.1, letterSpacing: s(0.35), textTransform: "uppercase" }}>{model.brandingAttribution}</span> : null}
    </div>
  );
}

function SocialFacts({ model, scale }: { model: SharedRenderModel; scale: number }) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  if (model.facts.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", width: "100%", borderTop: `${s(1)}px solid ${model.primaryForeground === WHITE ? "rgba(255,255,255,.2)" : "rgba(11,16,32,.2)"}`, paddingTop: s(14), marginTop: s(16) }}>
      {model.facts.slice(0, 4).map((fact) => (
        <div key={fact.key} style={{ width: "50%", display: "flex", flexDirection: "column", paddingRight: s(8), marginBottom: s(12) }}>
          <span style={{ display: "flex", color: model.accentTextColor, fontSize: s(10), fontWeight: 700, textTransform: "uppercase", letterSpacing: s(0.7) }}>{truncate(fact.label, 16)}</span>
          <span style={{ display: "flex", marginTop: s(3), color: model.primaryForeground, fontSize: s(18), lineHeight: 1, fontWeight: 700 }}>{truncate(fact.value, 14)}</span>
        </div>
      ))}
    </div>
  );
}

function SocialMedia({
  images,
  width,
  height,
  title,
  showSupporting,
}: {
  images: PreparedMarketingImage[];
  width: number;
  height: number;
  title: string;
  showSupporting: boolean;
}) {
  const gap = 3;
  const primary = images[0];
  const supporting = showSupporting ? images.slice(1, 3) : [];
  if (!primary) {
    return <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", padding: 56, background: NAVY, color: WHITE, textAlign: "center", fontSize: 30, fontWeight: 700 }}>{truncate(title, 58)}</div>;
  }
  if (supporting.length === 0) return <ImageTile image={primary} width={width} height={height} />;
  const supportWidth = 261;
  const primaryWidth = width - supportWidth - gap;
  return (
    <div style={{ width, height, display: "flex", gap, background: NAVY }}>
      <ImageTile image={primary} width={primaryWidth} height={height} />
      <MediaColumn images={supporting} width={supportWidth} height={height} gap={gap} />
    </div>
  );
}

function SocialSupplementalDetails({ model, scale }: { model: SharedRenderModel; scale: number }) {
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  const detailRows = Math.max(
    1,
    5 - (model.location ? 1 : 0) - (model.price ? 1 : 0) - Math.ceil(Math.min(model.facts.length, 4) / 2),
  );
  const visibleHighlights = model.highlights.slice(0, Math.min(3, detailRows));
  const remainingRows = Math.max(0, detailRows - visibleHighlights.length);
  const visibleCustomFacts = model.customFacts.slice(0, remainingRows);
  if (visibleHighlights.length === 0 && visibleCustomFacts.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: s(2), gap: s(7) }}>
      {visibleHighlights.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: s(4) }}>
          <span style={{ display: "flex", color: model.accentTextColor, fontSize: s(10), fontWeight: 700, letterSpacing: s(0.8), textTransform: "uppercase" }}>Highlights</span>
          {visibleHighlights.map((highlight, index) => <div key={`${highlight}-${index}`} style={{ display: "flex", color: model.primaryForeground, fontSize: s(12), lineHeight: 1.15 }}><span style={{ width: s(7), height: s(7), display: "flex", flexShrink: 0, marginTop: s(4), marginRight: s(6), borderRadius: s(7), background: model.accentColor }} /><span style={{ display: "flex" }}>{truncate(highlight, 38)}</span></div>)}
        </div>
      ) : null}
      {visibleCustomFacts.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", marginTop: visibleHighlights.length > 0 ? s(3) : 0, gap: s(4) }}>
          <span style={{ display: "flex", color: model.accentTextColor, fontSize: s(10), fontWeight: 700, letterSpacing: s(0.8), textTransform: "uppercase" }}>Details</span>
          {visibleCustomFacts.map((fact) => <div key={fact.key} style={{ display: "flex", justifyContent: "space-between", gap: s(8), color: model.primaryForeground, fontSize: s(11), lineHeight: 1.1 }}><span style={{ display: "flex", minWidth: 0 }}>{truncate(fact.label, 16)}</span><span style={{ display: "flex", color: model.primaryForeground, fontWeight: 700, textAlign: "right" }}>{truncate(fact.value, 14)}</span></div>)}
        </div>
      ) : null}
    </div>
  );
}

function SocialCardComposition({
  model,
  width,
  height,
  showSupporting,
}: {
  model: SharedRenderModel;
  width: number;
  height: number;
  showSupporting: boolean;
}) {
  const scale = width / 1200;
  const s = (value: number) => Math.max(1, Math.round(value * scale));
  const panelWidth = 312;
  const photoWidth = width - panelWidth;
  return (
    <div style={{ width, height, display: "flex", overflow: "hidden", background: model.primaryColor, color: model.primaryForeground, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <SocialMedia images={model.images} width={photoWidth} height={height} title={model.title} showSupporting={showSupporting} />
      <div style={{ width: panelWidth, height, display: "flex", flexDirection: "column", padding: `${s(24)}px ${s(20)}px ${s(18)}px`, background: model.primaryColor }}>
        <SocialBrand model={model} scale={scale} />
        <div style={{ display: "flex", flexDirection: "column", marginTop: s(17) }}>
          {model.location ? <span style={{ display: "flex", color: model.primaryForeground === WHITE ? "rgba(255,255,255,.68)" : "rgba(11,16,32,.68)", fontSize: s(11), lineHeight: 1.2, textTransform: "uppercase", letterSpacing: s(0.6) }}>{truncate(model.location, 54)}</span> : null}
          <span style={{ display: "flex", marginTop: model.location ? s(7) : 0, color: model.primaryForeground, fontSize: s(26), lineHeight: 1.04, fontWeight: 700 }}>{truncate(model.title, 48)}</span>
          {model.price ? <span style={{ display: "flex", marginTop: s(10), color: model.accentTextColor, fontSize: s(22), lineHeight: 1, fontWeight: 700 }}>{truncate(model.price, 22)}</span> : null}
        </div>
        <SocialFacts model={model} scale={scale} />
        <SocialSupplementalDetails model={model} scale={scale} />
      </div>
    </div>
  );
}

function modelFromAssets(
  assets: PreparedPropertyMarketingAssets,
  includeHighlightsWithCopy = false,
): SharedRenderModel {
  const { view } = assets;
  const useHighlights = !view.copy && view.highlights.length > 0;
  return {
    title: view.title,
    location: view.location,
    price: view.price,
    facts: view.facts,
    customFacts: view.customFacts,
    copy: view.copy,
    highlights: includeHighlightsWithCopy || useHighlights ? view.highlights : [],
    qrLabel: view.qrLabel,
    qrFeatures: view.qrFeatures,
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
    primaryColor: NAVY,
    accentColor: GOLD,
    accentTextColor: GOLD,
    primaryForeground: WHITE,
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
      <PortraitBrochureComposition model={modelFromAssets(assets, true)} width={dimensions.width} height={dimensions.height} layout={layout} />,
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
    customFacts: input.preview.customFacts,
    copy: "",
    highlights: input.preview.highlights,
    qrLabel: "",
    qrFeatures: [],
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
    primaryColor: input.preview.primaryColor,
    accentColor: input.preview.accentColor,
    accentTextColor: input.preview.accentTextColor,
    primaryForeground: input.preview.primaryForeground,
    brandingAttribution: input.preview.brandingAttribution,
  };
  return new ImageResponse(
    <SocialCardComposition
      model={model}
      width={1200}
      height={630}
      showSupporting={input.preview.layout !== "minimal"}
    />,
    { width: 1200, height: 630 },
  );
}
