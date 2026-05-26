import { cn } from "@/lib/utils";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

// Shared content wrapper used across the public site. Bumped from
// max-w-7xl (1280px) to max-w-[1500px] so the homepage, the four
// top-level category pages, and inner pages all read with a wider,
// more confident rhythm. The slightly larger lg padding keeps text
// blocks from hugging the edge on very wide displays.
export default function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={cn(
        "max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12",
        className
      )}
    >
      {children}
    </div>
  );
}
