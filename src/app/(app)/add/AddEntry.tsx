"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { AddNav } from "@/components/book/AddNav";
import { ConfirmSheet, type ConfirmDraft } from "@/components/book/ConfirmSheet";
import { Scanner } from "@/components/scanner/Scanner";
import { Sheet } from "@/components/ui/Sheet";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type { ApiBook } from "@/lib/books";
import { isValidIsbn, parseIsbn } from "@/lib/isbn";
import type { BookMetadata } from "@/lib/providers/types";
import { IsbnAdd } from "./IsbnAdd";

/**
 * The rapid scan loop (docs/app-flow.md §4).
 *
 * Detect → look up → confirm → save → camera resumes, with no navigation in
 * between. The stream is never torn down while the sheet is open, only paused,
 * so resuming is instant.
 */
export function AddEntry() {
  const router = useRouter();

  const [cameraUsable, setCameraUsable] = useState(true);
  const [draft, setDraft] = useState<ConfirmDraft | null>(null);
  const [lookingIsbn, setLookingIsbn] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isbnEntryOpen, setIsbnEntryOpen] = useState(false);

  /**
   * Monotonic request id. Only the newest lookup may set the draft — otherwise
   * an earlier, slower response lands last and you get a book you didn't scan.
   */
  const requestRef = useRef(0);

  const dismissToast = useCallback(() => setToast(null), []);
  const onUnsupported = useCallback(() => setCameraUsable(false), []);

  /** Takes an already-validated ISBN-13. */
  const runLookup = useCallback(async (isbn13: string) => {
    const seq = requestRef.current + 1;
    requestRef.current = seq;

    setLookingIsbn(isbn13);
    const res = await fetch(`/api/lookup/isbn/${isbn13}`).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | { metadata: BookMetadata }
      | { error: { code: string } }
      | null;

    if (seq !== requestRef.current) return; // Superseded; drop it silently.

    setLookingIsbn(null);
    // A miss is never a dead end: the sheet opens with the ISBN retained.
    setDraft({
      metadata: data && "metadata" in data ? data.metadata : null,
      isbn: isbn13,
      source: "scan",
    });
  }, []);

  const onDetect = useCallback(
    (rawValue: string): boolean => {
      // Non-book EAN-13s (groceries, magazines) are rejected silently, and the
      // scanner only beeps once we return true — a chirp followed by nothing
      // reads as a broken app.
      const isbn13 = parseIsbn(rawValue)?.isbn13;
      if (!isbn13 || !isValidIsbn(rawValue)) return false;
      void runLookup(isbn13);
      return true;
    },
    [runLookup],
  );

  const onSaved = useCallback(
    (book: ApiBook, warning?: { bookId: string }) => {
      setDraft(null);
      setSessionCount((n) => n + 1);
      setToast({
        text: warning
          ? `Added “${book.title}” — you may already own it`
          : `Added “${book.title}”`,
        href: warning ? `/book/${warning.bookId}` : `/book/${book.id}`,
        linkLabel: warning ? "See the other copy" : "View",
      });
      router.refresh();
    },
    [router],
  );

  // No camera at all (desktop, or an insecure context): the typed-ISBN flow is
  // the whole screen rather than a hidden fallback.
  if (!cameraUsable) {
    return (
      <>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Add a book</h1>
        <p className="mt-2 text-sm text-ink-muted">
          No camera available here — add by ISBN, or search.
        </p>
        <AddNav />
        <IsbnAdd />
      </>
    );
  }

  return (
    // Fixed overlay so the camera is genuinely full-bleed over the app shell.
    <div className="fixed inset-0 z-40 bg-black">
      <Scanner
        paused={draft !== null || lookingIsbn !== null || isbnEntryOpen}
        onDetect={onDetect}
        onUnsupported={onUnsupported}
      />

      {sessionCount > 0 ? (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur tabular">
          {sessionCount} added this session
        </div>
      ) : null}

      {lookingIsbn ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-32 flex justify-center">
          {/* Shows the digits actually read, so a misread is visible rather than
              mysterious. */}
          <span className="rounded-full bg-black/70 px-4 py-2 text-center text-sm text-white backdrop-blur">
            Looking up…
            <span className="ml-2 tabular opacity-70">{lookingIsbn}</span>
          </span>
        </div>
      ) : null}

      {/* Escape hatches, always visible — never behind a menu. */}
      <div className="absolute inset-x-0 bottom-0 flex gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setIsbnEntryOpen(true)}
          className="min-h-11 flex-1 rounded-card bg-white/15 text-sm font-medium text-white backdrop-blur"
        >
          Enter ISBN
        </button>
        <Link
          href="/add/search"
          className="flex min-h-11 flex-1 items-center justify-center rounded-card bg-white/15 text-sm font-medium text-white backdrop-blur"
        >
          Search by title
        </Link>
      </div>

      <IsbnEntrySheet
        open={isbnEntryOpen}
        onClose={() => setIsbnEntryOpen(false)}
        onSubmit={(isbn) => {
          setIsbnEntryOpen(false);
          const isbn13 = parseIsbn(isbn)?.isbn13;
          if (isbn13) void runLookup(isbn13);
        }}
      />

      <ConfirmSheet
        draft={draft}
        open={draft !== null}
        onClose={() => setDraft(null)}
        onSaved={onSaved}
      />
      <Toast message={toast} onDismiss={dismissToast} />
    </div>
  );
}

function IsbnEntrySheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (isbn: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const raw = value.trim();
    if (!isValidIsbn(raw)) {
      setError("That doesn't look like a valid ISBN.");
      return;
    }
    setValue("");
    setError(null);
    onSubmit(raw);
  }

  return (
    <Sheet open={open} onClose={onClose} labelledBy="isbn-entry-title">
      <h2 id="isbn-entry-title" className="font-display text-lg">
        Enter an ISBN
      </h2>
      <p className="mt-1 text-xs text-ink-muted">
        For barcodes that won&apos;t scan — worn covers, tight spines, glare.
      </p>
      <form onSubmit={submit} className="mt-4">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          inputMode="numeric"
          autoComplete="off"
          placeholder="978…"
          aria-label="ISBN"
          aria-invalid={error ? true : undefined}
          className="w-full rounded-card bg-surface-sunk px-4 py-3 text-base tabular outline-none ring-accent focus:ring-2"
        />
        {error ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-card border border-rule px-4 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-11 flex-1 rounded-card bg-accent px-4 text-sm font-medium text-paper"
          >
            Look up
          </button>
        </div>
      </form>
    </Sheet>
  );
}
