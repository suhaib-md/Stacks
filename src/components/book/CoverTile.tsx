import Link from "next/link";
import type { Book } from "@/db/schema";
import { formatAuthors } from "@/db/serde";
import { CoverImage } from "./CoverImage";

/**
 * Status is never conveyed by colour alone (docs/uiux.md §9): Reading gets a
 * ribbon shape, Finished a check icon, DNF reduced opacity plus a label, and
 * Unread no adornment at all — the default state doesn't deserve decoration.
 */
function StatusMark({ status }: { status: Book["readStatus"] }) {
  if (status === "reading") {
    return (
      <span
        title="Reading"
        className="absolute left-2 top-0 h-7 w-4 bg-accent shadow-sm [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)]"
      >
        <span className="sr-only">Reading</span>
      </span>
    );
  }

  if (status === "finished") {
    return (
      <span
        title="Finished"
        className="absolute bottom-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-success text-white shadow"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="size-3">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sr-only">Finished</span>
      </span>
    );
  }

  if (status === "dnf") {
    return (
      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-paper">
        DNF
      </span>
    );
  }

  return null;
}

export type SelectionProps = {
  /** True while bulk-edit mode is active: taps select instead of navigating. */
  active: boolean;
  selected: boolean;
  onToggle: () => void;
  onLongPress: () => void;
};

export function CoverTile({
  book,
  selection,
}: {
  book: Book;
  selection?: SelectionProps;
}) {
  const authors = formatAuthors(book.authors);

  const art = (
    <>
      <div
        className={`relative aspect-[2/3] w-full overflow-hidden rounded-cover border bg-surface-sunk transition-transform duration-100 group-active:scale-[0.97] ${
          selection?.selected ? "border-accent ring-2 ring-accent" : "border-rule"
        } ${book.readStatus === "dnf" ? "opacity-55 saturate-50" : ""}`}
      >
        <CoverImage
          src={book.coverUrl}
          title={book.title}
          authors={authors}
          sizes="(max-width: 480px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
          className="h-full w-full"
        />
        <StatusMark status={book.readStatus} />

        {selection?.active ? (
          <span
            aria-hidden="true"
            className={`absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full border-2 ${
              selection.selected
                ? "border-accent bg-accent text-paper"
                : "border-white/80 bg-black/30"
            }`}
          >
            {selection.selected ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="size-3">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 line-clamp-2 font-display text-[13px] leading-snug">{book.title}</p>
      <p className="line-clamp-1 text-[11px] text-ink-muted">{authors}</p>
    </>
  );

  if (selection?.active) {
    return (
      <li>
        <button
          type="button"
          onClick={selection.onToggle}
          aria-pressed={selection.selected}
          className="group block w-full text-left"
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
        className="group block"
        onContextMenu={
          selection
            ? (event) => {
                // Long-press on touch surfaces as a context menu; suppressing it
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
      <div className="aspect-[2/3] w-full animate-pulse rounded-cover bg-surface-sunk" />
      <div className="mt-1.5 h-3 w-4/5 animate-pulse rounded bg-surface-sunk" />
      <div className="mt-1 h-2.5 w-3/5 animate-pulse rounded bg-surface-sunk" />
    </li>
  );
}
