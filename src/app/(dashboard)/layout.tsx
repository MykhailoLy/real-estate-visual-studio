// Route-group layout for the client dashboard.
// This intentionally does NOT include the public site Header or Footer —
// the dashboard has its own navigation via ClientDashboardLayout.
// The (dashboard) group segment is invisible in the URL.

export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
