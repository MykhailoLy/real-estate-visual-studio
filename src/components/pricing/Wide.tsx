// Shared wide container used across pricing detail pages.
// Matches the wider layout used on the Services page.

export default function Wide({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 ${className}`}
    >
      {children}
    </div>
  );
}
