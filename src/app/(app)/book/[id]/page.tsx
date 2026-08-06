import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoverColorProbe } from "@/components/book/CoverColorProbe";
import { CoverImage } from "@/components/book/CoverImage";
import { ReadingPanel } from "@/components/book/ReadingPanel";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { formatAuthors, parseStringArray } from "@/db/serde";
import { toApiBook } from "@/lib/books";
import { BookActions } from "./BookActions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  unread: "Unread",
  reading: "Reading",
  finished: "Finished",
  dnf: "Did not finish",
};

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getDb();
  const book = await db.select().from(books).where(eq(books.id, id)).get();

  if (!book) notFound();

  const authors = parseStringArray(book.authors);
  const tags = parseStringArray(book.tags);

  const facts: Array<[string, string | number | null]> = [
    ["Publisher", book.publisher],
    ["Published", book.publishedYear],
    ["Pages", book.pageCount],
    ["Format", book.format],
    ["Language", book.language],
    ["Genre", book.genre],
    ["ISBN", book.isbn13],
    ["Added", book.createdAt.slice(0, 10)],
    ["Started", book.startedAt],
    ["Finished", book.finishedAt],
  ];

  return (
    <>
      {/* Only set the variable when we already know the colour. Leaving it unset
          lets the probe below fill it in at the root without being overridden. */}
      <div
        className="-mx-4 -mt-4 px-4 pb-6 pt-4"
        style={
          book.coverColor
            ? ({ "--book-accent": book.coverColor } as React.CSSProperties)
            : undefined
        }
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-90"
          style={{
            background:
              "linear-gradient(to bottom, var(--book-accent, var(--surface-sunk)) 0%, transparent 100%)",
          }}
        />

        <div className="relative">
          <Link href="/" className="text-sm underline opacity-80">
            ← Library
          </Link>

          <div className="mt-4 flex flex-col gap-5 sm:flex-row">
            <div className="h-[240px] w-40 shrink-0 self-start overflow-hidden rounded-cover border border-rule shadow-lg">
              <CoverImage
                src={book.coverUrl}
                title={book.title}
                authors={formatAuthors(book.authors)}
                coverColor={book.coverColor}
                className="h-full w-full"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">
                {book.title}
              </h1>
              {book.subtitle ? (
                <p className="mt-1 font-display text-lg opacity-75">{book.subtitle}</p>
              ) : null}
              <p className="mt-2 text-sm">
                {authors.length > 0 ? authors.join(", ") : "Unknown author"}
              </p>

              <p className="mt-3 inline-flex items-center rounded-full bg-surface px-3 py-1 text-xs font-medium">
                {STATUS_LABEL[book.readStatus] ?? book.readStatus}
                {book.readStatus === "reading" && book.pageCount ? (
                  <span className="ml-2 tabular opacity-70">
                    {book.currentPage} / {book.pageCount}
                  </span>
                ) : null}
              </p>

              <BookActions bookId={book.id} title={book.title} />
            </div>
          </div>
        </div>
      </div>

      <ReadingPanel book={toApiBook(book)} />

      <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {facts
          .filter(([, value]) => value !== null && value !== "")
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="capitalize tabular">{value}</dd>
            </div>
          ))}
      </dl>

      {tags.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag} className="rounded-full bg-surface-sunk px-3 py-1 text-xs text-ink-muted">
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      {book.description ? (
        <section className="mt-8 max-w-prose">
          <h2 className="text-sm font-medium text-ink-muted">Description</h2>
          {/* Provider text, rendered as text — never as HTML. */}
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{book.description}</p>
        </section>
      ) : null}

      <CoverColorProbe
        bookId={book.id}
        coverUrl={book.coverUrl}
        hasColor={Boolean(book.coverColor)}
      />
    </>
  );
}
