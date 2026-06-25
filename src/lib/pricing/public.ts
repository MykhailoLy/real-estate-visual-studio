import { getCatalogPrice } from "./catalog";
import type { PriceKey, TransactionalCurrency } from "./types";

export const PUBLIC_TAX_NOTICE =
  "Prices exclude applicable taxes. Taxes are calculated separately where applicable.";

export const PUBLIC_TAX_NOTICE_ES =
  "Los precios no incluyen los impuestos aplicables. Los impuestos se calculan por separado cuando corresponda.";

export const PUBLIC_VOLUME_DISCOUNTS = [
  { range: "1–4 eligible units", discount: "Standard price" },
  { range: "5–9 eligible units", discount: "5% off" },
  { range: "10–19 eligible units", discount: "10% off" },
  { range: "20–49 eligible units", discount: "15% off" },
  { range: "50+ eligible units", discount: "Custom quote" },
] as const;

export const PUBLIC_VOLUME_DISCOUNTS_ES = [
  { range: "1–4 unidades elegibles", discount: "Precio estándar" },
  { range: "5–9 unidades elegibles", discount: "5% de descuento" },
  { range: "10–19 unidades elegibles", discount: "10% de descuento" },
  { range: "20–49 unidades elegibles", discount: "15% de descuento" },
  { range: "50+ unidades elegibles", discount: "Presupuesto personalizado" },
] as const;

export function getCatalogPriceDecimal(
  priceKey: PriceKey,
  currency: TransactionalCurrency = "USD"
): string {
  return (getCatalogPrice(priceKey, currency) / 100).toFixed(2);
}
