import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}

export default function SectionHeader({
  title,
  subtitle,
  align = "center",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-10 lg:mb-14",
        align === "center" && "text-center max-w-2xl mx-auto",
        className
      )}
    >
      <h2 className="text-2xl lg:text-4xl font-bold text-foreground">{title}</h2>
      {subtitle && (
        <p className="mt-3 text-base lg:text-lg text-muted leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
