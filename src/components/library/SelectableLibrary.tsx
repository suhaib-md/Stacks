"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CoverTile } from "@/components/book/CoverTile";
import { ListRow } from "@/components/book/ListRow";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import type { Book, ReadStatus } from "@/db/schema";
import type { BulkSheet } from "./BulkSheets";

// Loaded only once you enter selection mode. Keeps three dialogs and the sheet
// primitive out of the library's first payload.
const BulkSheets = dynamic(() => import("./BulkSheets").then((m) => m.BulkSheets), {
  ssr: false,
});

const GRID_CLASS =
  "grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 lg:gap-5 2xl:grid-cols-8";

type Mode = { active: false } | { active: true; ids: Set<string> };

/**
 * Bulk edit. Long-press (or right-click) a book to enter selection mode; the
 * action bar then replaces the page header until you leave.
 */
export function SelectableLibrary({ books, view }: { books: Book[]; view: "grid" | "list" }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ active: false });
  const [sheet, setSheet] = useState<BulkSheet | null>(null);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const dismissToast = useCallback(() => setToast(null), []);

  const enter = useCallback((id: string) => {
    setMode({ active: true, ids: new Set([id]) });
  }, []);

  const toggle = useCallback((id: string) => {
    setMode((current) => {
      if (!current.active) return current;
      const ids = new Set(current.ids);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      // Deselecting the last book leaves selection mode - staying in an empty
      // selection is a dead end with no action available.
      return ids.size === 0 ? { active: false } : { active: true, ids };
    });
  }, []);

  const exit = useCallback(() => {
    setMode({ active: false });
    setSheet(null);
  }, []);

  const selectedIds = mode.active ? [...mode.ids] : [];

  async function apply(patch: Record<string, unknown>, describe: (n: number) => string) {
    setPending(true);
    const res = await fetch("/api/books/bulk", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, patch }),
    }).catch(() => null);
    setPending(false);

    if (!res?.ok) {
      setToast({ text: "That bulk update failed." });
      return;
    }
    setToast({ text: describe(selectedIds.length) });
    exit();
    router.refresh();
  }

  async function removeSelected() {
    setPending(true);
    const res = await fetch("/api/books/bulk", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    }).catch(() => null);
    setPending(false);

    if (!res?.ok) {
      setToast({ text: "Couldn't delete those books." });
      return;
    }
    const count = selectedIds.length;
    setToast({ text: `Deleted ${count} ${count === 1 ? "book" : "books"}` });
    exit();
    router.refresh();
  }

  const selectionFor = (book: Book) => ({
    active: mode.active,
    selected: mode.active && mode.ids.has(book.id),
    onToggle: () => toggle(book.id),
    onLongPress: () => enter(book.id),
  });

  return (
    <>
      {mode.active ? (
        <div className="sticky top-14 z-20 -mx-4 mb-2 flex items-center gap-2 border-b-2 border-rule bg-paper/95 px-4 py-2 backdrop-blur">
          <span className="text-sm font-medium tabular">{selectedIds.length} selected</span>
          <div className="ml-auto flex gap-1">
            <BarButton onClick={() => setSheet("status")}>Status</BarButton>
            <BarButton onClick={() => setSheet("rating")}>Rate</BarButton>
            <BarButton onClick={() => setSheet("tag")}>Tag</BarButton>
            <BarButton onClick={() => setSheet("delete")} danger>
              Delete
            </BarButton>
            <BarButton onClick={exit}>Cancel</BarButton>
          </div>
        </div>
      ) : null}

      {view === "list" ? (
        <ul className="mt-4 divide-y divide-rule-minor">
          {books.map((book) => (
            <ListRow key={book.id} book={book} selection={selectionFor(book)} />
          ))}
        </ul>
      ) : (
        <ul className={`mt-4 ${GRID_CLASS}`}>
          {books.map((book) => (
            <CoverTile key={book.id} book={book} selection={selectionFor(book)} />
          ))}
        </ul>
      )}

      {!mode.active ? (
        <p className="mt-6 text-center text-xs text-ink-faint">
          Press and hold a book to select several at once.
        </p>
      ) : null}

      {mode.active ? (
        <BulkSheets
          sheet={sheet}
          count={selectedIds.length}
          pending={pending}
          onClose={() => setSheet(null)}
          onSetStatus={(status: ReadStatus, label: string) =>
            void apply({ readStatus: status }, (n) => `Set ${n} to ${label}`)
          }
          onAddTag={(tag: string) => void apply({ addTags: [tag] }, (n) => `Tagged ${n} with "${tag}"`)}
          onSetRating={(rating: number | null) =>
            void apply({ rating }, (n) =>
              rating === null ? `Cleared the rating on ${n}` : `Rated ${n} ${"★".repeat(rating)}`,
            )
          }
          onDelete={() => void removeSelected()}
        />
      ) : null}

      <Toast message={toast} onDismiss={dismissToast} />
    </>
  );
}

function BarButton({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 px-3 text-xs font-medium ${
        danger ? "text-danger" : "text-ink-muted"
      }`}
    >
      {children}
    </button>
  );
}
