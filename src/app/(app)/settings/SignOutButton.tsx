"use client";

import { useState } from "react";

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    // Full navigation so middleware re-evaluates without the cookie.
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
