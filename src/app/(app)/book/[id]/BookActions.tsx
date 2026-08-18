"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";

export function BookActions({ bookId, title }: { bookId: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);

    const res = await fetch(`/api/books/${bookId}`, { method: "DELETE" }).catch(() => null);

    if (!res?.ok) {
      setPending(false);
      setError("Couldn't delete that book.");
      return;
    }

    // replace, not push — the deleted book's URL should not be a back target.
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <div className="mt-5 flex gap-3">
        <Link
          href={`/book/${bookId}/edit`}
          className="min-h-11 bg-surface px-4 text-sm font-medium leading-11"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-11 px-4 text-sm font-medium text-danger"
        >
          Delete
        </button>
      </div>

      <Sheet open={confirming} onClose={() => setConfirming(false)} labelledBy="delete-title">
        <h2 id="delete-title" className="disp text-lg">
          Delete this book?
        </h2>
        {/* Name it explicitly — deletion is irreversible and there is no undo. */}
        <p className="mt-2 text-sm text-ink-muted">
          “{title}” will be removed from your library. This can&apos;t be undone.
        </p>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="min-h-11 flex-1 border border-rule-control px-4 text-sm font-medium"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={remove}
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
