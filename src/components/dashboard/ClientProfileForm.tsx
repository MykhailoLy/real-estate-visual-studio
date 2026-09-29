"use client";

// ============================================================
// ClientProfileForm
//
// Handles both:
//   - Onboarding mode  (?onboarding=1): "Complete your profile" heading,
//     save-and-continue action plus a non-blocking way back to the dashboard.
//   - Edit mode (default): "Profile" heading, stays on page, shows success msg.
//
// Uses the browser Supabase client to POST to the /api/profile/upsert
// route handler, which calls upsertClientProfile() server-side so the
// service role key / user_id are never exposed to the client.
// ============================================================

import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
  Building2,
  Phone,
  MapPin,
  Briefcase,
  Megaphone,
} from "lucide-react";
import type { ClientProfile } from "@/lib/client-profile";

// ── Country list (abbreviated) ───────────────────────────────

const COUNTRIES = [
  "Australia", "Austria", "Belgium", "Brazil", "Canada", "China",
  "Denmark", "Finland", "France", "Germany", "Greece", "Hong Kong",
  "India", "Ireland", "Israel", "Italy", "Japan", "Luxembourg",
  "Malaysia", "Mexico", "Netherlands", "New Zealand", "Norway",
  "Poland", "Portugal", "Singapore", "South Africa", "South Korea",
  "Spain", "Sweden", "Switzerland", "United Arab Emirates",
  "United Kingdom", "United States", "Other",
];

const INDUSTRIES = [
  "Real Estate Agency",
  "Property Development",
  "Architecture / Interior Design",
  "Property Management",
  "Real Estate Photography",
  "Hospitality / Short-term Rentals",
  "Construction",
  "Other",
];

const HOW_FOUND_OPTIONS = [
  "Google / Search engine",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Referral from colleague",
  "Referral from client",
  "Online advertisement",
  "Real estate conference / event",
  "Other",
];

// ── Props ─────────────────────────────────────────────────────

interface ClientProfileFormProps {
  /** Pre-populated from existing client_profiles row, or null for new users */
  initialProfile: ClientProfile | null;
  /** Pre-populated from auth user metadata (full_name at signup) */
  authFullName: string | null;
  authEmail: string;
  isOnboarding: boolean;
  /**
   * Where to send the client after a successful onboarding save (e.g.
   * back to the selected order form). Already sanitized server-side.
   * Falls back to /dashboard when null.
   */
  nextPath?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────

function splitFullName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

// ── Component ─────────────────────────────────────────────────

export default function ClientProfileForm({
  initialProfile,
  authFullName,
  authEmail,
  isOnboarding,
  nextPath = null,
}: ClientProfileFormProps) {
  const router = useRouter();

  // Pre-fill from profile row first, then fall back to auth metadata
  const authSplit = authFullName ? splitFullName(authFullName) : null;

  const [firstName,   setFirstName]   = useState(initialProfile?.first_name   ?? authSplit?.first  ?? "");
  const [lastName,    setLastName]    = useState(initialProfile?.last_name    ?? authSplit?.last   ?? "");
  const [companyName, setCompanyName] = useState(initialProfile?.company_name ?? "");
  const [phone,       setPhone]       = useState(initialProfile?.phone        ?? "");
  const [country,     setCountry]     = useState(initialProfile?.country      ?? "");
  const [industry,    setIndustry]    = useState(initialProfile?.industry     ?? "");
  const [howFoundUs,  setHowFoundUs]  = useState(initialProfile?.how_found_us ?? "");

  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setErrorMsg(null);
    setSuccess(false);
    setLoading(true);

    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");

      const res = await fetch("/api/profile/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name:   firstName.trim()   || null,
          last_name:    lastName.trim()    || null,
          full_name:    fullName           || null,
          company_name: companyName.trim() || null,
          phone:        phone.trim()       || null,
          country:      country            || null,
          industry:     industry           || null,
          how_found_us: howFoundUs         || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg((body as { error?: string }).error ?? "Failed to save profile. Please try again.");
        return;
      }

      if (isOnboarding) {
        // Hard navigate so the server layout re-fetches the profile.
        // Return to the intended destination (e.g. the selected order
        // form) when provided, otherwise the dashboard.
        window.location.href = nextPath ?? "/dashboard";
        return;
      }

      setSuccess(true);
      // Refresh server components (layout re-reads profile for nav name)
      router.refresh();
    } catch {
      setErrorMsg("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border border-border bg-white text-foreground text-dashboard-mobile-control placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-colors md:text-sm";

  const selectClass =
    "w-full px-3 py-2.5 rounded-lg border border-border bg-white text-foreground text-dashboard-mobile-control focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-colors md:text-sm";

  const labelClass =
    "block text-dashboard-action font-bold uppercase tracking-[0.06em] text-muted-light mb-1.5";

  return (
    <form onSubmit={handleSubmit} noValidate>

      {/* ── Onboarding banner ── */}
      {isOnboarding && (
        <div className="mb-6 p-4 bg-primary/5 border border-primary/15 rounded-xl">
          <p className="text-dashboard-body text-foreground/80">
            Your profile is optional while you browse the client portal. To place
            an order, we only require your name and phone number. The remaining
            details can be added later.
          </p>
        </div>
      )}

      {/* ── Personal information ── */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
          <User className="w-4 h-4 text-primary" aria-hidden />
          <h3 className="text-dashboard-section font-bold text-foreground lg:text-lg">Personal Information</h3>
        </div>
        <div className="px-5 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* First name */}
          <div>
            <label htmlFor="profile-first-name" className={labelClass}>First name</label>
            <input
              id="profile-first-name"
              type="text"
              autoComplete="given-name"
              disabled={loading}
              placeholder="Jane"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Last name */}
          <div>
            <label htmlFor="profile-last-name" className={labelClass}>Last name</label>
            <input
              id="profile-last-name"
              type="text"
              autoComplete="family-name"
              disabled={loading}
              placeholder="Smith"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Email — read-only */}
          <div className="sm:col-span-2">
            <label htmlFor="profile-email" className={labelClass}>Email address</label>
            <input
              id="profile-email"
              type="email"
              readOnly
              disabled
              value={authEmail}
              className={`${inputClass} bg-surface cursor-default`}
              title="Email address cannot be changed here"
            />
            <p className="mt-1 text-dashboard-metadata text-muted-light">
              To change your email address, contact support.
            </p>
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="profile-phone" className={labelClass}>
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3" aria-hidden /> Phone
              </span>
            </label>
            <input
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              disabled={loading}
              placeholder="+34 600 000 000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Country */}
          <div>
            <label htmlFor="profile-country" className={labelClass}>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" aria-hidden /> Country
              </span>
            </label>
            <select
              id="profile-country"
              disabled={loading}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={selectClass}
            >
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Company information ── */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" aria-hidden />
          <h3 className="text-dashboard-section font-bold text-foreground lg:text-lg">Company Details</h3>
        </div>
        <div className="px-5 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Company name */}
          <div className="sm:col-span-2">
            <label htmlFor="profile-company" className={labelClass}>
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3 h-3" aria-hidden /> Company name
              </span>
            </label>
            <input
              id="profile-company"
              type="text"
              autoComplete="organization"
              disabled={loading}
              placeholder="Acme Real Estate Agency"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Industry */}
          <div className="sm:col-span-2">
            <label htmlFor="profile-industry" className={labelClass}>
              <span className="inline-flex items-center gap-1">
                <Briefcase className="w-3 h-3" aria-hidden /> Industry
              </span>
            </label>
            <select
              id="profile-industry"
              disabled={loading}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className={selectClass}
            >
              <option value="">Select industry…</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── How did you find us ── */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden mb-5">
        <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" aria-hidden />
          <h3 className="text-dashboard-section font-bold text-foreground lg:text-lg">How did you find us?</h3>
          <span className="ml-auto text-dashboard-metadata text-muted-light font-medium">Optional</span>
        </div>
        <div className="px-5 py-5">
          <select
            id="profile-how-found"
            disabled={loading}
            value={howFoundUs}
            onChange={(e) => setHowFoundUs(e.target.value)}
            className={selectClass}
          >
            <option value="">Select an option…</option>
            {HOW_FOUND_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Feedback messages ── */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-dashboard-body px-3.5 py-3 mb-4"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          {errorMsg}
        </div>
      )}
      {success && !isOnboarding && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-dashboard-body px-3.5 py-3 mb-4"
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden />
          Profile saved successfully.
        </div>
      )}

      {/* ── Save / skip actions ── */}
      <div className="flex flex-col-reverse items-stretch justify-end gap-3 rounded-xl border border-border bg-surface px-5 py-4 sm:flex-row sm:items-center">
        {isOnboarding && (
          <ClientPortalLink
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center px-4 py-2.5 text-dashboard-action font-bold text-primary transition-colors hover:text-primary-light"
          >
            {nextPath ? "Back to dashboard" : "Skip for now"}
          </ClientPortalLink>
        )}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-dashboard-action font-bold text-white shadow-sm transition-colors hover:bg-primary-light disabled:opacity-60"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" aria-hidden />Saving…</>
          ) : isOnboarding ? (
            nextPath ? "Save and continue to order" : "Save and continue to dashboard"
          ) : (
            "Save changes"
          )}
        </button>
      </div>

    </form>
  );
}
