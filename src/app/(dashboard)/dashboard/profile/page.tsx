import { User, Building2, Mail, Phone, MapPin, CalendarDays, ShieldCheck } from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import { MOCK_CLIENT } from "@/lib/client-dashboard/mock-data";

export const metadata = {
  title: "Profile | PicchuSpot Client Portal",
};

export default function DashboardProfilePage() {
  return (
    <ClientDashboardLayout>
      {/* Page header */}
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
          Client Portal
        </p>
        <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
          Profile
        </h1>
        <p className="text-muted mt-1 text-sm">
          Your account details. Profile editing will be available once auth is connected.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Avatar / identity card ── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center mb-4 shadow-md">
              <span className="text-2xl font-bold text-white select-none">
                {MOCK_CLIENT.firstName.charAt(0)}{MOCK_CLIENT.lastName.charAt(0)}
              </span>
            </div>
            <h2 className="text-[15px] font-bold text-foreground leading-tight">
              {MOCK_CLIENT.name}
            </h2>
            <p className="text-sm text-muted mt-1">{MOCK_CLIENT.company}</p>

            {/* Meta badges */}
            <div className="flex flex-col items-center gap-1.5 mt-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/60 rounded-full text-[11px] font-semibold text-emerald-700">
                <ShieldCheck className="w-3 h-3" aria-hidden />
                Verified client
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200/60 rounded-full text-[11px] font-semibold text-amber-700">
                Demo mode · not yet authenticated
              </span>
            </div>

            <div className="w-full border-t border-border mt-4 pt-4">
              <p className="text-[11px] text-muted">
                Member since {MOCK_CLIENT.memberSince}
              </p>
            </div>

            {/* Edit photo placeholder */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="mt-4 w-full px-4 py-2 border border-border rounded-lg text-[12px] font-semibold text-muted-light cursor-not-allowed select-none"
              title="Photo editing coming soon"
            >
              Change Photo
            </button>
          </div>

          {/* Account type card */}
          <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-primary" aria-hidden />
              <h3 className="text-[13px] font-bold text-foreground">Account</h3>
            </div>
            <dl className="space-y-2">
              <div className="flex justify-between items-center">
                <dt className="text-[11px] text-muted">Type</dt>
                <dd className="text-[12px] font-semibold text-foreground">Client</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-[11px] text-muted">Member since</dt>
                <dd className="text-[12px] font-semibold text-foreground">{MOCK_CLIENT.memberSince}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-[11px] text-muted">Status</dt>
                <dd className="text-[12px] font-semibold text-emerald-600">Active</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* ── Detail panels ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Personal info */}
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
              <User className="w-4 h-4 text-primary" aria-hidden />
              <h3 className="text-[13px] font-bold text-foreground">Personal Information</h3>
            </div>
            <div className="px-5 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProfileField label="First Name" value={MOCK_CLIENT.firstName} />
              <ProfileField label="Last Name" value={MOCK_CLIENT.lastName} />
              <ProfileField
                label="Email Address"
                value={MOCK_CLIENT.email}
                icon={<Mail className="w-3.5 h-3.5 text-muted-light" aria-hidden />}
              />
              <ProfileField
                label="Phone"
                value={MOCK_CLIENT.phone}
                icon={<Phone className="w-3.5 h-3.5 text-muted-light" aria-hidden />}
              />
            </div>
          </div>

          {/* Company info */}
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" aria-hidden />
              <h3 className="text-[13px] font-bold text-foreground">Company Details</h3>
            </div>
            <div className="px-5 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProfileField
                label="Company Name"
                value={MOCK_CLIENT.company}
                icon={<Building2 className="w-3.5 h-3.5 text-muted-light" aria-hidden />}
                className="sm:col-span-2"
              />
              <ProfileField
                label="Address"
                value={MOCK_CLIENT.address}
                icon={<MapPin className="w-3.5 h-3.5 text-muted-light" aria-hidden />}
                className="sm:col-span-2"
              />
            </div>
          </div>

          {/* Notification preferences — placeholder */}
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" aria-hidden />
              <h3 className="text-[13px] font-bold text-foreground">Notifications</h3>
            </div>
            <div className="px-5 py-5">
              <div className="space-y-3">
                {[
                  "Order status updates",
                  "File delivery notifications",
                  "Revision requests",
                  "Invoice & payment receipts",
                ].map((pref) => (
                  <div key={pref} className="flex items-center justify-between">
                    <span className="text-sm text-foreground/75">{pref}</span>
                    {/* Toggle placeholder */}
                    <div
                      className="w-9 h-5 bg-primary/20 rounded-full relative cursor-not-allowed select-none opacity-60"
                      aria-hidden
                    >
                      <span className="absolute right-0.5 top-0.5 w-4 h-4 bg-primary rounded-full shadow-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Save row */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 bg-surface border border-border rounded-xl">
            <p className="text-xs text-muted leading-relaxed">
              Profile editing and notification preferences will be enabled once authentication is connected.
            </p>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="flex-shrink-0 px-5 py-2 bg-primary text-white rounded-lg text-sm font-bold opacity-35 cursor-not-allowed"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </ClientDashboardLayout>
  );
}

interface ProfileFieldProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  className?: string;
}

function ProfileField({ label, value, icon, className }: ProfileFieldProps) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-bold uppercase tracking-[0.13em] text-muted-light mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2 px-3 py-2.5 bg-surface border border-border rounded-lg">
        {icon}
        <span className="text-[13px] text-foreground">{value}</span>
      </div>
    </div>
  );
}
