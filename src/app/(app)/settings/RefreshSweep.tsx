"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Candidate = { id: string; title: string };

type State =
  | { kind: "idle" }
  | { kind: "working"; done: number; filled: number; current: string }
  | { kind: "finished"; done: number; filled: number };

/**
 * Refreshes incomplete books one request at a time.
 *
 * Sequential on purpose: each refresh hits two external APIs, and a Worker has
 * a wall-clock budget. One book per request keeps every call small and lets the
 * progress readout be honest rather than a spinner over a batch job.
 */
export function RefreshSweep({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  if (candidates.length === 0) {
    return (
      <p className="mt-1 text-sm text-ink-muted">
        Every book with an ISBN has its details. Nothing to refresh.
      </p>
    );
  }

  async function run() {
    let done = 0;
    let filled = 0;

    for (const book of candidates) {
      setState({ kind: "working", done, filled, current: book.title });

      const res = await fetch(`/api/books/${book.id}/refresh`, { method: "POST" }).catch(
        () => null,
      );
      const data = (await res?.json().catch(() => null)) as { filled?: string[] } | null;

      done += 1;
      if (res?.ok && data?.filled?.length) filled += 1;
    }

    setState({ kind: "finished", done, filled });
    router.refresh();
  }

  return (
    <>
      <p className="mt-1 max-w-prose text-sm text-ink-muted">
        {candidates.length} {candidates.length === 1 ? "book is" : "books are"} missing a
        description, page count, cover or publisher. Most were catalogued while a
        catalogue was unavailable. Only gaps get filled — your edits are never touched.
      </p>

      <button
        type="button"
        onClick={run}
        disabled={state.kind === "working"}
        className="mt-3 min-h-11 rounded-card bg-accent px-4 text-sm font-medium text-paper disabled:opacity-50"
      >
        {state.kind === "working"
          ? `Refreshing ${state.done + 1} of ${candidates.length}…`
          : `Refresh ${candidates.length} incomplete ${candidates.length === 1 ? "book" : "books"}`}
      </button>

      {state.kind === "working" ? (
        <p role="status" className="mt-2 truncate text-xs text-ink-faint">
          {state.current}
        </p>
      ) : null}

      {state.kind === "finished" ? (
        <p role="status" className="mt-2 text-sm text-ink-muted">
          Checked {state.done}; {state.filled === 0 ? "none had anything new" : `${state.filled} improved`}.
        </p>
      ) : null}
    </>
  );
}
