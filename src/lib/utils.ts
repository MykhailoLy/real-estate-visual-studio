import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Register dashboard font sizes so cn() keeps them alongside text colors.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "dashboard-section",
        "dashboard-body",
        "dashboard-action",
        "dashboard-metadata",
        "dashboard-kicker",
        "dashboard-mobile-control",
      ],
    },
  },
});

/**
 * Merge Tailwind classes with clsx for conditional class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format cents to USD display string.
 * Example: 1900 → "US$19.00", 200 → "US$2.00"
 */
export function formatUSD(cents: number): string {
  const dollars = cents / 100;
  return `US$${dollars.toFixed(2)}`;
}

/**
 * Generate an order number prefix based on service type
 */
export function getOrderPrefix(serviceType: string): string {
  const prefixes: Record<string, string> = {
    "virtual-staging": "VS",
    "virtual-renovation": "VR",
    "3d-floor-plans": "FP",
    "photo-editing": "PE",
  };
  return prefixes[serviceType] || "ORD";
}
