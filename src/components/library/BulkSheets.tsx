"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { READ_STATUSES, type ReadStatus } from "@/db/schema";

/**
 * The bulk-edit dialogs, split out so they can be loaded on demand.
 *
 * Nobody sees these until they long-press a book, so shipping them in the
 * library's first payload is pure weight on the route that matters most.
 */

const STATUS_LABEL: Record<ReadStatus, string> = {
  unread: "Unread",
  reading: "Reading",
  finished: "Finished",
  dnf: "Did not finish",
};

export type BulkSheet = "status" | "tag" | "rating" | "delete";

export function BulkSheets({
  sheet,
  count,
  pending,
  onClose,
  onSetStatus,
  onAddTag,
  onSetRating,
  onDelete,
}: {
  sheet: BulkSheet | null;
  count: number;
  pending: boolean;
  onClose: () => void;
  onSetStatus: (status: ReadStatus, label: string) => void;
  onAddTag: (tag: string) => void;
  onSetRating: (rating: number | null) => void;
  onDelete: () => void;
}) {
  const [tagValue, setTagValue] = useState("");
  const noun = count === 1 ? "book" : "books";

  return (
    <>
      <Sheet open={sheet === "rating"} onClose={onClose} labelledBy="bulk-rating">
        <h2 id="bulk-rating" className="disp text-base">
          Rate {count} {noun}
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Applies the same rating to everything selected.
        </p>
        <div className="mt-4 space-y-2">
          {[5, 4, 3, 2, 1].map((stars) => (
            <button
              key={stars}
              type="button"
              disabled={pending}
              onClick={() => onSetRating(stars)}
              className="flex min-h-11 w-full items-center gap-3 border border-rule-control bg-surface-sunk px-4 text-left text-sm font-medium disabled:opacity-50"
            >
              <span className="text-accent">{"★".repeat(stars)}</span>
              <span className="text-ink-faint">{"★".repeat(5 - stars)}</span>
            </button>
          ))}
          <button
            type="button"
            disabled={pending}
            onClick={() => onSetRating(null)}
            className="min-h-11 w-full px-4 text-left text-sm font-medium text-ink-muted disabled:opacity-50"
          >
            Clear rating
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === "status"} onClose={onClose} labelledBy="bulk-status">
        <h2 id="bulk-status" className="disp text-base">
          Set status
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Applies to {count} {noun}.
        </p>
        <div className="mt-4 space-y-2">
          {READ_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              disabled={pending}
              onClick={() => onSetStatus(status, STATUS_LABEL[status])}
              className="min-h-11 w-full border border-rule-control bg-surface-sunk px-4 text-left text-sm font-medium disabled:opacity-50"
            >
              {STATUS_LABEL[status]}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === "tag"} onClose={onClose} labelledBy="bulk-tag">
        <h2 id="bulk-tag" className="disp text-base">
          Add a tag
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Added to {count} {noun}. Existing tags are kept.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const tag = tagValue.trim();
            if (!tag) return;
            setTagValue("");
            onAddTag(tag);
          }}
          className="mt-4"
        >
          <input
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            placeholder="e.g. cabinet-one"
            aria-label="Tag"
            className="w-full border border-rule-control bg-surface-sunk px-4 py-3 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={pending || tagValue.trim().length === 0}
            className="mt-4 min-h-11 w-full bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-50"
          >
            Add tag
          </button>
        </form>
      </Sheet>

      <Sheet open={sheet === "delete"} onClose={onClose} labelledBy="bulk-delete">
        <h2 id="bulk-delete" className="disp text-base">
          Delete {count} {noun}?
        </h2>
        <p className="mt-2 text-sm text-ink-muted">This can&apos;t be undone.</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 border border-rule-control px-4 text-sm font-medium"
          >
            Keep them
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="min-h-11 flex-1 bg-danger px-4 text-sm font-medium text-paper disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Sheet>
    </>
  );
}
