export const IMAGE_PROFILES = ["gallery", "floor-plan"] as const;

export type ClientImageProfile = (typeof IMAGE_PROFILES)[number];

export interface ImageProfileSettings {
  maxLongSide: number;
  minLongSide: number;
  targetBytes: number;
  initialQuality: number;
  minimumQuality: number;
}

export const STANDARD_PUBLIC_IMAGE_PROFILE: ClientImageProfile = "gallery";

/**
 * Environment-neutral public image profiles shared by browser uploads and
 * server-side maintenance tools. Keep profile changes centralized here so a
 * backfill can never silently drift from the live admin upload behavior.
 */
export const IMAGE_PROFILE_SETTINGS = {
  gallery: {
    maxLongSide: 2800,
    minLongSide: 1800,
    targetBytes: 1_600_000,
    initialQuality: 0.84,
    minimumQuality: 0.68,
  },
  "floor-plan": {
    maxLongSide: 4000,
    minLongSide: 2400,
    targetBytes: 3_000_000,
    initialQuality: 0.92,
    minimumQuality: 0.82,
  },
} as const satisfies Record<ClientImageProfile, ImageProfileSettings>;
