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

interface GuideStepsProps {
  steps: OrderGuideStep[];
  layout: "vertical" | "horizontal";
}

function GuideSteps({ steps, layout }: GuideStepsProps) {
  return (
    <ol
      className={
        layout === "horizontal"
          ? "mt-4 grid grid-cols-3 gap-5"
          : "mt-5 space-y-5 lg:mt-6 lg:space-y-7"
      }
    >
      {steps.map((step, index) => (
        <li
          key={`${step.title}-${index}`}
          className={
            layout === "horizontal"
              ? "min-w-0"
              : "grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3"
          }
        >
          <span
            aria-hidden
            className="pt-0.5 text-sm font-bold tabular-nums text-secondary-dark"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className={layout === "horizontal" ? "mt-1" : "min-w-0"}>
            <h3 className="text-sm font-bold uppercase tracking-[0.07em] text-primary">
              {step.title}
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-muted">
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
    <section className="mt-6 border-t border-border pt-5 lg:mt-9 lg:pt-7">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary lg:text-[12px]">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-muted lg:mt-4">
        {children}
      </div>
    </section>
  );
}

/**
 * One responsive contextual guide for every two-step order flow.
 *
 * Mobile uses native details/summary semantics, tablet keeps the workflow
 * visible horizontally, and desktop presents the same content as a light
 * editorial rail. Breakpoint-exclusive renderers prevent duplicated accessible
 * headings at any viewport size without adding responsive JavaScript.
 */
export default function OrderGuideRail({
  title = "Order guide",
  steps,
  informationTitle = "Useful information",
  information,
}: OrderGuideRailProps) {
  return (
    <>
      <details className="group rounded-lg border border-border bg-white px-4 shadow-sm md:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          <span className="text-sm font-semibold">Before you start</span>
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]">
            Order guide
            <ChevronDown
              className="h-4 w-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </span>
        </summary>
        <div className="border-t border-border pb-5 pt-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {title}
          </h2>
          <GuideSteps steps={steps} layout="vertical" />
          {information != null && (
            <GuideInformation title={informationTitle}>
              {information}
            </GuideInformation>
          )}
        </div>
      </details>

      <section
        aria-label="Order guide"
        className="hidden border-y border-border bg-white/70 px-5 py-5 text-foreground md:block lg:hidden"
      >
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
          {title}
        </h2>
        <GuideSteps steps={steps} layout="horizontal" />
        {information != null && (
          <details className="group mt-4 border-t border-border pt-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
              {informationTitle}
              <ChevronDown
                className="h-4 w-4 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-2 pb-2 text-sm leading-6 text-muted">
              {information}
            </div>
          </details>
        )}
      </section>

      <aside
        aria-label="Order guide"
        className="hidden border-l border-border pl-6 text-foreground lg:block"
      >
        <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] text-primary">
          {title}
        </h2>
        <GuideSteps steps={steps} layout="vertical" />
        {information != null && (
          <GuideInformation title={informationTitle}>
            {information}
          </GuideInformation>
        )}
      </aside>
    </>
  );
}
