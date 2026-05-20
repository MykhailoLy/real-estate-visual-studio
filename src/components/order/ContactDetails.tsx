"use client";

import Link from "next/link";

export interface ContactData {
  name: string;
  email: string;
  phone: string;
  company: string;
  agreeTerms: boolean;
}

export const emptyContactData: ContactData = {
  name: "",
  email: "",
  phone: "",
  company: "",
  agreeTerms: false,
};

interface ContactDetailsProps {
  data: ContactData;
  onChange: (data: ContactData) => void;
}

export default function ContactDetails({ data, onChange }: ContactDetailsProps) {
  const update = (field: keyof ContactData, value: string | boolean) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="bg-white border border-border rounded-xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-foreground mb-1">
        Your Details
      </h2>
      <p className="text-sm text-muted mb-4">
        We&apos;ll use this to confirm your order.
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Your full name"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={data.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={data.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+1 555 000 0000"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Company
            </label>
            <input
              type="text"
              value={data.company}
              onChange={(e) => update("company", e.target.value)}
              placeholder="Company name (optional)"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.agreeTerms}
            onChange={(e) => update("agreeTerms", e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded text-primary border-border focus:ring-primary"
          />
          <span className="text-sm text-foreground">
            I agree to the{" "}
            <Link
              href="/terms"
              className="text-primary underline hover:text-primary-light"
              target="_blank"
            >
              Terms &amp; Conditions
            </Link>
          </span>
        </label>
      </div>
    </div>
  );
}
