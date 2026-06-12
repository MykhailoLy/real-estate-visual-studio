import type { Metadata } from "next";
import { Map, Building, LayoutGrid, FileText } from "lucide-react";
import ServicePage from "@/components/pricing/ServicePage";
import { localizedAlternates } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Development Site Plans",
  description:
    "Clear visual site plans for land, development, subdivision, multi-unit, or project presentation. Quote-based.",
  alternates: localizedAlternates({
    canonicalPath: "/pricing/development-site-plans",
    englishPath: "/pricing/development-site-plans",
    spanishPath: "/es/pricing/development-site-plans",
  }),
};

export default function DevelopmentSitePlansPricingPage() {
  return (
    <ServicePage
      serviceSlug="development-site-plans"
      placeholderVariant="site-plans"
      eyebrow="Development Site Plans"
      title="Development Site Plans Pricing"
      description="Create clear visual site plans for land, development, subdivision, multi-unit, or project presentation."
      priceLine="Request a quote"
      orderHref="/order/photo-editing"
      orderLabel="Order Site Plan"
      whenToUseTitle="When to use Development Site Plans"
      whenToUseDescription="Site plan visuals help buyers, investors, and planning audiences understand the layout, scale, and scope of a development or land project at a glance."
      useCases={[
        {
          icon: Map,
          title: "Land listings",
          description: "Present plot boundaries, access, and surrounding context clearly for land buyers.",
        },
        {
          icon: Building,
          title: "Development projects",
          description: "Show development phases, unit layouts, and amenities for off-plan sales.",
        },
        {
          icon: LayoutGrid,
          title: "Multi-unit sites",
          description: "Present multi-unit layouts with unit numbers, shared spaces, and parking.",
        },
        {
          icon: FileText,
          title: "Project presentations",
          description: "Provide clear supporting visuals for planning applications and investor packs.",
        },
      ]}
      whatItIsTitle="Clear site plan visuals for development and land presentation"
      whatItIsBody="We prepare site plan visuals that help present land, layouts, lots, amenities, access, and development concepts in a cleaner and more understandable way."
      whatItIsBullets={[
        "Top-down site plan from your sketch, PDF, or CAD files",
        "Plot boundaries, building footprints, and unit labels",
        "Amenities and access routes highlighted",
        "North arrow, scale bar, and legend included on request",
        "1 revision included",
        "High-resolution JPG and PDF delivery",
      ]}
      beforeYouOrderDescription="Send your source files and a clear brief — the more detail you provide, the more accurate the final plan will be."
      uploadItems={[
        {
          label: "Site sketch, plan, or CAD file",
          required: true,
          hint: "PDF, DWG, DXF, JPG, or PNG — any format you have",
        },
        {
          label: "Aerial photo if available",
          hint: "Helps us align the plan with the actual site",
        },
        {
          label: "Unit and amenity labels",
          required: true,
          hint: "Names, numbers, and layout references for all areas",
        },
        {
          label: "Measurements or scale",
          hint: "If available — improves accuracy significantly",
        },
        {
          label: "Brand or color guidelines",
          hint: "Optional — for branded presentation output",
        },
        {
          label: "Project notes",
          hint: "Any additional context, phasing, or layout preferences",
        },
      ]}
      uploadFootnote="Required fields are marked *. The more detail you provide, the more accurate the result. We'll quote in writing before starting."
      pricingTitle="Site Plans pricing"
      pricingDescription="Pricing is based on project complexity and detail level. Send your source files and we'll quote in writing within 24 hours."
      pricingCards={[
        {
          label: "Basic Site Plan",
          price: "Request quote",
          unit: "per plan",
          note: "Top-down layout with boundaries, units, and amenity labels.",
          isBase: true,
        },
        {
          label: "Detailed Site Plan",
          price: "Request quote",
          unit: "per plan",
          note: "Full development layout with phasing, scale, and legend.",
        },
        {
          label: "Branded Presentation Plan",
          price: "Request quote",
          unit: "per plan",
          note: "Styled for marketing, brochures, and investor materials.",
        },
      ]}
      pricingFootnote="All pricing is project-based. Contact us with your source files for an accurate quote."
      faqTitle="Development Site Plans questions"
      faqItems={[
        {
          question: "What source files do you need?",
          answer: "Any format you have works — CAD (DWG, DXF), PDF, or even a photo of a hand-drawn sketch. The more detail, the more accurate the output.",
        },
        {
          question: "Do you need exact measurements?",
          answer: "Measurements improve accuracy but are not always required. If you have them, include them. We'll work with what you have.",
        },
        {
          question: "Can you include branding and logos?",
          answer: "Yes. If you have brand colours, a logo, and typography guidelines, we can incorporate them for a branded presentation plan.",
        },
        {
          question: "What if the site is complex or multi-phase?",
          answer: "We handle multi-phase and complex developments. Include your phasing notes in the brief and we'll quote accordingly.",
        },
        {
          question: "How is pricing determined?",
          answer: "Pricing is based on the complexity, level of detail, and number of versions needed. We always quote in writing before starting.",
        },
        {
          question: "What format will I receive?",
          answer: "JPG and PDF are the standard delivery formats. Other formats can be arranged on request.",
        },
        {
          question: "How long does it take?",
          answer: "Turnaround is discussed at quoting stage based on complexity. Simple plans can be ready within 48 hours once source files are confirmed.",
        },
        {
          question: "Is a revision included?",
          answer: "Yes. One revision round is included in the quoted price.",
        },
      ]}
      ctaTitle="A clear site plan does the heavy lifting in development marketing."
      ctaSubtitle="Send your source files — we'll quote in writing within 24 hours."
    />
  );
}
