import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { parseStringArray } from "@/db/serde";

export const dynamic = "force-dynamic";

/**
 * Minimal for now — enough to verify what was saved and to give the confirm
 * sheet's "View it" link somewhere real to land. The dominant-colour header,
 * status control, progress, rating and notes all arrive in Phases 3 and 4.
 */
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
    ["ISBN-13", book.isbn13],
    ["Status", book.readStatus],
  ];

  return (
    <>
      <Link href="/" className="text-sm text-ink-muted underline">
        ← Library
      </Link>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row">
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote covers are unoptimized by design
          <img
            src={book.coverUrl}
            alt={`Cover of ${book.title}${authors.length ? ` by ${authors.join(", ")}` : ""}`}
            width={160}
            height={240}
            className="h-[240px] w-40 shrink-0 self-start rounded-cover border border-rule object-cover"
          />
        ) : (
          <div className="flex h-[240px] w-40 shrink-0 items-center justify-center rounded-cover border border-rule bg-surface-sunk p-3 text-center font-display text-sm text-ink-muted">
            {book.title}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">
            {book.title}
          </h1>
          {book.subtitle ? (
            <p className="mt-1 font-display text-lg text-ink-muted">{book.subtitle}</p>
          ) : null}
          <p className="mt-2 text-sm">
            {authors.length > 0 ? authors.join(", ") : "Unknown author"}
          </p>

          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
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
                <li
                  key={tag}
                  className="rounded-full bg-surface-sunk px-3 py-1 text-xs text-ink-muted"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {book.description ? (
        <div className="mt-8 max-w-prose">
          <h2 className="text-sm font-medium text-ink-muted">Description</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
            {book.description}
          </p>
        </div>
      ) : null}

      {book.notes ? (
        <div className="mt-8 max-w-prose">
          <h2 className="text-sm font-medium text-ink-muted">Notes</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{book.notes}</p>
        </div>
      ) : null}
    </>
  );
}
