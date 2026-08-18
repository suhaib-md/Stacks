"use client";

import { useState } from "react";
import { MIN_PASSPHRASE_LENGTH } from "@/lib/passphrase";

const inputClass =
"w-full border border-rule-control bg-surface-sunk px-3 py-2 text-sm outline-none";

export function ChangePassphrase() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // Checked here as well as server-side so a typo costs nothing.
    if (next !== confirm) {
      setError("The two new passphrases don't match.");
      return;
    }
    if (next.length < MIN_PASSPHRASE_LENGTH) {
      setError(`Use at least ${MIN_PASSPHRASE_LENGTH} characters.`);
      return;
    }

    setPending(true);
    const res = await fetch("/api/auth/passphrase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current, next }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | { ok: true }
      | { error: { message: string } }
      | null;
    setPending(false);

    if (!res?.ok || !data || !("ok" in data)) {
      setError(data && "error" in data ? data.error.message : "Couldn't change it.");
      return;
    }

    setCurrent("");
    setNext("");
    setConfirm("");
    setDone(true);
    setOpen(false);
  }

  if (!open) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
          className="mt-2 min-h-11 border border-rule-control px-4 text-sm font-medium"
        >
          Change passphrase
        </button>
        {done ? (
          <p role="status" className="mt-2 text-sm text-success">
            Changed. Use the new one next time you sign in.
          </p>
        ) : null}
      </>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 max-w-sm space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">Current passphrase</span>
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">
          New passphrase <span className="text-ink-faint">({MIN_PASSPHRASE_LENGTH}+ characters)</span>
        </span>
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">Confirm new passphrase</span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className={inputClass}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-ink-faint">
        Devices already signed in stay signed in. To end those too, rotate
        SESSION_SECRET and redeploy.
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 border border-rule-control px-4 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 flex-1 bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-50"
        >
          {pending ? "Changing…" : "Change passphrase"}
        </button>
      </div>
    </form>
  );
}
