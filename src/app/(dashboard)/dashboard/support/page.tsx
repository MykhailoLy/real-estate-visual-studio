import Link from "next/link";
import {
  MessageCircle,
  Mail,
  FileQuestion,
  Clock,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";

export const metadata = {
  title: "Support | PicchuSpot Client Portal",
};

export default function DashboardSupportPage() {
  return (
    <ClientDashboardLayout>
      {/* Page header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary-dark mb-1">
          Client Portal
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary leading-tight">
          Support
        </h1>
        <p className="text-muted mt-1 text-sm">
          Need help? We&rsquo;re here for you.
        </p>
      </div>

      {/* Support cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {/* Contact us */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <div className="w-11 h-11 rounded-lg bg-primary/8 flex items-center justify-center mb-4">
            <MessageCircle className="w-5 h-5 text-primary" aria-hidden />
          </div>
          <h2 className="font-bold text-foreground mb-2">Contact Us</h2>
          <p className="text-sm text-muted leading-relaxed flex-1">
            Send us a message about your order, revision request, or any
            question. We typically respond within a few hours during business
            hours.
          </p>
          <Link
            href="/contact"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-light transition-colors"
          >
            Get in Touch
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>

        {/* Email support */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <div className="w-11 h-11 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
            <Mail className="w-5 h-5 text-secondary-dark" aria-hidden />
          </div>
          <h2 className="font-bold text-foreground mb-2">Email Support</h2>
          <p className="text-sm text-muted leading-relaxed flex-1">
            Prefer email? Reach out directly. Include your job reference number
            for faster service.
          </p>
          <a
            href="mailto:hello@picchuspot.com"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
          >
            hello@picchuspot.com
            <ExternalLink className="w-3.5 h-3.5" aria-hidden />
          </a>
        </div>

        {/* FAQ */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <div className="w-11 h-11 rounded-lg bg-emerald-50 flex items-center justify-center mb-4">
            <FileQuestion className="w-5 h-5 text-emerald-700" aria-hidden />
          </div>
          <h2 className="font-bold text-foreground mb-2">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-muted leading-relaxed flex-1">
            Find answers to common questions about our services, turnaround
            times, file formats, revision policies, and more.
          </p>
          <Link
            href="/faq"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
          >
            Browse FAQ
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>

        {/* Response times */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm flex flex-col">
          <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
            <Clock className="w-5 h-5 text-blue-600" aria-hidden />
          </div>
          <h2 className="font-bold text-foreground mb-2">Response Times</h2>
          <p className="text-sm text-muted leading-relaxed flex-1 mb-4">
            We work to keep you updated every step of the way.
          </p>
          <ul className="space-y-2.5">
            {[
              { label: "Email replies", value: "Within 4–8 hours" },
              { label: "Order delivery", value: "24–48 hours" },
              { label: "Revision turnaround", value: "12–24 hours" },
              { label: "Business hours", value: "Mon–Fri, 9am–6pm CET" },
            ].map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted">{item.label}</span>
                <span className="font-semibold text-foreground">
                  {item.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tips block */}
      <div className="bg-primary/4 border border-primary/15 rounded-xl p-6">
        <h3 className="font-bold text-primary mb-3 text-sm">
          Tips for faster support
        </h3>
        <ul className="space-y-2">
          {[
            "Include your job reference number (e.g. VS-2025-0041) in every message.",
            "For revision requests, describe changes clearly or include a reference image.",
            "For file issues, specify the file name and format.",
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground/75">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </ClientDashboardLayout>
  );
}
