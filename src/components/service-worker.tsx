"use client";

import { useEffect } from "react";

/** Registers public/sw.js once the page has loaded (needed to install the app and for notifications). */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Not fatal: the site still works without it.
      });
    }
  }, []);
  return null;
}
