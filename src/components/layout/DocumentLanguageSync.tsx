"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getDocumentLanguage } from "@/lib/document-language";

export default function DocumentLanguageSync() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.lang = getDocumentLanguage(pathname);
  }, [pathname]);

  return null;
}
