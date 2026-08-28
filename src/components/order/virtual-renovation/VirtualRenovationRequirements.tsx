"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";

interface VirtualRenovationRequirementsProps {
  compact?: boolean;
}

function RequirementsContent({ idPrefix }: { idPrefix: string }) {
  return (
    <div className="space-y-6 text-[15px] leading-6 text-muted">
      <section aria-labelledby={`${idPrefix}-requirements-title`}>
        <h2
          id={`${idPrefix}-requirements-title`}
          className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary"
        >
          What we need
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>A high-resolution original image.</li>
          <li>
            A clear style/design brief covering build changes, fixture changes,
            furniture, materials, textures and colour direction where relevant.
          </li>
          <li>Reference images, links or mark-up sketches where helpful.</li>
          <li>
            Need inspiration? Add example images or a reference link that shows
            the direction you want.
          </li>
        </ul>
      </section>

      <section
        aria-labelledby={`${idPrefix}-information-title`}
        className="border-t border-border pt-6"
      >
        <h2
          id={`${idPrefix}-information-title`}
          className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary"
        >
          Virtual Renovation
        </h2>
        <p className="mt-3">
          Use Virtual Renovation to visualise proposed changes to finishes,
          fixtures, layouts and selected architectural elements.
        </p>
        <p className="mt-2">
          Complex reconstruction or unclear source material may require custom
          review before work begins.
        </p>
      </section>

      <section
        aria-labelledby={`${idPrefix}-formats-title`}
        className="border-t border-border pt-6"
      >
        <h2
          id={`${idPrefix}-formats-title`}
          className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary"
        >
          Acceptable file formats
        </h2>
        <dl className="mt-3 space-y-2">
          <div>
            <dt className="font-semibold text-foreground">Original photo</dt>
            <dd>JPG, JPEG or PNG.</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Reference files</dt>
            <dd>JPG, JPEG, PNG, WebP or PDF.</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

export default function VirtualRenovationRequirements({
  compact = false,
}: VirtualRenovationRequirementsProps) {
  const idPrefix = useId();

  if (compact) {
    return (
      <details className="group rounded-xl border border-border bg-white px-4 py-3 shadow-sm">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          Preparation requirements
          <ChevronDown
            className="h-4 w-4 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="border-t border-border pb-2 pt-5">
          <RequirementsContent idPrefix={idPrefix} />
        </div>
      </details>
    );
  }

  return (
    <aside
      aria-label="Virtual Renovation order requirements"
      className="border-l border-border pl-6"
    >
      <RequirementsContent idPrefix={idPrefix} />
    </aside>
  );
}
