import {
  Briefcase,
  FolderOpen,
  LayoutDashboard,
  LifeBuoy,
  PlusCircle,
  Receipt,
  type LucideIcon,
} from "lucide-react";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/dashboard/orders/new", label: "New Order", icon: PlusCircle },
  { href: "/dashboard/files", label: "Files", icon: FolderOpen },
  { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
];
