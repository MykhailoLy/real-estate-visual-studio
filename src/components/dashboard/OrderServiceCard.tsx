import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, Lock } from "lucide-react";
import type { OrderServiceCard as OrderServiceCardData } from "@/lib/order-services";
import type { OrderCardImage } from "@/lib/order-card-media";

// ============================================================
// OrderServiceCard — one service tile in the New Order hub.
//
// Active services render as a fully-clickable Link with a
// "Start Order" CTA, hover lift, and image zoom. Inactive
// services (coming-soon / custom-quote) render as a
// non-interactive card with a disabled CTA; they never navigate
// and are not keyboard-focusable, but their status is conveyed by
// text + icon (not colour alone) and remains screen-reader
// friendly via an explicit label.
// ============================================================

interface OrderServiceCardProps {
  service: OrderServiceCardData;
  image: OrderCardImage | null;
}

function CardMedia({
  service,
  image,
}: OrderServiceCardProps) {
  const Icon = service.icon;
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-stone-100">
      {image ? (
        <Image
          src={image.url}
          alt={image.alt ?? service.title}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        // Branded CSS fallback — never a broken-image element.
        <div
          aria-hidden
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 via-surface to-secondary/10"
        >
          <Icon className="w-9 h-9 text-primary/60" />
          <span className="px-4 text-center text-xs font-semibold tracking-wide text-primary/70">
            {service.title}
          </span>
        </div>
      )}

      {service.badge && (
        <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-primary/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-sm">
          {service.badge}
        </span>
      )}
    </div>
  );
}

function CardBody({ service }: { service: OrderServiceCardData }) {
  const isActive = service.availability === "active";
  return (
    <div className="flex flex-1 flex-col p-5">
      <h2 className="text-lg font-semibold text-foreground">{service.title}</h2>
      <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-muted">
        {service.description}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-primary">
            {service.priceLabel}
          </p>
          {service.turnaroundLabel && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <Clock className="h-3 w-3" aria-hidden />
              {service.turnaroundLabel}
            </p>
          )}
        </div>

        {isActive ? (
          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-white transition-colors group-hover:bg-primary-light">
            Start Order
            <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        ) : (
          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-stone-100 px-3.5 py-2 text-sm font-semibold text-muted">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            {service.availability === "custom-quote" ? "Custom Quote" : "Coming Soon"}
          </span>
        )}
      </div>
    </div>
  );
}

export default function OrderServiceCard({
  service,
  image,
}: OrderServiceCardProps) {
  const isActive = service.availability === "active" && service.route !== null;

  const cardShell =
    "group flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-white";

  if (isActive) {
    return (
      <Link
        href={service.route as string}
        className={`${cardShell} transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
      >
        <CardMedia service={service} image={image} />
        <CardBody service={service} />
      </Link>
    );
  }

  // Inactive: non-interactive, not focusable, status conveyed by text + icon.
  const statusWord =
    service.availability === "custom-quote" ? "Custom quote" : "Coming soon";
  return (
    <div
      className={`${cardShell} cursor-default opacity-95`}
      aria-disabled="true"
    >
      <CardMedia service={service} image={image} />
      <CardBody service={service} />
      <span className="sr-only">{service.title}: {statusWord}, not yet available to order.</span>
    </div>
  );
}
