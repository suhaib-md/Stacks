"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { CoverImage } from "@/components/book/CoverImage";
import type { Book } from "@/db/schema";
import { formatAuthors } from "@/db/serde";

// Only needed once you tap a progress bar, so the sheet, the stepper and the
// patch hook stay out of the library's first payload.
const ProgressSheet = dynamic(
  () => import("./ProgressSheet").then((m) => m.ProgressSheet),
  { ssr: false },
);

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
                    coverColor={book.coverColor}
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
