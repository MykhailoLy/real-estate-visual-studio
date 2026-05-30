import Link from "next/link";
import {
  MessageCircle,
  Mail,
  FileQuestion,
  Clock,
  ExternalLink,
  ArrowRight,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";

export const metadata = {
  title: "Support | PicchuSpot Client Portal",
};

export default function DashboardSupportPage() {
  return (
    <ClientDashboardLayout>
      {/* Page header */}
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
          Client Portal
        </p>
        <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
          Support
        </h1>
        <p className="text-muted mt-1 text-sm">
          We typically respond within a few hours during business hours (Mon–Fri, 9am–6pm CET).
        </p>
      </div>

      {/* Primary contact cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

        {/* Contact form */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col">
          <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center mb-4">
            <MessageCircle className="w-5 h-5 text-primary" aria-hidden />
          </div>
          <h2 className="text-[15px] font-bold text-foreground mb-2">Send a Message</h2>
          <p className="text-sm text-muted leading-relaxed flex-1">
            Have a question about your order, need a revision, or want to check delivery status?
            Use our contact form and we&rsquo;ll get back to you promptly.
          </p>
          <Link
            href="/contact"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-light transition-colors"
          >
            Open Contact Form
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>

        {/* Direct email */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col">
          <div className="w-11 h-11 rounded-xl bg-secondary/10 flex items-center justify-center mb-4">
            <Mail className="w-5 h-5 text-secondary-dark" aria-hidden />
          </div>
          <h2 className="text-[15px] font-bold text-foreground mb-2">Email Us Directly</h2>
          <p className="text-sm text-muted leading-relaxed flex-1">
            Prefer email? Reach us at <strong>hello@picchuspot.com</strong>. Always include
            your job reference number (e.g. <span className="font-mono text-[12px]">VS-2025-0041</span>) for fastest service.
          </p>
          <a
            href="mailto:hello@picchuspot.com"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg text-sm font-bold text-foreground hover:border-primary hover:text-primary transition-colors"
          >
            hello@picchuspot.com
            <ExternalLink className="w-3.5 h-3.5" aria-hidden />
          </a>
        </div>

        {/* FAQ */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
            <FileQuestion className="w-5 h-5 text-emerald-700" aria-hidden />
          </div>
          <h2 className="text-[15px] font-bold text-foreground mb-2">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-muted leading-relaxed flex-1">
            Browse answers to common questions about services, turnaround times, file
            formats, revision policies, and delivery.
          </p>
          <Link
            href="/faq"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg text-sm font-bold text-foreground hover:border-primary hover:text-primary transition-colors"
          >
            Browse FAQ
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>

        {/* Response times */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm flex flex-col">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
            <Clock className="w-5 h-5 text-blue-600" aria-hidden />
          </div>
          <h2 className="text-[15px] font-bold text-foreground mb-3">Response Times</h2>
          <ul className="space-y-3 flex-1">
            {[
              { label: "Email & message replies", value: "4–8 hours" },
              { label: "Order delivery", value: "24–48 hours" },
              { label: "Revision turnaround", value: "12–24 hours" },
              { label: "Business hours", value: "Mon–Fri, 9am–6pm CET" },
            ].map((item) => (
              <li key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-muted">{item.label}</span>
                <span className="text-[12px] font-bold text-foreground text-right ml-3">{item.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tips block */}
      <div className="bg-primary/5 border border-primary/12 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-4 h-4 text-primary" aria-hidden />
          <h3 className="text-[13px] font-bold text-primary">Tips for faster support</h3>
        </div>
        <ul className="space-y-3">
          {[
            "Always include your job reference number (e.g. VS-2025-0041) — this lets us pull up your order instantly.",
            "For revision requests, be specific: describe which areas to change, or attach a reference image.",
            "For file delivery issues, mention the file name, format needed, and whether you received the delivery email.",
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-primary/50 flex-shrink-0 mt-0.5" aria-hidden />
              <span className="text-sm text-foreground/75 leading-relaxed">{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </ClientDashboardLayout>
  );
}
