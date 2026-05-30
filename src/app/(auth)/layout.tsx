// Route-group layout for client auth pages: /login, /signup, /forgot-password.
// Intentionally bare — no public Header/Footer, no dashboard chrome.
// Provides only the full-height centred shell used by all auth pages.
// The (auth) group segment is invisible in the URL.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {children}
    </div>
  );
}
