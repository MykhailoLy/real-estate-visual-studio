import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock, Layers, Info } from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import Container from "@/components/layout/Container";
import { requireOrderingClient } from "@/lib/order-access";

// ============================================================
// /dashboard/orders/new/image-enhancement/hdr-bracketed
//
// INFORMATIONAL "Coming Soon" page only. It explains the planned HDR /
// Bracketed Images workflow. It MUST NOT upload files, call /api/order,
// issue upload URLs, submit a quote, create a $0 order, or use the
// Single Exposure price. No form is rendered here.
// ============================================================

export const dynamic = "force-dynamic";

const ROUTE = "/dashboard/orders/new/image-enhancement/hdr-bracketed";

export const metadata: Metadata = {
  title: "Image Enhancement — HDR / Bracketed (Coming Soon) | PicchuSpot",
  robots: { index: false, follow: false },
};

const PLANNED_WORKFLOW = [
  "Built for professional photographers supplying multiple exposures or brackets per final image.",
  "You'll enter the Number of Edits / Outputs you need.",
  "All exposures are uploaded together — no manual grouping required.",
  "Planned limit of up to 7 exposures per final output.",
];

export default async function HdrBracketedComingSoonPage() {
  await requireOrderingClient(ROUTE);

  return (
    <ClientDashboardLayout>
      <section className="py-10 lg:py-16 bg-surface min-h-screen">
        <Container>
          <div className="mb-6">
            <Link
              href="/dashboard/orders/new/image-enhancement"
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
              Back to Image Enhancement types
            </Link>
          </div>

          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700">
              <Clock className="w-3.5 h-3.5" aria-hidden />
              Coming Soon — Pricing to be confirmed
            </span>

            <h1 className="mt-4 text-3xl lg:text-4xl font-bold text-primary">
              Image Enhancement — HDR / Bracketed Images
            </h1>
            <p className="mt-2 text-muted leading-relaxed">
              For professional photographers uploading multiple exposures or
              brackets for each final real-estate image. This service is not
              yet available to order — pricing is being finalised.
            </p>

            <div className="mt-8 rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-primary" aria-hidden />
                <h2 className="text-[13px] font-bold text-foreground">
                  How it will work
                </h2>
              </div>
              <ul className="space-y-3">
                {PLANNED_WORKFLOW.map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-sm text-foreground/80">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-secondary"
                      aria-hidden
                    />
                    <span className="leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-xl border border-blue-200/60 bg-blue-50 px-4 py-3 text-[13px] text-blue-800">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden />
              <p className="leading-relaxed">
                Need standard listing photos enhanced now? Use{" "}
                <Link
                  href="/dashboard/orders/new/image-enhancement/single-exposure"
                  className="font-semibold underline underline-offset-2 hover:text-blue-900"
                >
                  Image Enhancement — Single Exposure
                </Link>{" "}
                (US$2 per image).
              </p>
            </div>

            <div className="mt-8">
              <Link
                href="/dashboard/orders/new/image-enhancement"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2.5 text-[13px] font-semibold text-foreground/70 hover:border-primary/40 hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
                Back to options
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </ClientDashboardLayout>
  );
}
