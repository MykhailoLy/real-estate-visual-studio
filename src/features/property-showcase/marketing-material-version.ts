import { createHash } from "node:crypto";
import {
  brochureSupportingImageLimit,
  createPropertyMarketingMaterialView,
} from "./marketing-materials.ts";
import { stableSerializeSocialImageVersionInput } from "./social-image-version.ts";
import type { PropertyShowcase } from "./types.ts";

export const PROPERTY_MARKETING_VISUAL_SCHEMA_VERSION =
  "picchuspot-property-marketing-v1";

export function createPropertyMarketingMaterialVersionInput(
  property: PropertyShowcase,
  canonicalUrl: string,
) {
  const view = createPropertyMarketingMaterialView(property, canonicalUrl);
  const supportingLimit = brochureSupportingImageLimit(
    view.config.brochure.template,
  );
  return {
    schemaVersion: PROPERTY_MARKETING_VISUAL_SCHEMA_VERSION,
    slug: view.slug,
    canonicalUrl: view.canonicalUrl,
    config: {
      enabled: view.config.enabled,
      brandingMode: view.config.brandingMode,
      includeAgent: view.config.includeAgent,
      includeAgencyLogo: view.config.includeAgencyLogo,
      includeQrCode: view.config.includeQrCode,
      includeDisclaimer: view.config.includeDisclaimer,
      marketingCopyMode: view.config.marketingCopyMode,
      selectedFactKeys: view.config.selectedFactKeys,
      selectedHighlightIds: view.config.selectedHighlightIds,
      brochure: {
        ...view.config.brochure,
        supportingMediaIds:
          view.config.brochure.supportingMediaIds.slice(0, supportingLimit),
      },
    },
    content: {
      title: view.title,
      location: view.location,
      price: view.price,
      facts: view.facts,
      copy: view.copy,
      highlights: view.highlights,
      disclaimer: view.disclaimer,
    },
    images: view.brochureImages.slice(0, supportingLimit + 1),
    agent: view.agent,
  };
}

export function computePropertyMarketingMaterialVersion(
  property: PropertyShowcase,
  canonicalUrl: string,
): string {
  return createHash("sha256")
    .update(
      stableSerializeSocialImageVersionInput(
        createPropertyMarketingMaterialVersionInput(property, canonicalUrl),
      ),
    )
    .digest("hex")
    .slice(0, 14);
}

export function getPropertyMarketingMaterialLinks(
  property: PropertyShowcase,
  canonicalUrl: string,
  options: { adminId?: string } = {},
) {
  const view = createPropertyMarketingMaterialView(property, canonicalUrl);
  if (!options.adminId && !view.config.enabled) return {};
  const version = computePropertyMarketingMaterialVersion(property, canonicalUrl);
  const base = options.adminId
    ? `/admin/properties/${encodeURIComponent(options.adminId)}/materials`
    : `/property/${encodeURIComponent(property.slug)}/materials`;
  const url = (asset: string) => `${base}/${asset}?v=${version}`;
  return {
    orientation: view.config.brochure.orientation,
    preview: `${url("brochure.png")}&preview=1`,
    pdf: url("brochure.pdf"),
    jpg: url("brochure.jpg"),
    png: url("brochure.png"),
  };
}
