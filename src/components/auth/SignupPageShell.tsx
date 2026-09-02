import { PublicAuthProvider } from "@/components/auth/PublicAuthContext";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

export default function SignupPageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicAuthProvider>
      <Header />
      <main className="px-4 py-8 sm:py-10 lg:py-16">
        <section className="mx-auto w-full max-w-md">{children}</section>
      </main>
      <Footer />
    </PublicAuthProvider>
  );
}
