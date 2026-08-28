export default function DashboardLoading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      role="status"
      aria-label="Loading dashboard page"
    >
      <div className="mb-6 h-7 w-44 animate-pulse rounded-md bg-primary/10" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl border border-border bg-surface"
          />
        ))}
      </div>
      <span className="sr-only">Loading dashboard content</span>
    </div>
  );
}
