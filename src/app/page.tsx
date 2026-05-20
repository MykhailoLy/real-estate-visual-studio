import Container from "@/components/layout/Container";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="bg-primary text-white py-20 lg:py-32">
        <Container>
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6">
              Real Estate Visual Marketing That Sells Faster
            </h1>
            <p className="text-lg lg:text-xl text-white/80 mb-8">
              Virtual staging &amp; photo editing worldwide. Professional
              photography &amp; video in Alicante &amp; Costa Blanca.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/order"
                className="bg-secondary text-primary-dark px-6 py-3 rounded-md font-semibold hover:bg-secondary-light transition-colors"
              >
                Order Online
              </Link>
              <Link
                href="/portfolio"
                className="border border-white/50 text-white px-6 py-3 rounded-md font-semibold hover:bg-white/10 transition-colors"
              >
                View Portfolio
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Placeholder sections — to be implemented */}
      <section className="py-16">
        <Container>
          <p className="text-center text-muted">
            Homepage sections coming soon: Services, Before/After, How It Works,
            Portfolio Preview, Testimonials, CTA.
          </p>
        </Container>
      </section>
    </>
  );
}
