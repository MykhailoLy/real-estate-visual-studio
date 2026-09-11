import { ChevronDown } from "lucide-react";

export interface OrderGuideStep {
  title: string;
  description: string;
}

interface OrderGuideRailProps {
  title?: string;
  steps: OrderGuideStep[];
  informationTitle?: string;
  information?: React.ReactNode;
}

function GuideSteps({ steps }: { steps: OrderGuideStep[] }) {
  return (
    <ol className="mt-5 grid gap-5 md:grid-cols-3 md:gap-6 lg:mt-6 lg:gap-8">
      {steps.map((step, index) => (
        <li
          key={`${step.title}-${index}`}
          className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 md:block"
        >
          <span
            aria-hidden
            className="pt-0.5 text-sm font-bold tabular-nums text-secondary-dark"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 md:mt-1">
            <h3 className="text-dashboard-action font-bold uppercase tracking-[0.07em] text-primary">
              {step.title}
            </h3>
            <p className="mt-1.5 text-dashboard-body text-muted">
              {step.description}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function GuideInformation({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 border-t border-border pt-5 lg:mt-7 lg:pt-6">
      <h2 className="text-dashboard-kicker uppercase font-bold text-primary">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-dashboard-body text-muted lg:mt-4">
        {children}
      </div>
    </section>
  );
}

/**
 * One responsive contextual guide for every two-step order flow.
 *
 * Native details/summary semantics keep the guide collapsed by default at
 * every viewport. The expanded content is vertical on mobile and uses the
 * available width for horizontal steps from tablet sizes upward.
 */
export default function OrderGuideRail({
  title = "Order guide",
  steps,
  informationTitle = "Useful information",
  information,
}: OrderGuideRailProps) {
  return (
    <details className="group rounded-xl border border-border bg-white px-4 shadow-sm sm:px-5 lg:px-6">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2.5 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span className="text-dashboard-action font-bold uppercase tracking-[0.08em]">
          Order guide
        </span>
        <ChevronDown
          className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-border pb-5 pt-5 lg:pb-6 lg:pt-6">
        <h2 className="text-dashboard-kicker font-bold uppercase text-primary">
          {title}
        </h2>
        <GuideSteps steps={steps} />
        {information != null && (
          <GuideInformation title={informationTitle}>
            {information}
          </GuideInformation>
        )}
      </div>
    </details>
  );
}
