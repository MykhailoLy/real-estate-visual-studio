import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/layout/Container";
import SectionHeader from "@/components/sections/SectionHeader";
import CtaSection from "@/components/sections/CtaSection";
import { RegionalPriceText } from "@/components/pricing/currency-client";
import { regionalPrice, type RegionalPrice } from "@/lib/currency";
import { Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Clear per-image pricing for virtual staging, photo editing & floor plans. No subscriptions, no hidden fees. See exactly what you pay.",
};

/* ============================================================
   PRICING DATA — pulled from src/data/order-options.ts values
   USD/CAD/EUR values are fixed regional display prices. Checkout
   pricing remains owned by the order flow and is intentionally
   not imported or changed here.
   ============================================================ */

const stagingAddons = [
  { label: "Image Enhancement", price: regionalPrice("$2.00", "€2.00") },
  { label: "Day to Dusk", price: regionalPrice("$5.00", "€5.00") },
  { label: "Item Removal & Virtual Cleaning", price: regionalPrice("$8.00", "€8.00") },
  { label: "Turn On Lights", price: regionalPrice("$1.00", "€1.00") },
  { label: "Colour Change", price: regionalPrice("$3.00", "€3.00") },
];

const renovationInternal = [
  { label: "Replace Flooring", price: regionalPrice("$20.00", "€20.00") },
  { label: "Replace Walls", price: regionalPrice("$14.00", "€14.00") },
  { label: "Replace Ceiling", price: regionalPrice("$14.00", "€14.00") },
  { label: "Item Removal & Virtual Cleaning", price: regionalPrice("$8.00", "€8.00") },
  { label: "Add / Remove Walls", price: regionalPrice("$35.00", "€35.00") },
  { label: "Add or Complete Kitchen Fit Out", price: regionalPrice("$55.00", "€55.00") },
  { label: "Add or Complete Bathroom Fit Out", price: regionalPrice("$55.00", "€55.00") },
  { label: "Add Fixtures", price: regionalPrice("$20.00", "€20.00") },
  { label: "Virtual Staging (Residential)", price: regionalPrice("$19.00", "€19.00") },
  { label: "Virtual Staging (Commercial - Office)", price: regionalPrice("$19.00", "€19.00") },
  { label: "Virtual Staging (Commercial - Non-office)", price: regionalPrice("$19.00", "€19.00") },
  { label: "Color Change Walls/Ceiling/Doors", price: regionalPrice("$3.00", "€3.00") },
];

const renovationExternal = [
  { label: "Add Pool Only", price: regionalPrice("$35.00", "€35.00") },
  { label: "Add Pool Surrounds", price: regionalPrice("$28.00", "€28.00") },
  { label: "Remove Pool Cover", price: regionalPrice("$35.00", "€35.00") },
  { label: "Add Leaves", price: regionalPrice("$20.00", "€20.00") },
  { label: "Add Basic Landscaping", price: regionalPrice("$20.00", "€20.00") },
  { label: "Add Full Landscaping", price: regionalPrice("$55.00", "€55.00") },
  { label: "Season Change with Full Landscaping", price: regionalPrice("$55.00", "€55.00") },
  { label: "Virtual Staging (Residential or Commercial)", price: regionalPrice("$19.00", "€19.00") },
  { label: "Item Removal & Virtual Cleaning", price: regionalPrice("$8.00", "€8.00") },
  { label: "Add Fixtures", price: regionalPrice("$20.00", "€20.00") },
  { label: "Replace Driveway", price: regionalPrice("$20.00", "€20.00") },
  { label: "Replace Roof", price: regionalPrice("$20.00", "€20.00") },
  { label: "Replace Exterior Walls", price: regionalPrice("$40.00", "€40.00") },
  { label: "Add/Complete Patio, Balcony, Pergola, Veranda, Decking", price: regionalPrice("$40.00", "€40.00") },
  { label: "Color Change Exterior Features", price: regionalPrice("$3.00", "€3.00") },
];

const floorPlanTypes = [
  { label: "2D Floor Plan — Black & White", price: regionalPrice("$16.00", "€16.00"), unit: "per floor" },
  { label: "2D Floor Plan — Full Colour", price: regionalPrice("$22.00", "€22.00"), unit: "per floor" },
  { label: "3D Floor Plan", price: regionalPrice("$39.00", "€39.00"), unit: "per floor" },
  { label: "2D + 3D Bundle", price: regionalPrice("$49.00", "€49.00"), unit: "per floor" },
];

const photoEditOptions = [
  { label: "Image Enhancement — Real Estate", price: regionalPrice("$2.00", "€2.00") },
  { label: "Item Removal & Virtual Cleaning", price: regionalPrice("$8.00", "€8.00") },
  { label: "Shadow Removal", price: regionalPrice("$8.00", "€8.00") },
  { label: "Background Removal", price: regionalPrice("$3.00", "€3.00") },
  { label: "Background Change", price: regionalPrice("$5.00", "€5.00") },
  { label: "Colour Change", price: regionalPrice("$3.00", "€3.00") },
  { label: "Turn On Lights", price: regionalPrice("$1.00", "€1.00") },
  { label: "Day to Dusk", price: regionalPrice("$5.00", "€5.00") },
  { label: "Water Effect for Empty Pools & Jacuzzi", price: regionalPrice("$5.00", "€5.00") },
];

const inclusions = [
  "1 revision included with every order",
  "High-resolution file delivery (JPG, PDF)",
  "Commercial usage rights",
  "24-48 hour standard turnaround",
  "No subscription or monthly fees",
  "Volume discounts for bulk orders",
];

function PriceText({ price }: { price: RegionalPrice | string }) {
  return typeof price === "string" ? price : <RegionalPriceText price={price} />;
}

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
                  <RegionalPriceText price={regionalPrice("$19.00", "€19.00")} />
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
                          +<PriceText price={addon.price} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Link
              href="/order/virtual-staging"
              className="inline-flex px-6 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
            >
              Order Virtual Staging →
            </Link>
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
                          <PriceText price={opt.price} />
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
                          <PriceText price={opt.price} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Link
              href="/order/virtual-renovation"
              className="inline-flex px-6 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
            >
              Order Virtual Renovation →
            </Link>
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
                            <PriceText price={plan.price} />
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

            <Link
              href="/order/3d-floor-plans"
              className="inline-flex px-6 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
            >
              Order Floor Plans →
            </Link>
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
                          <PriceText price={opt.price} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Link
              href="/order/photo-editing"
              className="inline-flex px-6 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
            >
              Order Photo Editing →
            </Link>
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

            <Link
              href="/contact"
              className="inline-flex px-6 py-3 border border-primary text-primary text-sm font-semibold rounded-lg hover:bg-primary hover:text-white transition-colors"
            >
              Request a Quote →
            </Link>
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
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm text-foreground">5-9 images</span>
                    <span className="text-sm font-bold text-primary">
                      10% off
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm text-foreground">
                      10-19 images
                    </span>
                    <span className="text-sm font-bold text-primary">
                      15% off
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm text-foreground">20+ images</span>
                    <span className="text-sm font-bold text-primary">
                      20% off
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-foreground">
                      Agency / bulk
                    </span>
                    <span className="text-sm font-bold text-primary">
                      Custom quote
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted mt-4">
                  Contact us for agency-level pricing on recurring orders.
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
        secondaryLabel="View Services"
        secondaryHref="/services"
      />
    </>
  );
}
