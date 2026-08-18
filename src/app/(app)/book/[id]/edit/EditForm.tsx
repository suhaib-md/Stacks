"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CoverPicker } from "@/components/book/CoverPicker";
import { BOOK_FORMATS, READ_STATUSES, type BookFormat, type ReadStatus } from "@/db/schema";
import type { ApiBook } from "@/lib/books";
import { isValidIsbn } from "@/lib/isbn";

const inputClass =
"w-full border-2 border-rule bg-surface-sunk px-3 py-2 text-sm outline-none";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
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

export function EditForm({ book }: { book: ApiBook }) {
  const router = useRouter();

  const [form, setForm] = useState({
    title: book.title,
    subtitle: book.subtitle ?? "",
    authors: book.authors.join(", "),
    isbn13: book.isbn13 ?? "",
    publisher: book.publisher ?? "",
    publishedYear: book.publishedYear?.toString() ?? "",
    pageCount: book.pageCount?.toString() ?? "",
    genre: book.genre ?? "",
    tags: book.tags.join(", "),
    format: book.format as BookFormat,
    language: book.language ?? "",
    readStatus: book.readStatus as ReadStatus,
    rating: book.rating?.toString() ?? "",
    coverUrl: book.coverUrl ?? "",
    description: book.description ?? "",
    notes: book.notes ?? "",
    startedAt: book.startedAt ?? "",
    finishedAt: book.finishedAt ?? "",
  });

  // Kept outside `form` because it's null-or-hex rather than a text field.
  const [coverColor, setCoverColor] = useState<string | null>(book.coverColor);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const numberOrNull = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (form.title.trim().length === 0) {
      setError("A title is required.");
      return;
    }
    if (form.isbn13.trim() && !isValidIsbn(form.isbn13.trim())) {
      setError("That ISBN isn't valid. Correct it or clear it.");
      return;
    }

    setPending(true);

    const res = await fetch(`/api/books/${book.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        authors: form.authors.split(",").map((a) => a.trim()).filter(Boolean),
        isbn13: form.isbn13.trim() || null,
        publisher: form.publisher.trim() || null,
        publishedYear: numberOrNull(form.publishedYear),
        pageCount: numberOrNull(form.pageCount),
        genre: form.genre.trim() || null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        format: form.format,
        language: form.language.trim() || null,
        readStatus: form.readStatus,
        rating: numberOrNull(form.rating),
        coverUrl: form.coverUrl.trim() || null,
        coverColor,
        startedAt: form.startedAt || null,
        finishedAt: form.finishedAt || null,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
      }),
    }).catch(() => null);

    const data = (await res?.json().catch(() => null)) as
      | { book: ApiBook }
      | { error: { message: string } }
      | null;

    setPending(false);

    if (!res?.ok || !data || !("book" in data)) {
      // The form keeps its contents — never make someone retype an edit.
      setError(data && "error" in data ? data.error.message : "Couldn't save those changes.");
      return;
    }

    router.push(`/book/${book.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="disp text-[28px]">Edit book</h1>
        <Link href={`/book/${book.id}`} className="text-sm text-ink-muted underline">
          Cancel
        </Link>
      </div>

      <Field label="Title" htmlFor="e-title">
        <input id="e-title" value={form.title} onChange={(e) => set("title", e.target.value)} required className={inputClass} />
      </Field>

      <Field label="Subtitle" htmlFor="e-subtitle">
        <input id="e-subtitle" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} className={inputClass} />
      </Field>

      <Field label="Authors" hint="(comma separated)" htmlFor="e-authors">
        <input id="e-authors" value={form.authors} onChange={(e) => set("authors", e.target.value)} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="ISBN" htmlFor="e-isbn">
          <input id="e-isbn" value={form.isbn13} onChange={(e) => set("isbn13", e.target.value)} inputMode="numeric" className={`${inputClass} tabular`} />
        </Field>
        <Field label="Publisher" htmlFor="e-publisher">
          <input id="e-publisher" value={form.publisher} onChange={(e) => set("publisher", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Year" htmlFor="e-year">
          <input id="e-year" value={form.publishedYear} onChange={(e) => set("publishedYear", e.target.value)} inputMode="numeric" className={`${inputClass} tabular`} />
        </Field>
        <Field label="Pages" htmlFor="e-pages">
          <input id="e-pages" value={form.pageCount} onChange={(e) => set("pageCount", e.target.value)} inputMode="numeric" className={`${inputClass} tabular`} />
        </Field>
        <Field label="Genre" htmlFor="e-genre">
          <input id="e-genre" value={form.genre} onChange={(e) => set("genre", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Language" htmlFor="e-language">
          <input id="e-language" value={form.language} onChange={(e) => set("language", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Format" htmlFor="e-format">
          <select id="e-format" value={form.format} onChange={(e) => set("format", e.target.value as BookFormat)} className={`${inputClass} capitalize`}>
            {BOOK_FORMATS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Field>
        <Field label="Status" htmlFor="e-status">
          <select id="e-status" value={form.readStatus} onChange={(e) => set("readStatus", e.target.value as ReadStatus)} className={`${inputClass} capitalize`}>
            {READ_STATUSES.map((s) => (
              <option key={s} value={s}>{s === "dnf" ? "Did not finish" : s}</option>
            ))}
          </select>
        </Field>
        <Field label="Rating" hint="(1–5, blank to clear)" htmlFor="e-rating">
          <select id="e-rating" value={form.rating} onChange={(e) => set("rating", e.target.value)} className={inputClass}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{"★".repeat(n)}</option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1 text-xs font-medium text-ink-muted">
          Reading dates
          <span className="ml-1 text-ink-faint">
            (stamped automatically when you change status — correct them here)
          </span>
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Started" htmlFor="e-started">
            <input
              id="e-started"
              type="date"
              value={form.startedAt}
              onChange={(e) => set("startedAt", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Finished" htmlFor="e-finished">
            <input
              id="e-finished"
              type="date"
              value={form.finishedAt}
              onChange={(e) => set("finishedAt", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </fieldset>

      <Field label="Tags" hint="(comma separated)" htmlFor="e-tags">
        <input id="e-tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} className={inputClass} />
      </Field>

      <CoverPicker
        title={form.title}
        authors={form.authors}
        coverUrl={form.coverUrl}
        value={coverColor}
        onChange={setCoverColor}
      />

      <Field label="Cover URL" hint="(clear this to use the generated cover)" htmlFor="e-cover">
        <input id="e-cover" value={form.coverUrl} onChange={(e) => set("coverUrl", e.target.value)} className={inputClass} />
      </Field>

      <Field label="Description" htmlFor="e-description">
        <textarea id="e-description" value={form.description} onChange={(e) => set("description", e.target.value)} rows={5} className={inputClass} />
      </Field>

      <Field label="Notes" htmlFor="e-notes">
        <textarea id="e-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={4} className={inputClass} />
      </Field>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
