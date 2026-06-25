import type { Metadata } from "next";
import TrackedLink from "@/components/analytics/TrackedLink";
import Container from "@/components/layout/Container";
import SectionHeader from "@/components/sections/SectionHeader";
import CtaSection from "@/components/sections/CtaSection";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import { localizedAlternates } from "@/lib/seo";
import { Check } from "lucide-react";
import {
  FLOOR_PLAN_TYPES,
  PHOTO_EDIT_OPTIONS,
  RENOVATION_EXTERNAL_OPTIONS,
  RENOVATION_INTERNAL_OPTIONS,
  STAGING_ADDONS,
} from "@/data/order-options";
import {
  PUBLIC_TAX_NOTICE,
  PUBLIC_VOLUME_DISCOUNTS,
} from "@/lib/pricing/public";
import type { PriceKey } from "@/lib/pricing/types";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Clear per-image pricing for virtual staging, photo editing & floor plans. No subscriptions, no hidden fees. See exactly what you pay.",
  alternates: localizedAlternates({
    canonicalPath: "/pricing",
    englishPath: "/pricing",
    spanishPath: "/es/pricing",
  }),
};

type PublicPricingRow = {
  label: string;
  priceKey: PriceKey;
  unit?: string;
};

const stagingAddons: PublicPricingRow[] = STAGING_ADDONS;
const renovationInternal: PublicPricingRow[] = RENOVATION_INTERNAL_OPTIONS;
const renovationExternal: PublicPricingRow[] = RENOVATION_EXTERNAL_OPTIONS;
const floorPlanTypes: PublicPricingRow[] = FLOOR_PLAN_TYPES.map((plan) => ({
  label: plan.label,
  priceKey: plan.priceKey,
  unit: "per floor",
}));
const photoEditOptions: PublicPricingRow[] = PHOTO_EDIT_OPTIONS;

const inclusions = [
  "1 revision included with every order",
  "High-resolution file delivery (JPG, PDF)",
  "Commercial usage rights",
  "24-48 hour standard turnaround",
  "No subscription or monthly fees",
  "Volume discounts for bulk orders",
];

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-primary py-16 lg:py-24">
        <Container>
          <div className="max-w-3xl">
            <h1 className="text-3xl lg:text-5xl font-bold text-white mb-4">
              Transparent Pricing, No Hidden Fees
            </h1>
            <p className="text-lg text-white/75 leading-relaxed">
              Pay per image or per option. No subscriptions. See exactly what
              each service costs before you order.
            </p>
          </div>
        </Container>
      </section>

      {/* Virtual Staging */}
      <section className="py-16 lg:py-24" id="virtual-staging">
        <Container>
          <div className="max-w-4xl">
            <SectionHeader
              title="Virtual Staging"
              subtitle="Base price per image + optional add-ons."
              align="left"
            />

            <div className="bg-white border border-border rounded-2xl p-6 lg:p-8 mb-6">
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-3xl font-bold text-primary">
                  <CatalogPriceText priceKey="virtual-staging" />
                </span>
                <span className="text-muted text-sm">per image</span>
              </div>

              <h4 className="text-sm font-semibold text-foreground mb-3">
                Optional Add-ons
              </h4>
              <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {stagingAddons.map((addon, i) => (
                      <tr
                        key={addon.label}
                        className={i % 2 === 0 ? "bg-white" : "bg-surface"}
                      >
                        <td className="px-4 py-3 text-foreground">
                          {addon.label}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-primary">
                          <CatalogPriceText
                            priceKey={addon.priceKey}
                            prefix="+"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <TrackedLink
              href="/order/virtual-staging"
              analyticsLabel="Order Virtual Staging"
              analyticsLocation="pricing_card"
              analyticsEvent="pricing_cta"
              className="inline-flex px-6 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
            >
              Order Virtual Staging →
            </TrackedLink>
          </div>
        </Container>
      </section>

      {/* Virtual Renovation */}
      <section className="py-16 lg:py-24 bg-surface" id="virtual-renovation">
        <Container>
          <div className="max-w-4xl">
            <SectionHeader
              title="Virtual Renovation"
              subtitle="Option-based pricing. Select only the renovations you need for each image."
              align="left"
            />

            {/* Internal */}
            <div className="bg-white border border-border rounded-2xl p-6 lg:p-8 mb-6">
              <h4 className="text-sm font-semibold text-foreground mb-3">
                Internal Renovations
              </h4>
              <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {renovationInternal.map((opt, i) => (
                      <tr
                        key={opt.label}
                        className={i % 2 === 0 ? "bg-white" : "bg-surface"}
                      >
                        <td className="px-4 py-3 text-foreground">
                          {opt.label}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-primary whitespace-nowrap">
                          <CatalogPriceText priceKey={opt.priceKey} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* External */}
            <div className="bg-white border border-border rounded-2xl p-6 lg:p-8 mb-6">
              <h4 className="text-sm font-semibold text-foreground mb-3">
                External Renovations
              </h4>
              <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {renovationExternal.map((opt, i) => (
                      <tr
                        key={opt.label}
                        className={i % 2 === 0 ? "bg-white" : "bg-surface"}
                      >
                        <td className="px-4 py-3 text-foreground">
                          {opt.label}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-primary whitespace-nowrap">
                          <CatalogPriceText priceKey={opt.priceKey} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <TrackedLink
              href="/order/virtual-renovation"
              analyticsLabel="Order Virtual Renovation"
              analyticsLocation="pricing_card"
              analyticsEvent="pricing_cta"
              className="inline-flex px-6 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
            >
              Order Virtual Renovation →
            </TrackedLink>
          </div>
        </Container>
      </section>

      {/* Floor Plans */}
      <section className="py-16 lg:py-24" id="floor-plans">
        <Container>
          <div className="max-w-4xl">
            <SectionHeader
              title="2D / 3D Floor Plans"
              subtitle="Price per floor, based on plan type selected."
              align="left"
            />

            <div className="bg-white border border-border rounded-2xl p-6 lg:p-8 mb-6">
              <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                        Plan Type
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted">
                        Price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {floorPlanTypes.map((plan, i) => (
                      <tr
                        key={plan.label}
                        className={i % 2 === 0 ? "bg-white" : "bg-surface"}
                      >
                        <td className="px-4 py-3 text-foreground font-medium">
                          {plan.label}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-primary">
                            <CatalogPriceText priceKey={plan.priceKey} />
                          </span>
                          <span className="text-xs text-muted ml-1">
                            {plan.unit}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted mt-4">
                Includes custom flooring/finish preferences, address display
                options, and disclaimer settings. See order form for full
                configuration.
              </p>
            </div>

            <TrackedLink
              href="/order/3d-floor-plans"
              analyticsLabel="Order Floor Plans"
              analyticsLocation="pricing_card"
              analyticsEvent="pricing_cta"
              className="inline-flex px-6 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
            >
              Order Floor Plans →
            </TrackedLink>
          </div>
        </Container>
      </section>

      {/* Photo Editing */}
      <section className="py-16 lg:py-24 bg-surface" id="photo-editing">
        <Container>
          <div className="max-w-4xl">
            <SectionHeader
              title="Real Estate Photo Editing"
              subtitle="Select the editing options you need for each photo. Combine multiple options for best results."
              align="left"
            />

            <div className="bg-white border border-border rounded-2xl p-6 lg:p-8 mb-6">
              <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {photoEditOptions.map((opt, i) => (
                      <tr
                        key={opt.label}
                        className={i % 2 === 0 ? "bg-white" : "bg-surface"}
                      >
                        <td className="px-4 py-3 text-foreground">
                          {opt.label}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-primary whitespace-nowrap">
                          <CatalogPriceText priceKey={opt.priceKey} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <TrackedLink
              href="/order/photo-editing"
              analyticsLabel="Order Photo Editing"
              analyticsLocation="pricing_card"
              analyticsEvent="pricing_cta"
              className="inline-flex px-6 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
            >
              Order Photo Editing →
            </TrackedLink>
          </div>
        </Container>
      </section>

      {/* Local Services Pricing */}
      <section className="py-16 lg:py-24" id="local-services">
        <Container>
          <div className="max-w-4xl">
            <SectionHeader
              title="Local Services — Alicante & Costa Blanca"
              subtitle="On-location pricing depends on property size and requirements. Contact us for a custom quote."
              align="left"
            />

            <div className="bg-white border border-border rounded-2xl p-6 lg:p-8 mb-6">
              <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                        Service
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted">
                        Starting From
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <td className="px-4 py-3 text-foreground">
                        Real Estate Photography
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-primary">
                        From €129 / 15 photos
                      </td>
                    </tr>
                    <tr className="bg-surface">
                      <td className="px-4 py-3 text-foreground">
                        360 Virtual Tours
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-primary">
                        From €120 / small apt
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="px-4 py-3 text-foreground">
                        Property Video Tours
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-primary">
                        From €250 / short walkthrough
                      </td>
                    </tr>
                    <tr className="bg-surface">
                      <td className="px-4 py-3 text-foreground">
                        Drone / Aerial Photography
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-primary">
                        Quote on request
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted mt-4">
                Photography: €129 (15 photos), €179 (25 photos), €239 (35
                photos). Custom quote for 50+ photos, villas, luxury properties,
                or urgent delivery. 360 tours and video depend on property size.
                Drone via licensed specialist — price depends on location and
                flight permissions. Travel fee may apply 30km+ from Alicante.
              </p>
            </div>

            <TrackedLink
              href="/contact"
              analyticsLabel="Request a Quote"
              analyticsLocation="pricing_card"
              className="inline-flex px-6 py-3 border border-primary text-primary text-sm font-semibold rounded-lg hover:bg-primary hover:text-white transition-colors"
            >
              Request a Quote →
            </TrackedLink>
          </div>
        </Container>
      </section>

      {/* What's Included + Volume Discounts */}
      <section className="py-16 lg:py-24 bg-surface">
        <Container>
          <div className="max-w-4xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Inclusions */}
              <div className="bg-white border border-border rounded-2xl p-6 lg:p-8">
                <h3 className="text-lg font-bold text-foreground mb-4">
                  What&apos;s Included
                </h3>
                <ul className="space-y-3">
                  {inclusions.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm text-foreground"
                    >
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Volume Discounts */}
              <div className="bg-white border border-border rounded-2xl p-6 lg:p-8">
                <h3 className="text-lg font-bold text-foreground mb-4">
                  Volume Discounts
                </h3>
                <p className="text-sm text-muted mb-4">
                  Ordering in bulk? Save more with volume pricing.
                </p>
                <div className="space-y-3">
                  {PUBLIC_VOLUME_DISCOUNTS.map((tier, index) => (
                    <div
                      key={tier.range}
                      className={`flex justify-between items-center py-2 ${
                        index < PUBLIC_VOLUME_DISCOUNTS.length - 1
                          ? "border-b border-border"
                          : ""
                      }`}
                    >
                      <span className="text-sm text-foreground">
                        {tier.range}
                      </span>
                      <span className="text-sm font-bold text-primary">
                        {tier.discount}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted mt-4">
                  Discounts apply automatically to the base service subtotal.
                  Add-ons are not volume-discounted. {PUBLIC_TAX_NOTICE}
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* CTA */}
      <CtaSection
        title="Ready to Order?"
        subtitle="Choose your service and get started in minutes. No upfront payment required."
        primaryLabel="Order Online"
        primaryHref="/order"
        primaryAnalyticsEvent="pricing_cta"
        secondaryLabel="View Services"
        secondaryHref="/services"
      />
    </>
  );
}
