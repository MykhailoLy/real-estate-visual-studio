import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import CookieConsentBanner from "@/components/privacy/CookieConsentBanner";
import "./globals.css";

// NOTE: Header and Footer are rendered by the (public) route-group layout.
// The (dashboard) route-group layout renders its own portal shell instead.
// This root layout provides only the HTML/body wrapper.

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://picchuspot.com";

const SITE_NAME = "PicchuSpot";
const SITE_DESCRIPTOR = "Real Estate Visuals";
const SITE_TAGLINE = "Property visuals that make listings stand out.";
const DEFAULT_TITLE = `${SITE_NAME} — ${SITE_DESCRIPTOR}`;
const DEFAULT_DESCRIPTION =
  "PicchuSpot — Real Estate Visuals. Property visuals that make listings stand out. Virtual staging, virtual renovation, 3D floor plans, and photo editing delivered in 24-48 hours. Local photography in Alicante & Costa Blanca.";

export const viewport: Viewport = {
  themeColor: "#0B1F3A",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: SITE_TAGLINE,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: SITE_TAGLINE,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen w-full overflow-x-hidden`}
      >
        {children}
        <GoogleAnalytics />
        <CookieConsentBanner />
      </body>
    </html>
  );
}
