import Link from "next/link";
import Container from "@/components/layout/Container";
import SectionHeader from "./SectionHeader";
import {
  ImagePlus,
  Paintbrush,
  LayoutGrid,
  SlidersHorizontal,
  Eraser,
  Camera,
  View,
  Video,
  Plane,
} from "lucide-react";

const remoteServices = [
  { icon: ImagePlus, name: "Virtual Staging", href: "/order/virtual-staging" },
  { icon: Paintbrush, name: "Virtual Renovation", href: "/order/virtual-renovation" },
  { icon: LayoutGrid, name: "2D / 3D Floor Plans", href: "/order/3d-floor-plans" },
  { icon: SlidersHorizontal, name: "Photo Editing", href: "/order/photo-editing" },
  { icon: Eraser, name: "Decluttering / Object Removal", href: "/order/photo-editing" },
];

const localServices = [
  { icon: Camera, name: "Real Estate Photography" },
  { icon: View, name: "360 Virtual Tours" },
  { icon: Video, name: "Property Video Tours" },
  { icon: Plane, name: "Drone / Aerial Photography" },
];

export default function ServiceCategories() {
  return (
    <section className="py-16 lg:py-24">
      <Container>
        <SectionHeader
          title="Two Ways We Help You Sell"
          subtitle="Remote digital services for agents worldwide. On-location media production in Alicante & Costa Blanca."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Remote */}
          <div className="bg-white border border-border rounded-2xl p-6 lg:p-8">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                Remote Digital Services
              </p>
              <p className="text-sm text-muted">
                Order from anywhere. Delivered in 24-48h.
              </p>
            </div>
            <ul className="space-y-3 mb-6">
              {remoteServices.map((svc) => {
                const Icon = svc.icon;
                return (
                  <li key={svc.name}>
                    <Link
                      href={svc.href}
                      className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors"
                    >
                      <Icon className="w-4 h-4 text-muted" />
                      {svc.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link
              href="/order"
              className="inline-flex px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
            >
              Order Online →
            </Link>
          </div>

          {/* Local */}
          <div className="bg-white border border-border rounded-2xl p-6 lg:p-8">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                Local Services — Alicante & Costa Blanca
              </p>
              <p className="text-sm text-muted">
                Professional on-site shoots. We come to your property.
              </p>
            </div>
            <ul className="space-y-3 mb-6">
              {localServices.map((svc) => {
                const Icon = svc.icon;
                return (
                  <li key={svc.name} className="flex items-center gap-3 text-sm text-foreground">
                    <Icon className="w-4 h-4 text-muted" />
                    {svc.name}
                  </li>
                );
              })}
            </ul>
            <Link
              href="/contact"
              className="inline-flex px-5 py-2.5 border border-primary text-primary text-sm font-semibold rounded-lg hover:bg-primary hover:text-white transition-colors"
            >
              Book a Shoot →
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
