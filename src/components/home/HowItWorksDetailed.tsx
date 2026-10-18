import { ArrowRight, Images, UserRound, Upload, ClipboardCheck } from "lucide-react";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";

// ============================================================
// HOW IT WORKS — 4-step homepage section
// ============================================================

const STEPS = [
  {
    icon: Images,
    title: "Choose a service",
    body: "Compare examples and pricing. Choose the edit or floor plan your project needs.",
  },
  {
    icon: UserRound,
    title: "Sign in or create an account",
    body: "Log in or create your account, then add your name to open the order form.",
  },
  {
    icon: Upload,
    title: "Add files and instructions",
    body: "Upload your photos or plans, select your options, and add instructions and references where available.",
  },
  {
    icon: ClipboardCheck,
    title: "Review and confirm",
    body: "Check your files, selections and total. Submit your order and complete payment when requested.",
  },
];

export type HowItWorksDetailedCopy = {
  eyebrow: string;
  title: string;
  description: string;
  stepLabel: string;
  ctaLabel: string;
  deliveryNote: string;
  steps: {
    title: string;
    body: string;
  }[];
};

const DEFAULT_COPY: HowItWorksDetailedCopy = {
  eyebrow: "Process",
  title: "How to place your first order",
  description: "Review your files, instructions and total before you submit.",
  stepLabel: "STEP",
  ctaLabel: "Start your first order",
  deliveryNote: "Track your order and download delivered files from your account.",
  steps: STEPS,
};

export default function HowItWorksDetailed({
  copy = DEFAULT_COPY,
}: {
  copy?: HowItWorksDetailedCopy;
}) {
  return (
    <section className="scroll-mt-32 py-12 lg:py-16 bg-white" id="how-it-works" aria-labelledby="first-order-heading">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="max-w-3xl mb-10 lg:mb-12">
          <p className="text-public-kicker font-semibold uppercase text-secondary-dark mb-4">
            {copy.eyebrow}
          </p>
          <h2 id="first-order-heading" className="text-3xl lg:text-4xl font-bold text-primary tracking-tight leading-[1.05]">
            {copy.title}
          </h2>
          <p className="mt-6 text-public-lead lg:text-xl text-muted leading-relaxed">
            {copy.description}
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {copy.steps.map((step, i) => {
            const Icon = STEPS[i]?.icon ?? Upload;
            const stepNumber = String(i + 1).padStart(2, "0");
            return (
              <li
                key={step.title}
                className="border-t border-border pt-6"
              >
                <div className="mb-4 flex items-center gap-3 text-primary">
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  <span className="text-xs font-semibold tracking-[0.12em]">
                    {copy.stepLabel} {stepNumber}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground text-lg">
                  {step.title}
                </h3>
                <p className="mt-2 text-base text-muted leading-relaxed">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            {copy.ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </ClientPortalLink>
          <p className="max-w-lg text-sm leading-relaxed text-muted">{copy.deliveryNote}</p>
        </div>
      </div>
    </section>
  );
}
