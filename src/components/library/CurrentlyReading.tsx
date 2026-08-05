import Link from "next/link";
import { CoverImage } from "@/components/book/CoverImage";
import type { Book } from "@/db/schema";
import { formatAuthors } from "@/db/serde";

/**
 * The active reads, pinned above the library. Horizontal scroller with snap so
 * it works at any count without a carousel.
 */
export function CurrentlyReading({ books }: { books: Book[] }) {
  return (
    <section className="mt-5" aria-labelledby="currently-reading">
      <h2 id="currently-reading" className="text-xs font-medium uppercase tracking-wide text-ink-muted">
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

                {percent !== null ? (
                  <>
                    <div
                      className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-sunk"
                      role="progressbar"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${book.title} progress`}
                    >
                      <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] text-ink-muted tabular">
                      {book.currentPage} / {book.pageCount}
                    </p>
                  </>
                ) : (
                  // No page count means no honest progress to show.
                  <p className="mt-1 text-[10px] text-ink-faint">In progress</p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
