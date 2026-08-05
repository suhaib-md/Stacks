"use client";

import { useSyncExternalStore } from "react";

/**
 * `navigator.onLine` is external mutable state, so it is read through
 * useSyncExternalStore rather than mirrored into useState from an effect.
 *
 * The server snapshot is "online": rendering an offline warning during SSR
 * would flash on every first load.
 */
function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const getSnapshot = () => navigator.onLine;
const getServerSnapshot = () => true;

export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (online) return null;

  return (
    <div
      role="status"
      className="sticky top-14 z-20 -mx-4 border-b border-rule bg-accent-soft px-4 py-2 text-center text-xs text-accent"
    >
      Offline — showing your last synced library. Adding books needs a connection.
    </div>
  );
}
