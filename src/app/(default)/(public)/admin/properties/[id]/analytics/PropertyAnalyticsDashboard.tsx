import Link from "next/link";
import type { PropertyShowcaseAdminRecord } from "@/features/property-showcase/admin-types";
import {
  percentageOf,
  type PropertyAnalyticsSummary,
  type PropertyAnalyticsSummaryResult,
} from "@/features/property-showcase/property-analytics-dashboard";
import { getPrimaryLanguage, localizedText } from "@/features/property-showcase/localization";

type MetricCardProps = {
  label: string;
  value: number;
  detail?: string;
};

function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-primary">
        {value.toLocaleString("en-US")}
      </p>
      {detail ? <p className="mt-1 text-sm text-muted">{detail}</p> : null}
    </article>
  );
}

function percentageLabel(value: number | null, empty: string): string {
  return value === null ? empty : `${value.toFixed(1)}%`;
}

function DashboardContent({ analytics }: { analytics: PropertyAnalyticsSummary }) {
  const { eventCounts, enquiryCount } = analytics;
  const pageViews = eventCounts.property_page_viewed;
  const formOpens = eventCounts.request_viewing_opened;
  const formOpenRate = percentageOf(formOpens, pageViews);
  const enquiryFromFormsRate = percentageOf(enquiryCount, formOpens);
  const enquiryFromViewsRate = percentageOf(enquiryCount, pageViews);
  const noData = pageViews === 0 && formOpens === 0 && enquiryCount === 0;

  return (
    <>
      {noData ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-8 text-center text-sm text-muted shadow-sm">
          No analytics data yet.
        </div>
      ) : null}

      <section aria-label="Primary metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Page views" value={pageViews} />
        <MetricCard
          label="Viewing enquiries"
          value={enquiryCount}
          detail="Authoritative count from property leads"
        />
        <MetricCard label="Viewing form opens" value={formOpens} />
        <MetricCard label="WhatsApp clicks" value={eventCounts.agent_whatsapp_clicked} />
        <MetricCard label="Virtual tour opens" value={eventCounts.virtual_tour_opened} />
        <MetricCard label="Floor plan downloads" value={eventCounts.floor_plan_downloaded} />
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-secondary-dark">
            Conversion funnel
          </p>
          <h2 className="mt-2 text-xl font-bold text-primary">From views to enquiries</h2>
        </div>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          <li className="rounded-xl bg-surface p-4">
            <p className="text-sm font-bold text-primary">Page views</p>
            <p className="mt-1 text-2xl font-bold text-primary">{pageViews.toLocaleString("en-US")}</p>
          </li>
          <li className="rounded-xl bg-surface p-4">
            <p className="text-sm font-bold text-primary">Viewing form opened</p>
            <p className="mt-1 text-2xl font-bold text-primary">{formOpens.toLocaleString("en-US")}</p>
            <p className="mt-1 text-xs text-muted">
              {percentageLabel(formOpenRate, "No page views yet")}
              {formOpenRate === null ? "" : " of views"}
            </p>
          </li>
          <li className="rounded-xl bg-surface p-4">
            <p className="text-sm font-bold text-primary">Viewing enquiry submitted</p>
            <p className="mt-1 text-2xl font-bold text-primary">{enquiryCount.toLocaleString("en-US")}</p>
            <p className="mt-1 text-xs text-muted">
              {percentageLabel(enquiryFromFormsRate, "No form opens yet")}
              {enquiryFromFormsRate === null ? "" : " of form opens"}
              {enquiryFromViewsRate === null ? "" : ` · ${enquiryFromViewsRate.toFixed(1)}% of views`}
            </p>
          </li>
        </ol>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-secondary-dark">
          Engagement
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Gallery opens", eventCounts.gallery_opened],
            ["Shares", eventCounts.property_shared],
            ["WhatsApp clicks", eventCounts.agent_whatsapp_clicked],
            ["Phone clicks", eventCounts.agent_phone_clicked],
            ["Email clicks", eventCounts.agent_email_clicked],
            ["Video starts", eventCounts.video_started],
            ["Virtual tour opens", eventCounts.virtual_tour_opened],
            ["Interactive floor-plan opens", eventCounts.interactive_floor_plan_opened],
            ["Floor-plan downloads", eventCounts.floor_plan_downloaded],
            ["Brochure downloads", eventCounts.brochure_downloaded],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between gap-4 rounded-xl bg-surface px-4 py-3">
              <span className="text-sm font-semibold text-primary">{label as string}</span>
              <span className="text-sm font-bold text-primary">{(value as number).toLocaleString("en-US")}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-secondary-dark">
            Activity over time
          </p>
          <h2 className="mt-2 text-xl font-bold text-primary">Daily page views and enquiries</h2>
        </div>
        {analytics.activity.length === 0 ? (
          <p className="mt-5 text-sm text-muted">No activity to show for this period.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-xs font-bold uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th scope="col" className="px-3 py-3">UTC date</th>
                  <th scope="col" className="px-3 py-3 text-right">Page views</th>
                  <th scope="col" className="px-3 py-3 text-right">Enquiries</th>
                </tr>
              </thead>
              <tbody>
                {[...analytics.activity].reverse().map((day) => (
                  <tr key={day.date} className="border-b border-border/70 last:border-0">
                    <td className="px-3 py-3 font-semibold text-primary">{day.date}</td>
                    <td className="px-3 py-3 text-right text-foreground">{day.pageViews.toLocaleString("en-US")}</td>
                    <td className="px-3 py-3 text-right text-foreground">{day.enquiries.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function PropertyAnalyticsDashboard({
  record,
  analytics,
}: {
  record: PropertyShowcaseAdminRecord;
  analytics: PropertyAnalyticsSummaryResult;
}) {
  const primaryLanguage = getPrimaryLanguage(record.property);
  const title = localizedText(record.property.title, primaryLanguage, primaryLanguage);
  const selectedPeriod = analytics.state === "ready" ? analytics.range.key : "30d";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-secondary-dark">Analytics</p>
            <h2 className="mt-2 break-words text-2xl font-bold text-primary sm:text-3xl">{title}</h2>
            <p className="mt-2 text-sm text-muted">/property/{record.slug}</p>
          </div>
          <Link href="/admin/properties" className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-primary transition hover:border-primary/40">
            Back to properties
          </Link>
        </div>
        <nav aria-label="Analytics period" className="mt-5 flex flex-wrap gap-2">
          {[
            ["7d", "7 days"],
            ["30d", "30 days"],
            ["90d", "90 days"],
            ["all", "All time"],
          ].map(([key, label]) => {
            const selected = key === selectedPeriod;
            return (
              <Link
                key={key}
                href={`/admin/properties/${encodeURIComponent(record.id)}/analytics?period=${key}`}
                aria-current={selected ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${selected ? "bg-primary text-white" : "border border-border text-primary hover:border-primary/40"}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {analytics.state === "unconfigured" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">
          Property analytics is not configured yet.
        </div>
      ) : null}
      {analytics.state === "unavailable" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">
          Property analytics storage is not available yet.
        </div>
      ) : null}
      {analytics.state === "ready" ? <DashboardContent analytics={analytics} /> : null}
    </div>
  );
}
