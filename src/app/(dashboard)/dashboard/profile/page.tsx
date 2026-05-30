import { User, Building2, Mail, Phone, MapPin, CalendarDays } from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import { MOCK_CLIENT } from "@/lib/client-dashboard/mock-data";

export const metadata = {
  title: "Profile | PicchuSpot Client Portal",
};

export default function DashboardProfilePage() {
  return (
    <ClientDashboardLayout>
      {/* Page header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary-dark mb-1">
          Client Portal
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary leading-tight">
          Profile
        </h1>
        <p className="text-muted mt-1 text-sm">
          Your account details and preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar card */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-white">
                {MOCK_CLIENT.firstName.charAt(0)}
                {MOCK_CLIENT.lastName.charAt(0)}
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground">
              {MOCK_CLIENT.name}
            </h2>
            <p className="text-sm text-muted mt-0.5">{MOCK_CLIENT.company}</p>
            <p className="text-xs text-muted mt-3">
              Member since {MOCK_CLIENT.memberSince}
            </p>
            {/* Edit button — static placeholder */}
            <button
              type="button"
              disabled
              className="mt-5 w-full px-4 py-2 border border-border rounded-lg text-sm font-semibold text-muted cursor-not-allowed opacity-60"
              title="Profile editing coming soon"
            >
              Edit Photo
            </button>
          </div>
        </div>

        {/* Details form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Personal info */}
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <User className="w-4 h-4 text-primary" aria-hidden />
              <h3 className="font-bold text-foreground text-sm">
                Personal Information
              </h3>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <ProfileField
                label="First Name"
                value={MOCK_CLIENT.firstName}
              />
              <ProfileField
                label="Last Name"
                value={MOCK_CLIENT.lastName}
              />
              <ProfileField
                label="Email Address"
                value={MOCK_CLIENT.email}
                icon={<Mail className="w-4 h-4 text-muted" aria-hidden />}
              />
              <ProfileField
                label="Phone"
                value={MOCK_CLIENT.phone}
                icon={<Phone className="w-4 h-4 text-muted" aria-hidden />}
              />
            </div>
          </div>

          {/* Company info */}
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" aria-hidden />
              <h3 className="font-bold text-foreground text-sm">
                Company Details
              </h3>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <ProfileField
                label="Company Name"
                value={MOCK_CLIENT.company}
                icon={<Building2 className="w-4 h-4 text-muted" aria-hidden />}
                className="sm:col-span-2"
              />
              <ProfileField
                label="Address"
                value={MOCK_CLIENT.address}
                icon={<MapPin className="w-4 h-4 text-muted" aria-hidden />}
                className="sm:col-span-2"
              />
            </div>
          </div>

          {/* Account info */}
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" aria-hidden />
              <h3 className="font-bold text-foreground text-sm">
                Account
              </h3>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <ProfileField
                label="Member Since"
                value={MOCK_CLIENT.memberSince}
              />
              <ProfileField label="Account Type" value="Client" />
            </div>
          </div>

          {/* Save placeholder */}
          <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl">
            <p className="text-xs text-muted">
              Profile editing will be available once auth is connected.
            </p>
            <button
              type="button"
              disabled
              className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold opacity-40 cursor-not-allowed"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </ClientDashboardLayout>
  );
}

// ── Reusable profile field ─────────────────────────────────

interface ProfileFieldProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  className?: string;
}

function ProfileField({ label, value, icon, className }: ProfileFieldProps) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2 px-3 py-2.5 bg-surface border border-border rounded-lg">
        {icon}
        <span className="text-sm text-foreground">{value}</span>
      </div>
    </div>
  );
}
