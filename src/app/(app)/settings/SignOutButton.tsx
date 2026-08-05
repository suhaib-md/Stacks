"use client";

import { useState } from "react";

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    // A hard navigation is deliberate here, not laziness. router.push() would
    // leave the client router cache holding RSC payloads rendered while signed
    // in; a full load discards them along with the cleared cookie.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }

  return (
    <button
      onClick={signOut}
      disabled={pending}
      className="min-h-11 rounded-card border border-rule px-4 text-sm font-medium text-danger transition disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
