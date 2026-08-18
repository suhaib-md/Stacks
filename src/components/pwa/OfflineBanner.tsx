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
      className="mb-4 border-l-2 border-accent bg-surface-sunk px-3 py-2.5"
    >
      {/* States what happened, then what still works — flush left, never centred. */}
      <p className="text-[13px] font-medium">Offline</p>
      <p className="mt-0.5 text-[12px] text-ink-muted">
        Showing your last synced library. Adding books needs a connection.
      </p>
    </div>
  );
}
