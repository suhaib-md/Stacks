import Link from "next/link";
import type { Book } from "@/db/schema";
import { formatAuthors } from "@/db/serde";
import { CoverImage } from "./CoverImage";
import type { SelectionProps } from "./CoverTile";

const STATUS_LABEL: Record<Book["readStatus"], string> = {
  unread: "Unread",
  reading: "Reading",
  finished: "Finished",
  dnf: "DNF",
};

/** Filled stars only — empty ones are noise at list density. */
function Rating({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <span className="shrink-0 text-xs text-accent" title={`${value} out of 5`}>
      {"★".repeat(value)}
      <span className="sr-only">{value} out of 5</span>
    </span>
  );
}

export function ListRow({
  book,
  selection,
}: {
  book: Book;
  selection?: SelectionProps;
}) {
  const authors = formatAuthors(book.authors);

  const body = (
    <>
      {selection?.active ? (
        <span
          aria-hidden="true"
          className={`flex size-5 shrink-0 items-center justify-center border-2 ${
            selection.selected ? "border-accent bg-accent text-on-accent" : "border-rule"
          }`}
        >
          {selection.selected ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="size-3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
      ) : null}
        <div
          className={`h-[54px] w-9 shrink-0 overflow-hidden border-2 border-rule ${
            book.readStatus === "dnf" ? "opacity-55 saturate-50" : ""
          }`}
        >
          <CoverImage
            src={book.coverUrl}
            title={book.title}
            authors={authors}
            coverColor={book.coverColor}
            className="h-full w-full"
          />
        </div>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[15px]">{book.title}</span>
          <span className="block truncate text-xs text-ink-muted">
            {authors}
            <span className="mx-1.5 text-ink-faint">·</span>
            {STATUS_LABEL[book.readStatus]}
            {book.readStatus === "reading" && book.currentPage > 0 ? (
              <span className="tabular"> · p.{book.currentPage}</span>
            ) : null}
          </span>
        </span>

      <Rating value={book.rating} />
    </>
  );

  const rowClass =
    "flex w-full items-center gap-3 py-2 text-left transition-colors hover:bg-ink/[.06]";

  if (selection?.active) {
    return (
      <li>
        <button
          type="button"
          onClick={selection.onToggle}
          aria-pressed={selection.selected}
          className={rowClass}
        >
          {body}
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/book/${book.id}`}
        className={rowClass}
        onContextMenu={
          selection
            ? (event) => {
                event.preventDefault();
                selection.onLongPress();
              }
            : undefined
        }
      >
        {body}
      </Link>
    </li>
  );
}
