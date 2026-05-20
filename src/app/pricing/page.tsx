import type { Metadata } from "next";
import Container from "@/components/layout/Container";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Clear per-image pricing for virtual staging, editing & floor plans. Local photography packages for Alicante & Costa Blanca. No hidden fees.",
};

export default function PricingPage() {
  return (
    <section className="py-16">
      <Container>
        <h1 className="text-3xl lg:text-5xl font-bold text-primary mb-4">
          Transparent Pricing
        </h1>
        <p className="text-lg text-muted mb-12">
          Simple per-image pricing. No hidden fees.
        </p>
        <p className="text-muted">
          Pricing tables for Remote + Local services coming soon.
        </p>
      </Container>
    </section>
  );
}
