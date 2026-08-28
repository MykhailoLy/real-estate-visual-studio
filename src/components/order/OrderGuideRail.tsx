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
  /** Horizontal, lightweight presentation for tablet widths. */
  variant?: "rail" | "compact";
  /** Whether to show numbers for steps. Defaults to true. */
  numbered?: boolean;
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
  variant = "rail",
  numbered = true,
}: OrderGuideRailProps) {
  if (variant === "compact") {
    const ListComponent = numbered ? "ol" : "ul";
    return (
      <section
        aria-label="Order guide"
        className="border-y border-border bg-white/70 px-4 py-5 text-foreground sm:px-5"
      >
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
          {title}
        </h2>
        <ListComponent className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {steps.map((step, index) => (
            <li key={`${step.title}-${index}`} className={cn("min-w-0", !numbered && "flex items-start gap-2")}>
              {numbered ? (
                <span className="text-sm font-bold tabular-nums text-secondary-dark">
                  {String(index + 1).padStart(2, "0")}
                </span>
              ) : (
                <span className="pt-2 text-primary shrink-0 flex justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary block" />
                </span>
              )}
              <div>
                <h3 className={cn("text-sm font-bold uppercase tracking-[0.06em] text-primary", numbered && "mt-1")}>
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-5 text-muted">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ListComponent>

        {information != null && (
          <details className="mt-4 border-t border-border pt-3">
            <summary className="cursor-pointer text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
              {informationTitle}
            </summary>
            <div className="mt-3 space-y-2 text-sm leading-5 text-muted">
              {information}
            </div>
          </details>
        )}
      </section>
    );
  }

  const ListComponent = numbered ? "ol" : "ul";

  return (
    <aside aria-label="Order guide" className="text-foreground">
      <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] text-primary">
        {title}
      </h2>

      <ListComponent className="mt-6 space-y-7">
        {steps.map((step, index) => (
          <li key={`${step.title}-${index}`} className="grid grid-cols-[2rem_1fr] gap-3">
            {numbered ? (
              <span
                aria-hidden
                className="pt-0.5 text-sm font-bold tabular-nums text-secondary-dark"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            ) : (
              <span
                aria-hidden
                className="pt-2.5 text-primary flex justify-center"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary block" />
              </span>
            )}
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
      </ListComponent>

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
