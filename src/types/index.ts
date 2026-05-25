// ============================================================
// TYPE DEFINITIONS — PicchuSpot (Real Estate Visuals)
// ============================================================

// --- Services ---

export type RemoteServiceType =
  | "virtual-staging"
  | "virtual-renovation"
  | "floor-plans"
  | "photo-editing";

export type LocalServiceType =
  | "photography"
  | "360-tours"
  | "video-tours"
  | "drone-photography";

export type ServiceType = RemoteServiceType | LocalServiceType;

export type ServiceCategory = "remote" | "local";

export interface Service {
  id: ServiceType;
  name: string;
  shortName: string;
  category: ServiceCategory;
  description: string;
  deliverables: string[];
  priceFrom: number;
  priceUnit: string; // "per image", "per plan", "per property"
  orderable: boolean; // true for remote services (can be ordered online)
}

// --- Orders ---

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "in-progress"
  | "delivered"
  | "cancelled";

export interface Order {
  id: string;
  order_number: string;
  service_type: RemoteServiceType;
  status: OrderStatus;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_company?: string;
  item_count: number;
  estimated_total: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_index: number;
  original_photo_url?: string;
  reference_image_url?: string;
  details: StagingDetails | RenovationDetails | FloorPlanDetails | PhotoEditDetails;
  created_at: string;
}

// --- Service-Specific Order Item Details ---

export interface StagingDetails {
  type: "virtual-staging";
  room_type: RoomType;
  interior_style: InteriorStyle;
  notes?: string;
  reference_link?: string;
}

export interface RenovationDetails {
  type: "virtual-renovation";
  instructions: string;
  elements_to_keep?: string;
  elements_to_remove?: string;
  elements_to_replace?: string;
  preferred_materials?: string;
  reference_link?: string;
  notes?: string;
}

export interface FloorPlanDetails {
  type: "floor-plans";
  property_type: PropertyType;
  number_of_floors: number;
  output_type: "2D" | "3D" | "Both";
  notes?: string;
}

export interface PhotoEditDetails {
  type: "photo-editing";
  editing_types: EditingType[];
  notes?: string;
}

// --- Enums / Union Types ---

export type RoomType =
  | "Living Room"
  | "Bedroom"
  | "Kitchen"
  | "Bathroom"
  | "Dining Room"
  | "Office"
  | "Outdoor/Terrace"
  | "Other";

export type InteriorStyle =
  | "Modern"
  | "Scandinavian"
  | "Mid-Century"
  | "Industrial"
  | "Coastal"
  | "Classic"
  | "Minimalist"
  | "Rustic"
  | "Luxury"
  | "Other";

export type PropertyType =
  | "Apartment"
  | "House"
  | "Villa"
  | "Commercial"
  | "Other";

export type EditingType =
  | "Color correction"
  | "HDR blending"
  | "Sky replacement"
  | "Lens correction"
  | "Object removal"
  | "Twilight conversion"
  | "Grass/garden enhancement"
  | "Other";

// --- Portfolio ---

export type PortfolioCategory =
  | "virtual-staging"
  | "renovation"
  | "photography"
  | "video-drone"
  | "floor-plans";

export interface PortfolioItem {
  id: string;
  title: string;
  category: PortfolioCategory;
  imageBefore?: string;
  imageAfter: string;
  thumbnail: string;
  description?: string;
  tags: string[];
}

// --- Testimonials ---

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company?: string;
  quote: string;
  image?: string;
}

// --- FAQ ---

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: "general" | "ordering" | "pricing" | "delivery" | "local-services";
}

// --- Contact Form ---

export interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  service_interest?: ServiceType;
  message: string;
}

// --- Order Form ---

export interface OrderFormData {
  service_type: RemoteServiceType;
  items: OrderItemFormData[];
  client_name: string;
  client_email: string;
  client_phone: string;
  client_company?: string;
  agree_terms: boolean;
}

export interface OrderItemFormData {
  original_photo?: File;
  reference_image?: File;
  details: StagingDetails | RenovationDetails | FloorPlanDetails | PhotoEditDetails;
}
