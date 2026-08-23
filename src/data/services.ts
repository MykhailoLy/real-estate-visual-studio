import type { Service } from "@/types";

export const remoteServices: Service[] = [
  {
    id: "virtual-staging",
    name: "Virtual Staging",
    shortName: "Staging",
    category: "remote",
    description:
      "Transform empty rooms into beautifully furnished spaces. Choose from multiple interior styles to match your target audience.",
    deliverables: [
      "High-resolution JPG",
      "Multiple style options",
      "1 revision included",
      "24-48h delivery",
    ],
    priceKey: "virtual-staging",
    priceUnit: "per image",
    orderable: true,
  },
  {
    id: "virtual-renovation",
    name: "Virtual Renovation",
    shortName: "Renovation",
    category: "remote",
    description:
      "Show buyers the potential of outdated properties. We digitally renovate kitchens, bathrooms, flooring, and more.",
    deliverables: [
      "Photorealistic renovation render",
      "Material/style selection",
      "1 revision included",
      "High-resolution JPG",
    ],
    priceKey: "renovation-replace-walls",
    priceUnit: "per option",
    orderable: true,
  },
  {
    id: "floor-plans",
    name: "3D Floor Plans",
    shortName: "Floor Plans",
    category: "remote",
    description:
      "Help buyers understand property layout with professional 2D or 3D floor plans created from your sketches or photos.",
    deliverables: [
      "2D or 3D floor plan",
      "Accurate measurements",
      "Branded option available",
      "PDF + JPG delivery",
    ],
    priceKey: "floor-plan-2d-bw",
    priceUnit: "per floor",
    orderable: true,
  },
  {
    id: "photo-editing",
    name: "Real Estate Photo Editing",
    shortName: "Photo Editing",
    category: "remote",
    description:
      "Professional color correction, HDR blending, sky replacement, lens correction, and object removal for listing photos.",
    deliverables: [
      "HDR blending",
      "Sky replacement",
      "Color correction",
      "Lens distortion fix",
      "High-resolution files",
    ],
    priceKey: "turn-on-lights",
    priceUnit: "per option",
    orderable: true,
  },
  {
    id: "virtual-staging", // Note: Decluttering shares staging's order flow for MVP
    name: "Decluttering / Object Removal",
    shortName: "Decluttering",
    category: "remote",
    description:
      "Remove furniture, clutter, and distractions from property photos. Clean images that help buyers focus on the space itself.",
    deliverables: [
      "Objects removed cleanly",
      "Realistic background fill",
      "High-resolution JPG",
      "24-48h delivery",
    ],
    priceKey: "item-removal-virtual-cleaning",
    priceUnit: "per image",
    orderable: true,
  },
];

export const localServices: Service[] = [
  {
    id: "photography",
    name: "Real Estate Photography",
    shortName: "Photography",
    category: "local",
    description:
      "Professional HDR real estate photography in Alicante & Costa Blanca. Make every listing stand out with stunning interior and exterior shots.",
    deliverables: [
      "Professional HDR photos",
      "Interior + exterior coverage",
      "Edited and color-corrected",
      "Delivered within 24-48h",
    ],
    orderable: false,
  },
  {
    id: "360-tours",
    name: "360 Virtual Tours",
    shortName: "360 Tours",
    category: "local",
    description:
      "Immersive 360° virtual tours that let buyers explore properties remotely. Perfect for international buyers and premium listings.",
    deliverables: [
      "Full 360° property tour",
      "Hosted online link",
      "Embeddable on listings",
      "Mobile-friendly viewer",
    ],
    orderable: false,
  },
  {
    id: "video-tours",
    name: "Property Video Tours",
    shortName: "Video Tours",
    category: "local",
    description:
      "Cinematic walkthrough videos that bring listings to life. Engage buyers with professional real estate video content.",
    deliverables: [
      "1-2 minute cinematic video",
      "Professional editing",
      "Background music",
      "Multiple formats (social, web)",
    ],
    orderable: false,
  },
  {
    id: "drone-photography",
    name: "Drone / Aerial Photography & Video",
    shortName: "Drone/Aerial",
    category: "local",
    description:
      "Stunning aerial perspectives of properties and surroundings. Available only where flight regulations permit.",
    deliverables: [
      "Aerial photos + video",
      "Property & neighborhood views",
      "4K resolution",
      "Licensed drone operator",
    ],
    orderable: false,
  },
];

export const allServices = [...remoteServices, ...localServices];
