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
    <form onSubmit={onSubmit} className="mt-8">
      <label htmlFor="passphrase" className="lbl block text-accent">
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
        className="mt-2 min-h-12 w-full border border-rule-control bg-surface-sunk px-3 text-base tracking-[.2em] outline-none"
      />

      <button
        type="submit"
        disabled={pending || passphrase.length === 0}
        className="mt-4 flex min-h-12 w-full items-center justify-between bg-accent px-4 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-pressed disabled:opacity-45"
      >
        <span>{pending ? "Checking…" : "Unlock"}</span>
        <span aria-hidden="true">&rarr;</span>
      </button>

      {/* States what happened, then the way out — never a lone red toast. */}
      {error ? (
        <div
          id="passphrase-error"
          role="alert"
          className="mt-4 border-l-2 border-accent bg-surface-sunk px-3 py-2.5"
        >
          <p className="text-[13px] font-medium">{error}</p>
          <p className="mt-1 text-[12px] text-ink-muted">
            Check the phrase and try again. Repeated failures lock the gate for fifteen
            minutes.
          </p>
        </div>
      ) : null}
    </form>
  );
}
