"use client";

import { useEffect } from "react";

/**
 * Registers the service worker. Renders nothing.
 *
 * Skipped in development: a stale cached shell during dev is a confusing bug
 * that looks like your edits aren't applying.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline support is an enhancement; failing to register must never
        // surface to the user.
      });
    };

    // Wait for load so registration never competes with the first paint.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
