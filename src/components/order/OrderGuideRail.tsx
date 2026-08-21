import { cn } from "@/lib/utils";

export interface OrderGuideStep {
  title: string;
  description: string;
}

interface OrderGuideRailProps {
  title?: string;
  steps: OrderGuideStep[];
  informationTitle?: string;
  information?: React.ReactNode;
  /** Hide secondary information until very wide screens when space is tight. */
  deferInformation?: boolean;
}

/**
 * Reusable editorial guidance for service-specific order flows.
 *
 * The parent layout owns when the full rail appears; this component keeps the
 * numbered workflow and optional secondary information visually consistent.
 */
export default function OrderGuideRail({
  title = "How to create your job",
  steps,
  informationTitle = "Useful information",
  information,
  deferInformation = false,
}: OrderGuideRailProps) {
  return (
    <aside aria-label="Order guide" className="text-foreground">
      <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] text-primary">
        {title}
      </h2>

      <ol className="mt-6 space-y-7">
        {steps.map((step, index) => (
          <li key={`${step.title}-${index}`} className="grid grid-cols-[2rem_1fr] gap-3">
            <span
              aria-hidden
              className="pt-0.5 text-sm font-bold tabular-nums text-secondary-dark"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-primary">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {information != null && (
        <section
          className={cn(
            "mt-9 border-t border-border pt-7",
            deferInformation && "hidden min-[1400px]:block",
          )}
        >
          <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] text-primary">
            {informationTitle}
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-muted">
            {information}
          </div>
        </section>
      )}
    </aside>
  );
}
