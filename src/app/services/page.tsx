import type { Metadata } from "next";
import Container from "@/components/layout/Container";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Virtual staging, photo editing, 3D floor plans, professional photography, drone video & 360 tours for real estate agents and developers.",
};

export default function ServicesPage() {
  return (
    <section className="py-16">
      <Container>
        <h1 className="text-3xl lg:text-5xl font-bold text-primary mb-4">
          Complete Visual Marketing for Real Estate
        </h1>
        <p className="text-lg text-muted mb-12">
          Digital services for agents worldwide. On-location shoots in Alicante
          &amp; Costa Blanca.
        </p>
        <p className="text-muted">
          Service blocks coming soon: Virtual Staging, Virtual Renovation, 3D
          Floor Plans, Photo Editing, Decluttering, Photography, 360 Tours,
          Video Tours, Drone Photography.
        </p>
      </Container>
    </section>
  );
}
