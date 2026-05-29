interface PricingRow {
  label: string;
  price: string;
  unit?: string;
  note?: string;
}

interface PricingTableProps {
  title?: string;
  caption?: string;
  rows: PricingRow[];
  showPlusPrefix?: boolean;
  headerLabel?: string;
  headerPrice?: string;
}

/**
 * Clean, readable pricing table. Designed for both base price tables
 * and add-on / option tables. Mobile responsive.
 */
export default function PricingTable({
  title,
  caption,
  rows,
  showPlusPrefix = false,
  headerLabel,
  headerPrice,
}: PricingTableProps) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 shadow-sm">
      {title && (
        <h3 className="text-lg lg:text-xl font-bold text-primary mb-4 tracking-tight">
          {title}
        </h3>
      )}
      <div className="border border-stone-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm lg:text-base">
          {(headerLabel || headerPrice) && (
            <thead>
              <tr className="bg-stone-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  {headerLabel ?? "Option"}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  {headerPrice ?? "Price"}
                </th>
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.label}
                className={i % 2 === 0 ? "bg-white" : "bg-stone-50/60"}
              >
                <td className="px-4 py-3 lg:py-3.5 text-foreground align-top">
                  <div>{row.label}</div>
                  {row.note && (
                    <div className="text-xs text-muted mt-0.5">{row.note}</div>
                  )}
                </td>
                <td className="px-4 py-3 lg:py-3.5 text-right whitespace-nowrap align-top">
                  <span className="font-semibold text-primary">
                    {showPlusPrefix && !row.price.startsWith("+") ? "+" : ""}
                    {row.price}
                  </span>
                  {row.unit && (
                    <span className="text-xs text-muted ml-1">{row.unit}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && (
        <p className="text-xs lg:text-sm text-muted mt-4 leading-relaxed">
          {caption}
        </p>
      )}
    </div>
  );
}
