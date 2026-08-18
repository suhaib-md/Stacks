"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ConfirmSheet, type ConfirmDraft } from "@/components/book/ConfirmSheet";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type { ApiBook } from "@/lib/books";
import type { BookMetadata } from "@/lib/providers/types";

export function SearchAdd() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookMetadata[] | null>(null);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<ConfirmDraft | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const dismissToast = useCallback(() => setToast(null), []);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;

    setPending(true);
    const res = await fetch(`/api/lookup/search?q=${encodeURIComponent(q)}`).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | { results: BookMetadata[]; source: string }
      | null;
    setPending(false);
    setResults(data && "results" in data ? data.results : []);
  }

  function onSaved(book: ApiBook, warning?: { bookId: string }) {
    // Keep the result list up so an author's backlist can be added in sequence.
    if (draft?.metadata) {
      const key = resultKey(draft.metadata);
      setSavedKeys((prev) => new Set(prev).add(key));
    }
    setDraft(null);
    setToast({
      text: warning ? `Added “${book.title}” — you may already own it` : `Added “${book.title}”`,
      href: warning ? `/book/${warning.bookId}` : undefined,
      linkLabel: warning ? "See the other copy" : undefined,
    });
    router.refresh();
  }

  return (
    <>
      <form onSubmit={search} className="mt-6">
        <label htmlFor="q" className="mb-2 block text-sm font-medium">
          Title or author
        </label>
        <div className="flex gap-2">
          <input
            id="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            placeholder="the dispossessed le guin"
            className="min-h-11 flex-1 border-2 border-rule bg-surface-sunk px-4 text-base outline-none"
          />
          <button
            type="submit"
            disabled={pending || query.trim().length < 2}
            className="min-h-11 bg-accent px-5 text-sm font-medium text-on-accent disabled:opacity-50"
          >
            {pending ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {results !== null && results.length === 0 && !pending ? (
        <div className="mt-8 text-center">
          <p className="disp text-base">Nothing found</p>
          <p className="mt-1 text-sm text-ink-muted">
            Regional and older editions are often missing from both catalogues.
          </p>
          <Link
            href="/add/manual"
            className="mt-4 inline-flex min-h-11 items-center bg-accent px-4 text-sm font-medium text-on-accent"
          >
            Add it manually
          </Link>
        </div>
      ) : null}

      {results && results.length > 0 ? (
        <ul className="mt-6 divide-y divide-rule-minor">
          {results.map((result, index) => {
            const key = resultKey(result);
            const saved = savedKeys.has(key);
            return (
              <li key={`${key}-${index}`}>
                <button
                  type="button"
                  onClick={() => setDraft({ metadata: result, isbn: result.isbn13, source: "search" })}
                  className="flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-ink/[.06]"
                >
                  {result.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote covers are unoptimized by design
                    <img
                      src={result.coverUrl}
                      alt=""
                      width={40}
                      height={60}
                      className="h-[60px] w-10 shrink-0 border-2 border-rule object-cover"
                    />
                  ) : (
                    <div className="h-[60px] w-10 shrink-0 border-2 border-rule bg-surface-sunk" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-base">{result.title}</span>
                    <span className="block truncate text-sm text-ink-muted">
                      {result.authors.length > 0 ? result.authors.join(", ") : "Unknown author"}
                    </span>
                    <span className="block text-xs text-ink-faint">
                      {[result.publisher, result.publishedYear].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {saved ? (
                    <span className="shrink-0 self-center text-xs font-medium text-success">
                      Added
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
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

/** Results have no stable id; ISBN or title+author is enough to mark one added. */
function resultKey(metadata: BookMetadata): string {
  return metadata.isbn13 ?? `${metadata.title}|${metadata.authors.join(",")}`;
}
