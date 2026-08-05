"use client";

import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passphrase, next }),
      });
      const data = (await res.json()) as
        | { ok: true; next: string }
        | { error: { code: string; message: string } };

      if (!res.ok || !("ok" in data)) {
        setError("error" in data ? data.error.message : "Something went wrong.");
        setPassphrase("");
        return;
      }

      // Full navigation, not router.push — middleware must re-read the new cookie.
      window.location.assign(data.next);
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="passphrase" className="mb-2 block text-sm font-medium">
          Passphrase
        </label>
        <input
          id="passphrase"
          name="passphrase"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "passphrase-error" : undefined}
          className="w-full rounded-card bg-surface-sunk px-4 py-3 text-base outline-none ring-accent transition focus:ring-2"
        />
      </div>

      {error ? (
        <p id="passphrase-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || passphrase.length === 0}
        className="min-h-11 w-full rounded-card bg-accent px-4 py-3 font-medium text-paper transition disabled:opacity-50"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
