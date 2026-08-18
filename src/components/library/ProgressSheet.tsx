"use client";

import { PageProgress } from "@/components/book/PageProgress";
import { SaveIndicatorText, usePatchBook } from "@/components/book/usePatchBook";
import { Sheet } from "@/components/ui/Sheet";
import type { Book } from "@/db/schema";

/**
 * Update where you are without leaving home. Split into its own module so the
 * library route doesn't pay for the sheet, the stepper and the patch hook until
 * a progress bar is actually tapped.
 */
export function ProgressSheet({ book, onClose }: { book: Book; onClose: () => void }) {
  const { patch, state } = usePatchBook(book.id);
  const indicator = SaveIndicatorText(state);

  return (
    <Sheet open onClose={onClose} labelledBy="progress-title">
      <h2 id="progress-title" className="disp text-base leading-snug">
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
          className="min-h-11 flex-1 border-2 border-rule px-4 text-sm font-medium"
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
          className="min-h-11 flex-1 bg-accent px-4 text-sm font-medium text-on-accent"
        >
          Finished it
        </button>
      </div>
    </Sheet>
  );
}
