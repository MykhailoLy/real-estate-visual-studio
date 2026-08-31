import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import { getOrderServiceCards } from "@/lib/order-services";

export default function NewOrderLoading() {
  const services = getOrderServiceCards();

  return (
    <ClientDashboardLayout>
      <div className="animate-pulse" aria-label="Loading New Order catalog">
        <div className="mb-8 max-w-3xl">
          <div className="h-3 w-24 rounded bg-secondary/20" />
          <div className="mt-3 h-8 w-64 max-w-full rounded bg-primary/15" />
          <div className="mt-3 h-4 w-full max-w-2xl rounded bg-stone-200" />
        </div>

        <ul
          role="list"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        >
          {services.map((service) => (
            <li
              key={service.slug}
              className="overflow-hidden rounded-xl border border-border bg-white"
            >
              <div className="aspect-[16/10] bg-stone-200" />
              <div className="space-y-3 p-5">
                <div className="h-5 w-2/3 rounded bg-primary/15" />
                <div className="h-4 w-full rounded bg-stone-200" />
                <div className="h-4 w-5/6 rounded bg-stone-200" />
                <div className="flex items-end justify-between gap-4 pt-3">
                  <div className="h-4 w-1/2 rounded bg-primary/10" />
                  <div className="h-9 w-28 rounded-lg bg-primary/20" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </ClientDashboardLayout>
  );
}
