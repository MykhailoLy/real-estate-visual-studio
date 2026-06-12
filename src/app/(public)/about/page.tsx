import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  Home,
  ImagePlus,
  Lock,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Container from "@/components/layout/Container";
import { localizedAlternates } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About PicchuSpot",
  description:
    "PicchuSpot provides real estate visual services for agents, photographers, property managers, home sellers, and developers.",
  alternates: localizedAlternates({
    canonicalPath: "/about",
    englishPath: "/about",
    spanishPath: "/es/about",
  }),
};

const audiences = [
  "Real estate agents",
  "Photographers",
  "Property managers",
  "Home sellers",
  "Developers",
];

const strengths = [
  {
    icon: ImagePlus,
    title: "Realistic visuals",
    description:
      "Images, plans, and edits are prepared to help listings look polished while staying useful for real property marketing.",
  },
  {
    icon: FileCheck2,
    title: "Clear order workflow",
    description:
      "Clients can submit files, instructions, service options, and delivery preferences through a structured order path.",
  },
  {
    icon: RefreshCw,
    title: "Revision support",
    description:
      "Revision requests are handled through the client workflow so feedback stays connected to the right order and file.",
  },
  {
    icon: Lock,
    title: "Private file delivery",
    description:
      "Client source uploads and delivered files are handled through private dashboard flows designed for project work.",
  },
];

export default function AboutPage() {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-10 lg:gap-16 items-center">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
              About PicchuSpot
            </p>
            <h1 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-5">
              Real estate visuals built for clearer listings
            </h1>
            <p className="text-base lg:text-lg text-muted leading-relaxed max-w-3xl">
              PicchuSpot focuses on practical visual services for real estate:
              virtual staging, virtual renovation, floor plans, retouching,
              image enhancement, and selected local or custom media work.
            </p>
            <p className="mt-5 text-base lg:text-lg text-muted leading-relaxed max-w-3xl">
              The service is shaped by professional experience across
              architecture, design, 3D visualization, and image retouching,
              with a simple goal: help property professionals present spaces
              clearly, realistically, and efficiently.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/order"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shadow-sm"
              >
                Start an order
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
              >
                View services
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
              >
                Contact
              </Link>
            </div>
          </div>

          <aside className="bg-surface border border-border rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center">
                <Home className="w-5 h-5" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary-dark">
                  Who we help
                </p>
                <h2 className="text-xl font-bold text-primary">
                  Property marketing teams
                </h2>
              </div>
            </div>
            <div className="space-y-3">
              {audiences.map((audience) => (
                <div
                  key={audience}
                  className="flex items-center gap-3 bg-white border border-border rounded-xl px-4 py-3"
                >
                  <CheckCircle2 className="w-4 h-4 text-secondary-dark" aria-hidden />
                  <span className="text-sm font-semibold text-primary">
                    {audience}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
          {strengths.map((item) => (
            <article
              key={item.title}
              className="bg-white border border-border rounded-2xl p-6 shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center mb-5">
                <item.icon className="w-5 h-5 text-secondary-dark" aria-hidden />
              </div>
              <h2 className="text-lg font-bold text-primary mb-2">
                {item.title}
              </h2>
              <p className="text-sm text-muted leading-relaxed">
                {item.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 bg-primary rounded-2xl p-6 lg:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-secondary text-xs font-bold uppercase tracking-[0.18em] mb-2">
              <Sparkles className="w-4 h-4" aria-hidden />
              Ready when you are
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-white">
              Upload files, add instructions, and get a clear visual workflow.
            </h2>
          </div>
          <Link
            href="/order"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-primary-dark rounded-xl text-sm font-bold hover:bg-secondary-light transition-colors"
          >
            Start an order
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </Container>
    </section>
  );
}
