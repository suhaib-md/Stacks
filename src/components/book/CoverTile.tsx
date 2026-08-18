import Link from "next/link";
import type { Book } from "@/db/schema";
import { formatAuthors } from "@/db/serde";
import { CoverImage } from "./CoverImage";

const STATUS_LABEL: Record<Book["readStatus"], string> = {
  unread: "Unread",
  reading: "Reading",
  finished: "Finished",
  dnf: "Did not finish",
};

export type SelectionProps = {
  /** True while bulk-edit mode is active: taps select instead of navigating. */
  active: boolean;
  selected: boolean;
  onToggle: () => void;
  onLongPress: () => void;
};

/** Year · length · format, in that order, skipping whatever isn't known. */
function factLine(book: Book): string {
  return [
    book.publishedYear,
    book.pageCount ? `${book.pageCount}pp` : null,
    book.format[0].toUpperCase() + book.format.slice(1),
  ]
    .filter(Boolean)
    .join(" · ");
}

function statusLine(book: Book): string {
  if (book.readStatus === "reading" && book.pageCount) {
    return `Reading · ${Math.min(100, Math.round((book.currentPage / book.pageCount) * 100))}%`;
  }
  return STATUS_LABEL[book.readStatus];
}

/**
 * A cover and its caption block — title, author, the facts, the status.
 *
 * Status is words, never a hue. The one exception is did-not-finish, which
 * drops the cover to 50%: per the sheet, nothing else marks it.
 */
export function CoverTile({ book, selection }: { book: Book; selection?: SelectionProps }) {
  const authors = formatAuthors(book.authors);
  const dnf = book.readStatus === "dnf";

  const art = (
    <>
      <div
        className={`relative aspect-[2/3] w-full overflow-hidden border-2 bg-surface-sunk ${
          selection?.selected ? "border-accent" : "border-rule"
        } ${dnf ? "opacity-50" : ""}`}
      >
        <CoverImage
          src={book.coverUrl}
          title={book.title}
          authors={authors}
          coverColor={book.coverColor}
          sizes="(max-width: 480px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 22vw, 15vw"
          className="h-full w-full"
        />

        {selection?.active ? (
          <span
            aria-hidden="true"
            className={`absolute right-1.5 top-1.5 flex size-4 items-center justify-center border-2 ${
              selection.selected ? "border-accent bg-accent text-on-accent" : "border-paper bg-ink/40"
            }`}
          >
            {selection.selected ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} className="size-2.5">
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : null}
          </span>
        ) : null}
      </div>

      <div className="mt-2">
        <p className="font-display line-clamp-2 text-[15px] leading-[1.15]">{book.title}</p>
        <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-muted">{authors}</p>
        <p className="mt-1 line-clamp-1 text-[11px] text-ink-faint tabular">{factLine(book)}</p>
        <p className="lbl mt-0.5 text-ink-muted">{statusLine(book)}</p>
      </div>
    </>
  );

  if (selection?.active) {
    return (
      <li>
        <button
          type="button"
          onClick={selection.onToggle}
          aria-pressed={selection.selected}
          className="block w-full text-left"
        >
          {art}
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/book/${book.id}`}
        className="block"
        onContextMenu={
          selection
            ? (event) => {
                // Long-press surfaces as a context menu on touch; suppressing it
                // is what makes press-and-hold enter selection instead.
                event.preventDefault();
                selection.onLongPress();
              }
            : undefined
        }
      >
        {art}
      </Link>
    </li>
  );
}

/** Matches the tile's exact dimensions, so nothing shifts when covers land. */
export function CoverTileSkeleton() {
  return (
    <li aria-hidden="true">
      <div className="aspect-[2/3] w-full animate-pulse border-2 border-rule bg-surface-sunk" />
      <div className="mt-2 h-3 w-4/5 animate-pulse bg-surface-sunk" />
      <div className="mt-1 h-2.5 w-3/5 animate-pulse bg-surface-sunk" />
    </li>
  );
}
