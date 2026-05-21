import Container from "@/components/layout/Container";
import SectionHeader from "./SectionHeader";
import { Upload, Palette, Download, Calendar, Camera, FolderOpen } from "lucide-react";

const remoteSteps = [
  {
    icon: Upload,
    step: "1",
    title: "Upload Photos",
    description: "Upload your property photos through our simple order form.",
  },
  {
    icon: Palette,
    step: "2",
    title: "Choose Options",
    description: "Select your style, add-ons, and any specific instructions.",
  },
  {
    icon: Download,
    step: "3",
    title: "Get Results",
    description: "Receive your professionally edited files within 24-48 hours.",
  },
];

const localSteps = [
  {
    icon: Calendar,
    step: "1",
    title: "Book a Shoot",
    description: "Contact us with your property details and preferred date.",
  },
  {
    icon: Camera,
    step: "2",
    title: "We Come to You",
    description: "Our team arrives on-site with professional equipment.",
  },
  {
    icon: FolderOpen,
    step: "3",
    title: "Files Delivered",
    description: "Edited photos, video, or virtual tours delivered in 24-48h.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-16 lg:py-24">
      <Container>
        <SectionHeader
          title="Simple Process, Stunning Results"
          subtitle="Whether you order remotely or book a local shoot, we make it easy."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Remote */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary mb-6">
              Remote Digital Services
            </h3>
            <div className="space-y-6">
              {remoteSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.step} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {step.title}
                      </p>
                      <p className="text-sm text-muted mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Local */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary mb-6">
              Local Services — Alicante & Costa Blanca
            </h3>
            <div className="space-y-6">
              {localSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.step} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {step.title}
                      </p>
                      <p className="text-sm text-muted mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
