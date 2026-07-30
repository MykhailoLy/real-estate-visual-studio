import type { PropertyShowcase } from "./types";

export interface PropertyShowcaseAdminRecord {
  id: string;
  slug: string;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  property: PropertyShowcase;
}

export interface PropertyShowcaseAdminListResult {
  records: PropertyShowcaseAdminRecord[];
  schemaReady: boolean;
}
