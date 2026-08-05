"use client";

import { useState } from "react";
import { READ_STATUSES, type ReadStatus } from "@/db/schema";
import type { ApiBook } from "@/lib/books";
import { NotesEditor } from "./NotesEditor";
import { PageProgress } from "./PageProgress";
import { RatingStars } from "./RatingStars";
import { SaveIndicatorText, usePatchBook } from "./usePatchBook";

const STATUS_LABEL: Record<ReadStatus, string> = {
  unread: "Unread",
  reading: "Reading",
  finished: "Finished",
  dnf: "Did not finish",
};

/**
 * Everything you change about a book while reading it, in one place on the
 * detail page. Each control autosaves; none of them has a Save button.
 *
 * The status side effects (dates, progress reset, completion) are applied by the
 * PATCH handler, not here — this only sends the new status.
 */
export function ReadingPanel({ book }: { book: ApiBook }) {
  const { patch, state } = usePatchBook(book.id);
  const [status, setStatus] = useState<ReadStatus>(book.readStatus);
  const [askForRating, setAskForRating] = useState(false);

  const indicator = SaveIndicatorText(state);

  async function changeStatus(next: ReadStatus) {
    if (next === status) return;
    const previous = status;
    setStatus(next);

    const updated = await patch({ readStatus: next });
    if (!updated) {
      setStatus(previous); // Roll back a failed change rather than lie.
      return;
    }

    // Finishing something unrated is the one moment you actually have an
    // opinion to record.
    if (next === "finished" && book.rating === null) setAskForRating(true);
  }

  return (
    <section className="mt-6" aria-label="Reading">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-ink-muted">Reading</h2>
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

      <div role="radiogroup" aria-label="Read status" className="mt-2 flex flex-wrap gap-2">
        {READ_STATUSES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={status === option}
            onClick={() => changeStatus(option)}
            className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
              status === option
                ? "border border-accent bg-accent-soft text-accent"
                : "bg-surface-sunk text-ink-muted"
            }`}
          >
            {STATUS_LABEL[option]}
          </button>
        ))}
      </div>

      {status === "reading" ? (
        <PageProgress
          currentPage={book.currentPage}
          pageCount={book.pageCount}
          onChange={(page) => void patch({ currentPage: page })}
        />
      ) : null}

      <div className="mt-6">
        <h3 className="text-sm font-medium text-ink-muted">Your rating</h3>
        {askForRating ? (
          <p className="mt-1 text-xs text-accent">How was it?</p>
        ) : null}
        <div className="mt-1">
          <RatingStars
            rating={book.rating}
            autoFocus={askForRating}
            onChange={(rating) => {
              setAskForRating(false);
              void patch({ rating });
            }}
          />
        </div>
      </div>

      <div className="mt-6 max-w-prose">
        <h3 className="text-sm font-medium text-ink-muted">Notes</h3>
        <NotesEditor notes={book.notes} onSave={(notes) => void patch({ notes })} />
      </div>
    </section>
  );
}
