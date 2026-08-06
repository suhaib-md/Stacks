"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CoverImage } from "@/components/book/CoverImage";
import type { Book } from "@/db/schema";
import { formatAuthors } from "@/db/serde";

export function PickShuffle({ books }: { books: Book[] }) {
  const router = useRouter();
  // Index rather than the book itself, so a re-roll is one number.
  const [index, setIndex] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  if (books.length === 0) {
    return (
      <p className="mt-10 text-center text-sm text-ink-muted">
        Nothing unread matches. Try another genre, or{" "}
        <Link href="/add" className="underline">
          add a book
        </Link>
        .
      </p>
    );
  }

  function roll() {
    if (books.length === 1) {
      setIndex(0);
      return;
    }
    // Never offer the same book twice in a row — a shuffle that repeats itself
    // feels broken even when it's correct.
    let next = Math.floor(Math.random() * books.length);
    while (next === index) next = Math.floor(Math.random() * books.length);
    setIndex(next);
  }

  const picked = index === null ? null : books[index];

  async function startReading() {
    if (!picked) return;
    setStarting(true);
    await fetch(`/api/books/${picked.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ readStatus: "reading" }),
    }).catch(() => null);
    router.push(`/book/${picked.id}`);
    router.refresh();
  }

  return (
    <div className="mt-8 flex flex-col items-center">
      {picked ? (
        <>
          <Link href={`/book/${picked.id}`} className="block w-44">
            <div className="aspect-[2/3] w-full overflow-hidden rounded-cover border border-rule shadow-lg">
              <CoverImage
                src={picked.coverUrl}
                title={picked.title}
                authors={formatAuthors(picked.authors)}
                coverColor={picked.coverColor}
                className="h-full w-full"
              />
            </div>
          </Link>

          <h2 className="mt-4 max-w-sm text-center font-display text-xl leading-snug">
            {picked.title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{formatAuthors(picked.authors)}</p>
          {picked.pageCount ? (
            <p className="text-xs text-ink-faint tabular">{picked.pageCount} pages</p>
          ) : null}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={roll}
              className="min-h-11 rounded-card border border-rule px-5 text-sm font-medium"
            >
              Something else
            </button>
            <button
              type="button"
              onClick={startReading}
              disabled={starting}
              className="min-h-11 rounded-card bg-accent px-5 text-sm font-medium text-paper disabled:opacity-50"
            >
              {starting ? "Starting…" : "Start reading"}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={roll}
          className="min-h-14 rounded-card bg-accent px-8 font-display text-lg font-medium text-paper"
        >
          Pick one
        </button>
      )}
    </div>
  );
}
