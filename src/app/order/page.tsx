import type { Metadata } from "next";
import Container from "@/components/layout/Container";

export const metadata: Metadata = {
  title: "Order Remote Services",
  description:
    "Upload your photos and order virtual staging, renovation, floor plans or editing. Easy online ordering with 24-48h delivery.",
};

export default function OrderPage() {
  return (
    <section className="py-16">
      <Container>
        <h1 className="text-3xl lg:text-5xl font-bold text-primary mb-4">
          Order Remote Services
        </h1>
        <p className="text-lg text-muted mb-12">
          Upload your photos, select preferences, and receive results in 24-48
          hours.
        </p>
        <p className="text-muted">
          Order form with service selector, repeatable item cards, file upload,
          and order summary coming soon.
        </p>
      </Container>
    </section>
  );
}
