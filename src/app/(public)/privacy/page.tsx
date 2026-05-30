import type { Metadata } from "next";
import Container from "@/components/layout/Container";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How we collect, use, and protect your personal data. GDPR compliant.",
};

export default function PrivacyPage() {
  return (
    <section className="py-16">
      <Container>
        <h1 className="text-3xl font-bold text-primary mb-8">Privacy Policy</h1>
        <p className="text-muted">Privacy policy content coming soon.</p>
      </Container>
    </section>
  );
}
