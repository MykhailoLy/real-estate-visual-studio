interface OrderImageCardHeaderProps {
  index: number;
  totalItems: number;
  action?: React.ReactNode;
}
export default function OrderImageCardHeader({
  index,
  totalItems,
  action,
}: OrderImageCardHeaderProps) {
  return (
    <header className="mb-6 flex min-w-0 items-center justify-between gap-3 border-b border-border pb-4">
      <h2 className="text-xl font-extrabold uppercase leading-tight tracking-[-0.02em] text-primary sm:text-2xl">
        Image {index + 1} of {totalItems}
      </h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
