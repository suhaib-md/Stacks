"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { BOOK_FORMATS, READ_STATUSES, type BookFormat, type ReadStatus } from "@/db/schema";
import type { ApiBook } from "@/lib/books";
import type { BookMetadata } from "@/lib/providers/types";

/**
 * The one confirm surface. Scan (Phase 2), search, and manual entry all end here,
 * so a fix to the save path is a fix everywhere. Do not fork it.
 */

export type ConfirmDraft = {
  metadata: BookMetadata | null;
  /** Scanned or typed ISBN, kept even when lookup found nothing. */
  isbn: string | null;
  source: "scan" | "search" | "manual";
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "duplicate"; bookId?: string; title?: string }
  | { kind: "error"; message: string };

type Props = {
  draft: ConfirmDraft | null;
  open: boolean;
  onClose: () => void;
  onSaved: (book: ApiBook, warning?: { bookId: string }) => void;
};

/**
 * Remounts the form per book via `key`, which is React's answer to "reset all
 * state when a prop changes". Mirroring the draft into state from an effect
 * would leak the previous book's edits for one render — and this sheet re-opens
 * constantly on the fast path, so that render is visible.
 */
export function ConfirmSheet({ draft, ...rest }: Props) {
  if (!draft) return null;
  const key = `${draft.source}|${draft.isbn ?? ""}|${draft.metadata?.title ?? ""}`;
  return <ConfirmSheetForm key={key} draft={draft} {...rest} />;
}

function ConfirmSheetForm({
  draft,
  open,
  onClose,
  onSaved,
}: Props & { draft: ConfirmDraft }) {
  const titleId = useId();
  const metadata = draft.metadata;

  const [title, setTitle] = useState(metadata?.title ?? "");
  const [authors, setAuthors] = useState((metadata?.authors ?? []).join(", "));
  const [format, setFormat] = useState<BookFormat>("paperback");
  const [status, setStatus] = useState<ReadStatus>("unread");
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const isbn = metadata?.isbn13 ?? draft.isbn;

  async function save() {
    if (title.trim().length === 0) {
      setState({ kind: "error", message: "A title is required." });
      return;
    }
    setState({ kind: "saving" });

    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        isbn13: isbn ?? undefined,
        title: title.trim(),
        subtitle: metadata?.subtitle ?? undefined,
        authors: authors
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        publisher: metadata?.publisher ?? undefined,
        publishedYear: metadata?.publishedYear ?? undefined,
        pageCount: metadata?.pageCount ?? undefined,
        description: metadata?.description ?? undefined,
        coverUrl: metadata?.coverUrl ?? undefined,
        language: metadata?.language ?? undefined,
        genre: metadata?.categories?.[0] ?? undefined,
        format,
        readStatus: status,
        source: draft.source,
      }),
    }).catch(() => null);

    if (!res) {
      setState({ kind: "error", message: "Couldn't reach the server." });
      return;
    }

    const data = (await res.json().catch(() => null)) as
      | { book: ApiBook; warnings: Array<{ code: string; bookId: string }> }
      | { error: { code: string; message: string; details?: { bookId?: string; title?: string } } }
      | null;

    if (!res.ok || !data || !("book" in data)) {
      if (data && "error" in data && data.error.code === "DUPLICATE_ISBN") {
        setState({
          kind: "duplicate",
          bookId: data.error.details?.bookId,
          title: data.error.details?.title,
        });
        return;
      }
      setState({
        kind: "error",
        message: data && "error" in data ? data.error.message : "Couldn't save that book.",
      });
      return;
    }

    const duplicateWarning = data.warnings.find((w) => w.code === "POSSIBLE_DUPLICATE");
    onSaved(data.book, duplicateWarning ? { bookId: duplicateWarning.bookId } : undefined);
  }

  if (state.kind === "duplicate") {
    return (
      <Sheet open={open} onClose={onClose} labelledBy={titleId}>
        <h2 id={titleId} className="font-display text-xl">
          Already in your library
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          {state.title ? `“${state.title}” is` : "That book is"} already on your shelves.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-card border border-rule px-4 text-sm font-medium"
          >
            Keep going
          </button>
          {state.bookId ? (
            <Link
              href={`/book/${state.bookId}`}
              className="flex min-h-11 flex-1 items-center justify-center rounded-card bg-accent px-4 text-sm font-medium text-paper"
            >
              View it
            </Link>
          ) : null}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} labelledBy={titleId}>
      <div className="flex gap-4">
        {metadata?.coverUrl ? (
          // Remote covers are unoptimized by design (see next.config.ts) — Workers
          // has no image optimizer, so next/image would add weight and no benefit.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={metadata.coverUrl}
            alt=""
            width={72}
            height={108}
            className="h-[108px] w-[72px] shrink-0 rounded-cover border border-rule object-cover"
          />
        ) : (
          <div className="flex h-[108px] w-[72px] shrink-0 items-center justify-center rounded-cover border border-rule bg-surface-sunk text-[10px] text-ink-faint">
            No cover
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-display text-lg leading-snug">
            {title || "Untitled"}
          </h2>
          {metadata?.publisher || metadata?.publishedYear ? (
            <p className="mt-1 text-xs text-ink-muted">
              {[metadata.publisher, metadata.publishedYear].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {metadata?.pageCount ? (
            <p className="text-xs text-ink-muted tabular">{metadata.pageCount} pages</p>
          ) : null}
          {isbn ? <p className="mt-1 text-xs text-ink-faint tabular">{isbn}</p> : null}
        </div>
      </div>

      {!metadata ? (
        <div className="mt-4 rounded-card bg-surface-sunk p-3 text-xs text-ink-muted">
          <p>
            No metadata found{isbn ? " for that ISBN" : ""}. Fill in what you know —
            the book still gets catalogued.
          </p>
          {/* The scan is never wasted: both routes carry the ISBN forward. */}
          <p className="mt-2 flex gap-3">
            <Link href={`/add/manual${isbn ? `?isbn=${isbn}` : ""}`} className="underline">
              More fields
            </Link>
            <Link href="/add/search" className="underline">
              Search by title
            </Link>
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-card bg-surface-sunk px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">
            Authors <span className="text-ink-faint">(comma separated)</span>
          </span>
          <input
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            className="w-full rounded-card bg-surface-sunk px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">Format</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as BookFormat)}
              className="w-full rounded-card bg-surface-sunk px-3 py-2 text-sm capitalize outline-none ring-accent focus:ring-2"
            >
              {BOOK_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ReadStatus)}
              className="w-full rounded-card bg-surface-sunk px-3 py-2 text-sm capitalize outline-none ring-accent focus:ring-2"
            >
              {READ_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "dnf" ? "Did not finish" : s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {state.kind === "error" ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-card border border-rule px-4 text-sm font-medium"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={save}
          disabled={state.kind === "saving"}
          className="min-h-11 flex-1 rounded-card bg-accent px-4 text-sm font-medium text-paper disabled:opacity-50"
        >
          {state.kind === "saving" ? "Saving…" : "Save to library"}
        </button>
      </div>
    </Sheet>
  );
}
