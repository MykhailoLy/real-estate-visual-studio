"use client";

import { useEffect } from "react";

const DASHBOARD_SCROLL_LOCK_CLASS = "dashboard-scroll-locked";

export default function DashboardDocumentScrollLock() {
  useEffect(() => {
    document.documentElement.classList.add(DASHBOARD_SCROLL_LOCK_CLASS);
    return () => {
      document.documentElement.classList.remove(DASHBOARD_SCROLL_LOCK_CLASS);
    };
  }, []);

  return null;
}
