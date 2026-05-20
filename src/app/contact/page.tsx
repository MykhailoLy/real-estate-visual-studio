import type { Metadata } from "next";
import Container from "@/components/layout/Container";

export const metadata: Metadata = {
  title: "Contact & Book a Shoot",
  description:
    "Get in touch for local photography bookings in Alicante & Costa Blanca, or ask questions about our remote digital services.",
};

export default function ContactPage() {
  return (
    <section className="py-16">
      <Container>
        <h1 className="text-3xl lg:text-5xl font-bold text-primary mb-4">
          Contact Us
        </h1>
        <p className="text-lg text-muted mb-12">
          Book a local shoot or ask about our remote services.
        </p>
        <p className="text-muted">
          Contact form + direct info (email, phone, WhatsApp) coming soon.
        </p>
      </Container>
    </section>
  );
}
