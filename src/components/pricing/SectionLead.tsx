interface SectionLeadProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}

/**
 * Section heading helper used across pricing detail pages.
 * Small eyebrow + bold deep-navy title + muted description.
 */
export default function SectionLead({
  eyebrow,
  title,
  description,
  align = "left",
  className = "",
}: SectionLeadProps) {
  return (
    <div
      className={`${
        align === "center" ? "text-center mx-auto" : ""
      } max-w-3xl mb-10 lg:mb-14 ${className}`}
    >
      {eyebrow && (
        <p className="text-public-kicker font-semibold uppercase text-secondary-dark mb-3">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary mb-4 tracking-tight leading-[1.1]">
        {title}
      </h2>
      {description && (
        <p className="text-base lg:text-lg text-muted leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
