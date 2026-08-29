import Image from "next/image";
import { cn } from "@/lib/utils";

export type WordmarkTheme = "light" | "dark";

interface BrandWordmarkProps {
  theme?: WordmarkTheme;
  className?: string;
}

export default function BrandWordmark({
  theme = "light",
  className,
}: BrandWordmarkProps) {
  return (
    <span
      role="img"
      aria-label="PicchuSpot"
      className={cn("inline-flex items-center leading-none", className)}
    >
      <Image
        src={
          theme === "dark"
            ? "/brand/picchuspot-wordmark-dark.svg"
            : "/brand/picchuspot-wordmark.svg"
        }
        alt=""
        aria-hidden="true"
        width={1565}
        height={255}
        unoptimized
        className="h-[0.82em] w-auto"
      />
    </span>
  );
}
