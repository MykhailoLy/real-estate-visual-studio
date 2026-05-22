import BeforeAfterPlaceholder from "./BeforeAfterPlaceholder";

interface ServiceExampleBlockProps {
  title: string;
  description: string;
  price?: string;
  priceLabel?: string;
  variant?:
    | "staging"
    | "renovation"
    | "editing"
    | "floor-plan"
    | "pool"
    | "background"
    | "color"
    | "dusk"
    | "object-removal"
    | "enhancement";
  bullets?: string[];
  note?: string;
}

/**
 * Reusable card showing a real-world example of a service option.
 * Used on photo editing and renovation pages to give visual context.
 */
export default function ServiceExampleBlock({
  title,
  description,
  price,
  priceLabel = "Price",
  variant = "editing",
  bullets,
  note,
}: ServiceExampleBlockProps) {
  return (
    <article className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow flex flex-col">
      <div className="p-4 lg:p-5 border-b border-stone-100 bg-stone-50/40">
        <BeforeAfterPlaceholder variant={variant} rounded="xl" />
      </div>
      <div className="p-6 lg:p-7 flex-1 flex flex-col">
        <h3 className="text-lg lg:text-xl font-bold text-primary mb-2 tracking-tight">
          {title}
        </h3>
        <p className="text-sm lg:text-base text-muted leading-relaxed mb-4">
          {description}
        </p>

        {bullets && bullets.length > 0 && (
          <ul className="space-y-1.5 mb-4">
            {bullets.map((b) => (
              <li
                key={b}
                className="text-sm text-foreground flex gap-2 leading-relaxed"
              >
                <span className="text-secondary-dark mt-0.5">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {note && (
          <p className="text-xs text-muted italic mb-4 leading-relaxed">
            {note}
          </p>
        )}

        {price && (
          <div className="mt-auto pt-4 border-t border-stone-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted">
              {priceLabel}
            </span>
            <span className="text-base lg:text-lg font-bold text-primary">
              {price}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
