import type { OrderServiceCard } from "./order-services.ts";
import { getCatalogPrice } from "./pricing/catalog.ts";
import { formatMoney } from "./pricing/format.ts";
import type { TransactionalCurrency } from "./pricing/types.ts";

/**
 * Display-only catalog price copy shared by compact and card-based service
 * selectors. Authoritative prices remain in the pricing catalog.
 */
export function getOrderServicePriceLabel(
  service: Pick<OrderServiceCard, "slug" | "priceKey" | "priceLabel">,
  currency: TransactionalCurrency,
): string {
  if (!service.priceKey) return service.priceLabel;

  const unit = service.slug === "floor-plans" ? "floor" : "image";
  return `From ${formatMoney(getCatalogPrice(service.priceKey, currency), currency)} / ${unit}`;
}
