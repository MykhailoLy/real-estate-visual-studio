import type { Metadata } from "next";
import Container from "@/components/layout/Container";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Meet the team. Real estate visual marketing specialists based in Alicante, serving agents worldwide with digital services and locally with on-site shoots.",
};

export default function AboutPage() {
  return (
    <section className="py-16">
      <Container>
        <h1 className="text-3xl lg:text-5xl font-bold text-primary mb-4">
          About Us
        </h1>
        <p className="text-lg text-muted mb-12">
          Real estate visual marketing specialists based in Alicante.
        </p>
        <p className="text-muted">
          About page content (story, team, credentials) coming soon.
        </p>
      </Container>
    </section>
  );
}
