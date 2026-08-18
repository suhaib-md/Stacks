"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const FIELD_LABEL: Record<string, string> = {
  subtitle: "subtitle",
  publisher: "publisher",
  publishedYear: "year",
  pageCount: "page count",
  description: "description",
  coverUrl: "cover",
  language: "language",
  genre: "genre",
};

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; filled: string[] }
  | { kind: "error"; message: string };

/**
 * Offered only for books that are actually missing something — a refresh button
 * on a complete record is noise.
 */
export function RefreshMetadata({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function refresh() {
    setState({ kind: "working" });

    const res = await fetch(`/api/books/${bookId}/refresh`, { method: "POST" }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | { filled: string[] }
      | { error: { message: string } }
      | null;

    if (!res?.ok || !data || !("filled" in data)) {
      setState({
        kind: "error",
        message: data && "error" in data ? data.error.message : "Couldn't reach the catalogues.",
      });
      return;
    }

    setState({ kind: "done", filled: data.filled });
    if (data.filled.length > 0) router.refresh();
  }

  return (
    <div className="mt-6 border-2 border-rule p-4">
      <h2 className="lbl text-accent">Incomplete record</h2>
      <p className="mt-1 max-w-prose text-sm text-ink-muted">
        Some details are missing — often because a catalogue was unavailable when this
        book was added. Refreshing fills only the gaps and never changes anything you
        have edited.
      </p>

      <button
        type="button"
        onClick={refresh}
        disabled={state.kind === "working"}
        className="mt-3 min-h-11 bg-surface px-4 text-sm font-medium disabled:opacity-50"
      >
        {state.kind === "working" ? "Checking…" : "Refresh metadata"}
      </button>

      {state.kind === "done" ? (
        <p role="status" className="mt-2 text-sm text-ink-muted">
          {state.filled.length === 0
            ? "Nothing new — the catalogues don't have these details either."
            : `Added ${state.filled.map((f) => FIELD_LABEL[f] ?? f).join(", ")}.`}
        </p>
      ) : null}

      {state.kind === "error" ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
