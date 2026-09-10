interface OrderImageCardHeaderProps {
  index: number;
  filename?: string | null;
  itemLabel?: string;
  action?: React.ReactNode;
}
export default function OrderImageCardHeader({
  index,
  filename,
  itemLabel = "Image",
  action,
}: OrderImageCardHeaderProps) {
  return (
    <header className="mb-6 flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-dashboard-canvas px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-base font-bold leading-tight text-primary sm:text-lg">
          {itemLabel} {String(index + 1).padStart(2, "0")}
        </h2>
        <p
          className="mt-1 truncate text-dashboard-metadata text-muted"
          title={filename ?? undefined}
        >
          {filename || "Waiting for file"}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
