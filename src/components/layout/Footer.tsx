import Link from "next/link";

const footerLinks = {
  services: [
    { href: "/services#virtual-staging", label: "Virtual Staging" },
    { href: "/services#virtual-renovation", label: "Virtual Renovation" },
    { href: "/services#floor-plans", label: "3D Floor Plans" },
    { href: "/services#photo-editing", label: "Photo Editing" },
    { href: "/services#photography", label: "Photography" },
  ],
  pages: [
    { href: "/portfolio", label: "Portfolio" },
    { href: "/pricing", label: "Pricing" },
    { href: "/order", label: "Order Online" },
    { href: "/about", label: "About Us" },
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Contact" },
  ],
  legal: [
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms & Conditions" },
  ],
};

const serviceAreaCities = [
  "Alicante",
  "Benidorm",
  "Torrevieja",
  "Javea",
  "Denia",
  "Calpe",
  "Orihuela Costa",
  "Elche",
  "Santa Pola",
  "Villajoyosa",
];

export default function Footer() {
  return (
    <footer className="bg-primary text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-bold mb-4">RE Visual Studio</h3>
            <p className="text-sm text-white/70 mb-4">
              Real estate visual marketing. Remote digital services worldwide.
              Local photography in Alicante &amp; Costa Blanca.
            </p>
            {/* TODO: Add social media links */}
          </div>

          {/* Services */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4">
              Services
            </h4>
            <ul className="space-y-2">
              {footerLinks.services.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Pages */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4">
              Pages
            </h4>
            <ul className="space-y-2">
              {footerLinks.pages.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Service Area */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4">
              Service Area
            </h4>
            <p className="text-sm text-white/70">
              {serviceAreaCities.join(" · ")}
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-white/20 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-white/60">
            &copy; {new Date().getFullYear()} RE Visual Studio. All rights reserved.
          </p>
          <div className="flex gap-4">
            {footerLinks.legal.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
