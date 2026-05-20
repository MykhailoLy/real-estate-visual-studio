import type { Metadata } from "next";
import Container from "@/components/layout/Container";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Order policies, revision policy, liability, and service terms for our visual marketing services.",
};

export default function TermsPage() {
  return (
    <section className="py-16">
      <Container>
        <h1 className="text-3xl font-bold text-primary mb-8">
          Terms &amp; Conditions
        </h1>
        <p className="text-muted">Terms and conditions content coming soon.</p>
      </Container>
    </section>
  );
}
