import type { Metadata } from "next";
import Container from "@/components/layout/Container";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about ordering, turnaround times, pricing, revisions, file formats, and our coverage area in Costa Blanca.",
};

export default function FaqPage() {
  return (
    <section className="py-16">
      <Container>
        <h1 className="text-3xl lg:text-5xl font-bold text-primary mb-4">
          Frequently Asked Questions
        </h1>
        <p className="text-lg text-muted mb-12">
          Everything you need to know before ordering.
        </p>
        <p className="text-muted">FAQ accordion coming soon.</p>
      </Container>
    </section>
  );
}
