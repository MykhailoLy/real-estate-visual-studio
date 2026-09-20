// Route-group layout for all public-facing marketing pages.
// Wraps content with the site Header and Footer.
// The (public) group segment is invisible in the URL.
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import FloatingSiteActions from "@/components/layout/FloatingSiteActions";
import { PublicAuthProvider } from "@/components/auth/PublicAuthContext";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicAuthProvider>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <FloatingSiteActions />
    </PublicAuthProvider>
  );
}
