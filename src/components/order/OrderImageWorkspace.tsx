import { cn } from "@/lib/utils";

interface OrderImageWorkspaceProps {
  hasPreview: boolean;
  media: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared responsive composition for image-led New Order item cards.
 *
 * Cards stay stacked until a previewable original exists and the viewport is
 * wide enough for useful side-by-side editing. At that point the original
 * receives 40% of the available width and the item controls receive 60%.
 */
export default function OrderImageWorkspace({
  hasPreview,
  media,
  children,
  className,
}: OrderImageWorkspaceProps) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-5 lg:gap-6 xl:gap-8",
        hasPreview &&
          "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start",
        className,
      )}
    >
      <div className={cn("min-w-0", hasPreview && "lg:sticky lg:top-20")}>
        {media}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
