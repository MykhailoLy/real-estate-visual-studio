import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  ImagePlus,
  PictureInPicture2,
  Users,
} from "lucide-react";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Admin Dashboard | PicchuSpot",
  robots: { index: false, follow: false },
};

const cards = [
  {
    title: "Orders",
    description: "Review customer orders and uploaded files.",
    href: "/admin/orders",
    cta: "Open orders",
    icon: Briefcase,
  },
  {
    title: "Clients",
    description: "Manage registered client accounts and Partner pricing.",
    href: "/admin/clients",
    cta: "Manage clients",
    icon: Users,
  },
  {
    title: "Portfolio",
    description: "Upload before/after examples for the public site.",
    href: "/admin/portfolio",
    cta: "Manage portfolio",
    icon: ImagePlus,
  },
  {
    title: "Media",
    description: "Manage site images, service visuals, and reusable assets.",
    href: "/admin/media",
    cta: "Manage media",
    icon: PictureInPicture2,
  },
];

export default async function AdminDashboardPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary-dark">
          Workspace
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-primary">
          Manage production content from one place
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted lg:text-base">
          Move between order fulfillment, public portfolio examples, and site
          media without losing the admin context.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex min-h-[260px] flex-col rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-primary ring-1 ring-border">
              <card.icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="mt-8 flex-1">
              <h2 className="text-2xl font-bold tracking-tight text-primary">
                {card.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {card.description}
              </p>
            </div>
            <span className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition-colors group-hover:bg-primary-light">
              {card.cta}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
