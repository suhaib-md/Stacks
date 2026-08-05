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

export type BulkSheet = "status" | "tag" | "delete";

export function BulkSheets({
  sheet,
  count,
  pending,
  onClose,
  onSetStatus,
  onAddTag,
  onDelete,
}: {
  sheet: BulkSheet | null;
  count: number;
  pending: boolean;
  onClose: () => void;
  onSetStatus: (status: ReadStatus, label: string) => void;
  onAddTag: (tag: string) => void;
  onDelete: () => void;
}) {
  const [tagValue, setTagValue] = useState("");
  const noun = count === 1 ? "book" : "books";

  return (
    <>
      <Sheet open={sheet === "status"} onClose={onClose} labelledBy="bulk-status">
        <h2 id="bulk-status" className="font-display text-lg">
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
              className="min-h-11 w-full rounded-card bg-surface-sunk px-4 text-left text-sm font-medium disabled:opacity-50"
            >
              {STATUS_LABEL[status]}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === "tag"} onClose={onClose} labelledBy="bulk-tag">
        <h2 id="bulk-tag" className="font-display text-lg">
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
            className="w-full rounded-card bg-surface-sunk px-4 py-3 text-sm outline-none ring-accent focus:ring-2"
          />
          <button
            type="submit"
            disabled={pending || tagValue.trim().length === 0}
            className="mt-4 min-h-11 w-full rounded-card bg-accent px-4 text-sm font-medium text-paper disabled:opacity-50"
          >
            Add tag
          </button>
        </form>
      </Sheet>

      <Sheet open={sheet === "delete"} onClose={onClose} labelledBy="bulk-delete">
        <h2 id="bulk-delete" className="font-display text-lg">
          Delete {count} {noun}?
        </h2>
        <p className="mt-2 text-sm text-ink-muted">This can&apos;t be undone.</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-card border border-rule px-4 text-sm font-medium"
          >
            Keep them
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="min-h-11 flex-1 rounded-card bg-danger px-4 text-sm font-medium text-paper disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Sheet>
    </>
  );
}
