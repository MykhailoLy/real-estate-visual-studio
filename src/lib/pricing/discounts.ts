export interface VolumeDiscount {
  percent: number;
  customQuote: boolean;
}

export function getVolumeDiscount(eligibleUnits: number): VolumeDiscount {
  if (!Number.isInteger(eligibleUnits) || eligibleUnits < 0) {
    throw new Error("Eligible unit count must be a non-negative integer.");
  }
  if (eligibleUnits >= 50) return { percent: 0, customQuote: true };
  if (eligibleUnits >= 20) return { percent: 15, customQuote: false };
  if (eligibleUnits >= 10) return { percent: 10, customQuote: false };
  if (eligibleUnits >= 5) return { percent: 5, customQuote: false };
  return { percent: 0, customQuote: false };
}
