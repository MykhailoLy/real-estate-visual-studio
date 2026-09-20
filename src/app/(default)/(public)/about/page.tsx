import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import Container from "@/components/layout/Container";
import JsonLd from "@/components/seo/JsonLd";
import { localizedAlternates } from "@/lib/seo";
import { aboutPageSchema } from "@/lib/structured-data";

const ABOUT_TITLE = "About PicchuSpot | Real Estate Visual Services";
const ABOUT_DESCRIPTION =
  "Meet the founder of PicchuSpot and learn how architectural experience shapes our virtual staging, photo editing, floor plan, and real estate visual services.";

export const metadata: Metadata = {
  title: { absolute: ABOUT_TITLE },
  description: ABOUT_DESCRIPTION,
  alternates: localizedAlternates({
    canonicalPath: "/about",
    englishPath: "/about",
    spanishPath: "/es/about",
  }),
};

const principles = [
  {
    title: "Architectural perspective",
    description:
      "We look at scale, layout, materials, lighting, perspective, and visual balance with an architectural understanding of how spaces actually work.",
  },
  {
    title: "Real-estate focused",
    description:
      "PicchuSpot is built around property marketing, not generic image editing. Every visual needs to make sense in the context of a listing, presentation, or property campaign.",
  },
  {
    title: "Realism over decoration",
    description:
      "A polished image is not enough. When a visual represents a real property, proportion, perspective, architecture, lighting, and consistency all matter.",
  },
  {
    title: "Built for long-term collaboration",
    description:
      "PicchuSpot is designed to support agents, photographers, developers, and property businesses across more than one listing. Clear briefs, consistent visual standards, and a reliable workflow matter just as much as the individual image.",
  },
];

const audiences = [
  {
    title: "Real Estate Agents",
    description:
      "Listing visuals that help present properties clearly and consistently.",
  },
  {
    title: "Real Estate Photographers",
    description:
      "Reliable post-production and visual services that can extend your client offering.",
  },
  {
    title: "Developers & Property Marketers",
    description:
      "Visuals for existing properties, renovations, developments, and marketing materials.",
  },
  {
    title: "Property Managers & Home Sellers",
    description:
      "Practical visual support when a property needs to be prepared for market.",
  },
];

const founderPath = [
  "Architecture",
  "Architectural visualization",
  "Real-estate visual production",
  "PicchuSpot",
];

const eyebrowClass =
  "text-public-kicker font-bold uppercase text-secondary-dark";
const primaryActionClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-light focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
const secondaryActionClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-bold text-primary transition-colors hover:border-primary/40 hover:bg-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

function AboutActions({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link
        href="/pricing"
        className={
          inverse
            ? "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-secondary px-6 py-3 text-sm font-bold text-primary-dark transition-colors hover:bg-secondary-light focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            : primaryActionClass
        }
      >
        Explore Services
        <ArrowRight className="size-4" aria-hidden />
      </Link>
      <ClientPortalLink
        href="/dashboard/orders/new"
        className={
          inverse
            ? "inline-flex min-h-12 items-center justify-center rounded-lg border border-white/40 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            : secondaryActionClass
        }
      >
        Start an Order
      </ClientPortalLink>
    </div>
  );
}

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={aboutPageSchema({
          name: ABOUT_TITLE,
          description: ABOUT_DESCRIPTION,
          url: "/about",
          inLanguage: "en-US",
        })}
      />

      <section className="border-b border-border bg-[#F4EFE8] py-16 sm:py-20 lg:py-28">
        <Container>
          <div className="max-w-5xl">
            <p className={eyebrowClass}>About PicchuSpot</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.04] tracking-tight text-primary sm:text-5xl lg:text-7xl">
              Built from architecture. Focused on real estate.
            </h1>
            <div className="mt-8 max-w-3xl space-y-5 text-base leading-relaxed text-muted sm:text-lg">
              <p>
                PicchuSpot was created to bring architectural thinking and
                high-quality visual production into everyday real estate
                marketing.
              </p>
              <p>
                Our work sits at the intersection of architecture,
                visualization, photography, and property presentation — helping
                real estate agents, photographers, developers, and property
                marketers show spaces clearly, realistically, and with purpose.
              </p>
              <p>
                From{" "}
                <Link
                  href="/pricing/virtual-staging"
                  className="font-semibold text-primary underline decoration-secondary underline-offset-4 hover:text-primary-light"
                >
                  virtual staging
                </Link>{" "}
                and renovation to photo editing,{" "}
                <Link
                  href="/pricing/floor-plans"
                  className="font-semibold text-primary underline decoration-secondary underline-offset-4 hover:text-primary-light"
                >
                  floor plans
                </Link>
                , and presentation-ready listing visuals, every service is built
                around one principle: the image should help people understand
                the property, not distract from it.
              </p>
            </div>
            <div className="mt-9">
              <AboutActions />
            </div>
          </div>
        </Container>
      </section>

      <section
        aria-labelledby="founder-heading"
        className="bg-white py-16 sm:py-20 lg:py-28"
      >
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)] lg:gap-20 xl:gap-28">
            <div>
              <p className={eyebrowClass}>Meet the Founder</p>
              <h2
                id="founder-heading"
                className="mt-4 max-w-lg text-3xl font-bold leading-tight tracking-tight text-primary sm:text-4xl lg:text-5xl"
              >
                A visual business built on architectural experience
              </h2>

              <div
                data-founder-photo-slot
                aria-hidden="true"
                className="mt-8 flex aspect-[4/5] w-full max-w-[360px] items-center justify-center overflow-hidden border border-border bg-[#F4EFE8]"
              >
                <span className="select-none text-6xl font-bold tracking-tight text-primary/10 sm:text-7xl">
                  ML
                </span>
              </div>

              <ol
                className="mt-8 border-l border-border pl-6"
                aria-label="PicchuSpot professional path"
              >
                {founderPath.map((step, index) => (
                  <li
                    key={step}
                    className="relative pb-5 text-sm font-semibold text-primary last:pb-0"
                  >
                    <span
                      className="absolute -left-[1.72rem] top-1 size-2 rounded-full bg-secondary"
                      aria-hidden
                    />
                    <span className="mr-3 text-xs text-secondary-dark">
                      0{index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="max-w-3xl space-y-5 text-base leading-relaxed text-muted sm:text-lg lg:pt-9">
              <p>
                Mykhailo Lykin founded PicchuSpot after working across
                architecture, architectural visualization, and real estate visual
                production.
              </p>
              <p>
                Before starting PicchuSpot, he worked in architectural practice
                and later moved into visual production for real estate. His work
                has included virtual staging, virtual renovation, floor plans,
                image editing, and property presentation.
              </p>
              <p>
                That architectural background still shapes how PicchuSpot
                approaches each project. Scale, perspective, layout, materials,
                and lighting are considered alongside a more practical question:
                how will the space actually read in a property listing?
              </p>
              <p>
                PicchuSpot combines efficient digital workflows with close
                attention to the individual property, the client brief, and the
                final presentation. The goal is not simply to make an image look
                polished, but to make the space easier to understand.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section
        aria-label="Founder quote"
        className="bg-primary py-16 sm:py-20 lg:py-24"
      >
        <Container>
          <blockquote className="max-w-5xl border-l-2 border-secondary pl-6 sm:pl-10 lg:pl-14">
            <p className="text-2xl font-medium leading-snug tracking-tight text-white sm:text-3xl lg:text-4xl">
              “A property image should do more than look polished. It should
              help someone understand the space — its scale, function, and
              potential.”
            </p>
            <div className="mt-8">
              <p className="font-bold text-white">Mykhailo Lykin</p>
              <p className="mt-1 text-sm text-white/65">Founder, PicchuSpot</p>
            </div>
          </blockquote>
        </Container>
      </section>

      <section
        aria-labelledby="principles-heading"
        className="bg-[#F4EFE8] py-16 sm:py-20 lg:py-28"
      >
        <Container>
          <div className="max-w-3xl">
            <p className={eyebrowClass}>How We Think About Real Estate Visuals</p>
            <h2
              id="principles-heading"
              className="mt-4 text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-5xl"
            >
              Clear thinking behind every image
            </h2>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border md:grid-cols-2 lg:mt-14">
            {principles.map((principle, index) => (
              <article key={principle.title} className="bg-white p-6 sm:p-8 lg:p-10">
                <p className="text-xs font-bold text-secondary-dark">
                  0{index + 1}
                </p>
                <h3 className="mt-5 text-xl font-bold text-primary sm:text-2xl">
                  {principle.title}
                </h3>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
                  {principle.description}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section
        aria-labelledby="audiences-heading"
        className="bg-white py-16 sm:py-20 lg:py-28"
      >
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20 xl:gap-28">
            <div>
              <p className={eyebrowClass}>Who We Work With</p>
              <h2
                id="audiences-heading"
                className="mt-4 text-3xl font-bold tracking-tight text-primary sm:text-4xl lg:text-5xl"
              >
                Visual support for property professionals
              </h2>
            </div>

            <div className="grid border-t border-border sm:grid-cols-2">
              {audiences.map((audience) => (
                <article
                  key={audience.title}
                  className="border-b border-border py-6 sm:px-6 sm:first:pl-0 sm:[&:nth-child(2n+1)]:pl-0 sm:[&:nth-child(2n)]:border-l lg:py-8"
                >
                  <h3 className="text-lg font-bold text-primary">
                    {audience.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                    {audience.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="border-t border-white/10 bg-primary py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16">
            <div className="max-w-3xl">
              <p className="text-public-kicker font-bold uppercase text-secondary">
                Work With PicchuSpot
              </p>
              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                A visual partner for your next listing — and the ones after that.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-white/70 sm:text-lg">
                Explore our services, send a project brief, or start with a single
                property.
              </p>
            </div>
            <AboutActions inverse />
          </div>
        </Container>
      </section>
    </>
  );
}
