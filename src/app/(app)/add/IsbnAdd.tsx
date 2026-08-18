"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ConfirmSheet, type ConfirmDraft } from "@/components/book/ConfirmSheet";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type { ApiBook } from "@/lib/books";
import { isValidIsbn, parseIsbn } from "@/lib/isbn";
import type { BookMetadata } from "@/lib/providers/types";

export function IsbnAdd() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ConfirmDraft | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  const dismissToast = useCallback(() => setToast(null), []);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    const raw = input.trim();

    // Validate before spending a request — a typo should fail instantly.
    if (!isValidIsbn(raw)) {
      setError("That doesn't look like a valid ISBN.");
      return;
    }

    setError(null);
    setPending(true);

    const isbn13 = parseIsbn(raw)?.isbn13 ?? raw;
    const res = await fetch(`/api/lookup/isbn/${isbn13}`).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | { metadata: BookMetadata; cached: boolean }
      | { error: { code: string; message: string } }
      | null;

    setPending(false);

    // A failed lookup is never a dead end — the sheet opens with the ISBN kept.
    const metadata = data && "metadata" in data ? data.metadata : null;
    setDraft({ metadata, isbn: isbn13, source: "manual" });
  }

  function onSaved(book: ApiBook, warning?: { bookId: string }) {
    setDraft(null);
    setInput("");
    setSessionCount((n) => n + 1);
    setToast({
      text: warning ? `Added “${book.title}” — you may already own it` : `Added “${book.title}”`,
      href: warning ? `/book/${warning.bookId}` : undefined,
      linkLabel: warning ? "See the other copy" : undefined,
    });
    router.refresh();
  }

  return (
    <>
      <form onSubmit={lookup} className="mt-6">
        <label htmlFor="isbn" className="mb-2 block text-sm font-medium">
          ISBN
        </label>
        <div className="flex gap-2">
          <input
            id="isbn"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(null);
            }}
            inputMode="numeric"
            autoComplete="off"
            placeholder="978…"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "isbn-error" : undefined}
            className="min-h-11 flex-1 border border-rule-control bg-surface-sunk px-4 text-base tabular outline-none"
          />
          <button
            type="submit"
            disabled={pending || input.trim().length === 0}
            className="min-h-11 bg-accent px-5 text-sm font-medium text-on-accent disabled:opacity-50"
          >
            {pending ? "Looking…" : "Look up"}
          </button>
        </div>

        {error ? (
          <p id="isbn-error" role="alert" className="mt-2 text-sm text-danger">
            {error}{" "}
            <Link href="/add/manual" className="underline">
              Add it manually instead
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-xs text-ink-muted">
            ISBN-10 or ISBN-13, hyphens welcome. The barcode scanner arrives in Phase 2.
          </p>
        )}
      </form>

      {sessionCount > 0 ? (
        <p className="mt-6 text-sm text-ink-muted tabular">
          {sessionCount} added this session
        </p>
      ) : null}

      <ConfirmSheet
        draft={draft}
        open={draft !== null}
        onClose={() => setDraft(null)}
        onSaved={onSaved}
      />
      <Toast message={toast} onDismiss={dismissToast} />
    </>
  );
}
