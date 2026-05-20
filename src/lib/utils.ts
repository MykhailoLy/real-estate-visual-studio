import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes with clsx for conditional class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency (EUR)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generate an order number prefix based on service type
 */
export function getOrderPrefix(serviceType: string): string {
  const prefixes: Record<string, string> = {
    "virtual-staging": "VS",
    "virtual-renovation": "VR",
    "floor-plans": "FP",
    "photo-editing": "PE",
  };
  return prefixes[serviceType] || "ORD";
}
