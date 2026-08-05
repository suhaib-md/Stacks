"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BOOK_FORMATS, READ_STATUSES, type BookFormat, type ReadStatus } from "@/db/schema";
import type { ApiBook } from "@/lib/books";
import { isValidIsbn } from "@/lib/isbn";

type FieldProps = {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor: string;
};

function Field({ label, hint, children, htmlFor }: FieldProps) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">
        {label}
        {hint ? <span className="ml-1 text-ink-faint">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-card bg-surface-sunk px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

export function ManualAdd({
  initialIsbn,
  initialTitle,
}: {
  initialIsbn: string;
  initialTitle: string;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [isbn, setIsbn] = useState(initialIsbn);
  const [publisher, setPublisher] = useState("");
  const [year, setYear] = useState("");
  const [pages, setPages] = useState("");
  const [genre, setGenre] = useState("");
  const [tags, setTags] = useState("");
  const [format, setFormat] = useState<BookFormat>("paperback");
  const [status, setStatus] = useState<ReadStatus>("unread");
  const [notes, setNotes] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (title.trim().length === 0) {
      setError("A title is required.");
      return;
    }
    // Catch a bad ISBN here rather than losing the whole form to a 400.
    if (isbn.trim().length > 0 && !isValidIsbn(isbn.trim())) {
      setError("That ISBN isn't valid. Clear it or correct it — the rest is fine.");
      return;
    }

    setPending(true);

    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        authors: authors.split(",").map((a) => a.trim()).filter(Boolean),
        isbn13: isbn.trim() || undefined,
        publisher: publisher.trim() || undefined,
        publishedYear: year.trim() ? Number.parseInt(year, 10) : undefined,
        pageCount: pages.trim() ? Number.parseInt(pages, 10) : undefined,
        genre: genre.trim() || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        format,
        readStatus: status,
        notes: notes.trim() || undefined,
        source: "manual",
      }),
    }).catch(() => null);

    const data = (await res?.json().catch(() => null)) as
      | { book: ApiBook }
      | { error: { code: string; message: string; details?: { bookId?: string } } }
      | null;

    setPending(false);

    if (!res?.ok || !data || !("book" in data)) {
      // The form keeps its contents on failure — retyping a manual entry is the
      // most annoying thing this app could do to you.
      setError(
        data && "error" in data ? data.error.message : "Couldn't save that book.",
      );
      return;
    }

    // Manual entries usually want a look-over, so go to the book itself.
    router.push(`/book/${data.book.id}`);
  }

  return (
    <form onSubmit={submit} className="mt-6 max-w-xl space-y-4">
      <Field label="Title" htmlFor="m-title">
        <input
          id="m-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClass}
        />
      </Field>

      <Field label="Subtitle" htmlFor="m-subtitle">
        <input id="m-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputClass} />
      </Field>

      <Field label="Authors" hint="(comma separated)" htmlFor="m-authors">
        <input id="m-authors" value={authors} onChange={(e) => setAuthors(e.target.value)} className={inputClass} />
      </Field>

      <Field label="ISBN" hint="(optional)" htmlFor="m-isbn">
        <input
          id="m-isbn"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          inputMode="numeric"
          className={`${inputClass} tabular`}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Publisher" htmlFor="m-publisher">
          <input id="m-publisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Year" htmlFor="m-year">
          <input id="m-year" value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" className={`${inputClass} tabular`} />
        </Field>
        <Field label="Pages" htmlFor="m-pages">
          <input id="m-pages" value={pages} onChange={(e) => setPages(e.target.value)} inputMode="numeric" className={`${inputClass} tabular`} />
        </Field>
        <Field label="Genre" htmlFor="m-genre">
          <input id="m-genre" value={genre} onChange={(e) => setGenre(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Format" htmlFor="m-format">
          <select id="m-format" value={format} onChange={(e) => setFormat(e.target.value as BookFormat)} className={`${inputClass} capitalize`}>
            {BOOK_FORMATS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Field>
        <Field label="Status" htmlFor="m-status">
          <select id="m-status" value={status} onChange={(e) => setStatus(e.target.value as ReadStatus)} className={`${inputClass} capitalize`}>
            {READ_STATUSES.map((s) => (
              <option key={s} value={s}>{s === "dnf" ? "Did not finish" : s}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Tags" hint="(comma separated)" htmlFor="m-tags">
        <input id="m-tags" value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} />
      </Field>

      <Field label="Notes" htmlFor="m-notes">
        <textarea id="m-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className={inputClass} />
      </Field>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-card bg-accent px-4 text-sm font-medium text-paper disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save to library"}
      </button>
    </form>
  );
}
