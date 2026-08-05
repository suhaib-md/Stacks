"use client";

import Link from "next/link";
import { useState } from "react";
import { CoverImage } from "@/components/book/CoverImage";
import { PageProgress } from "@/components/book/PageProgress";
import { SaveIndicatorText, usePatchBook } from "@/components/book/usePatchBook";
import { Sheet } from "@/components/ui/Sheet";
import type { Book } from "@/db/schema";
import { formatAuthors } from "@/db/serde";

/**
 * The active reads, pinned above the library.
 *
 * The progress bar is a button: updating where you are takes two taps from home
 * and never leaves the page. Anything more than that and you stop bothering.
 */
export function CurrentlyReading({ books }: { books: Book[] }) {
  const [updating, setUpdating] = useState<Book | null>(null);

  return (
    <section className="mt-5" aria-labelledby="currently-reading">
      <h2
        id="currently-reading"
        className="text-xs font-medium uppercase tracking-wide text-ink-muted"
      >
        Currently reading
      </h2>

      <ul className="-mx-4 mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:px-0">
        {books.map((book) => {
          const authors = formatAuthors(book.authors);
          const percent =
            book.pageCount && book.pageCount > 0
              ? Math.min(100, Math.round((book.currentPage / book.pageCount) * 100))
              : null;

          return (
            <li key={book.id} className="w-[136px] shrink-0 snap-start">
              <Link href={`/book/${book.id}`} className="group block">
                <div className="aspect-[2/3] w-full overflow-hidden rounded-cover border border-rule bg-surface-sunk transition-transform duration-100 group-active:scale-[0.97]">
                  <CoverImage
                    src={book.coverUrl}
                    title={book.title}
                    authors={authors}
                    className="h-full w-full"
                  />
                </div>
                <p className="mt-1.5 line-clamp-1 font-display text-[13px]">{book.title}</p>
              </Link>

              <button
                type="button"
                onClick={() => setUpdating(book)}
                aria-label={`Update progress for ${book.title}`}
                className="mt-1 w-full text-left"
              >
                {percent !== null ? (
                  <>
                    <div
                      className="h-1 w-full overflow-hidden rounded-full bg-surface-sunk"
                      role="progressbar"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="mt-1 block text-[10px] text-ink-muted tabular">
                      {book.currentPage} / {book.pageCount}
                    </span>
                  </>
                ) : (
                  // No page count means no honest progress to draw.
                  <span className="block text-[10px] text-accent underline">Set progress</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {updating ? (
        <ProgressSheet book={updating} onClose={() => setUpdating(null)} />
      ) : null}
    </section>
  );
}

function ProgressSheet({ book, onClose }: { book: Book; onClose: () => void }) {
  const { patch, state } = usePatchBook(book.id);
  const indicator = SaveIndicatorText(state);

  return (
    <Sheet open onClose={onClose} labelledBy="progress-title">
      <h2 id="progress-title" className="font-display text-lg leading-snug">
        {book.title}
      </h2>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-xs text-ink-muted">Where are you?</p>
        {indicator ? (
          <span
            role="status"
            aria-live="polite"
            className={`text-xs ${state === "error" ? "text-danger" : "text-ink-faint"}`}
          >
            {indicator}
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <PageProgress
          compact
          currentPage={book.currentPage}
          pageCount={book.pageCount}
          onChange={(page) => void patch({ currentPage: page })}
        />
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 flex-1 rounded-card border border-rule px-4 text-sm font-medium"
        >
          Done
        </button>
        <button
          type="button"
          onClick={async () => {
            // Finishing from here applies the same server rules as anywhere else:
            // the date is stamped and progress completes.
            await patch({ readStatus: "finished" });
            onClose();
          }}
          className="min-h-11 flex-1 rounded-card bg-accent px-4 text-sm font-medium text-paper"
        >
          Finished it
        </button>
      </div>
    </Sheet>
  );
}
