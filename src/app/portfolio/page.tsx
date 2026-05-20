import type { Metadata } from "next";
import Container from "@/components/layout/Container";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Browse our work: virtual staging, photography, drone video, renovations & 3D floor plans. See the quality before you order.",
};

export default function PortfolioPage() {
  return (
    <section className="py-16">
      <Container>
        <h1 className="text-3xl lg:text-5xl font-bold text-primary mb-4">
          Our Work
        </h1>
        <p className="text-lg text-muted mb-12">
          Real results for real estate professionals.
        </p>
        <p className="text-muted">
          Portfolio grid with category filters coming soon.
        </p>
      </Container>
    </section>
  );
}
