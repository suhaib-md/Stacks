import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoverImage } from "@/components/book/CoverImage";
import { ReadingPanel } from "@/components/book/ReadingPanel";
import { RefreshMetadata } from "@/components/book/RefreshMetadata";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { formatAuthors, parseStringArray } from "@/db/serde";
import { toApiBook } from "@/lib/books";
import { isIncomplete } from "@/lib/refresh";
import { BookActions } from "./BookActions";

export const dynamic = "force-dynamic";

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
      <Link href="/" className="lbl text-ink-muted hover:text-ink">
        &larr; Library
      </Link>

      {/* The book as a record sheet: cover on the left, the entry beside it.
          No gradient header and no elevation — regions are divided by rules. */}
      <div className="mt-4 flex flex-col gap-6 border-t-2 border-rule pt-6 md:flex-row md:gap-10">
        <div className="w-40 shrink-0 md:w-48">
          <div
            className={`aspect-[2/3] w-full overflow-hidden border-2 border-rule ${
              book.readStatus === "dnf" ? "opacity-50" : ""
            }`}
          >
            <CoverImage
              src={book.coverUrl}
              title={book.title}
              authors={formatAuthors(book.authors)}
              coverColor={book.coverColor}
              className="h-full w-full"
            />
          </div>
          <BookActions bookId={book.id} title={book.title} />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[34px] leading-[1.02] md:text-[46px]">
            {book.title}
          </h1>
          {book.subtitle ? (
            <p className="mt-2 font-display text-lg text-ink-muted">{book.subtitle}</p>
          ) : null}
          <p className="mt-3 text-[13px]">
            {authors.length > 0 ? authors.join(", ") : "Unknown author"}
          </p>
          <p className="lbl mt-2 text-ink-muted">
            {[book.genre, book.publishedYear].filter(Boolean).join(" · ")}
          </p>

          <ReadingPanel book={toApiBook(book)} />

          {isIncomplete(book) ? <RefreshMetadata bookId={book.id} /> : null}

          {/* The entry — every catalogued field, one ruled row each. */}
          <section className="mt-8 border-t-2 border-rule pt-4">
            <h2 className="lbl text-accent">The entry</h2>
            <dl className="mt-3">
              {facts
                .filter(([, value]) => value !== null && value !== "")
                .map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-baseline gap-4 border-b border-rule-minor py-2"
                  >
                    <dt className="lbl w-28 shrink-0 text-ink-muted">{label}</dt>
                    <dd className="min-w-0 flex-1 text-[13px] capitalize tabular">{value}</dd>
                  </div>
                ))}
            </dl>
          </section>

          {tags.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li key={tag} className="border-2 border-rule px-2 py-1 text-[11px] text-ink-muted">
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}

          {book.description ? (
            <section className="mt-8 max-w-prose border-t-2 border-rule pt-4">
              <h2 className="lbl text-accent">Description</h2>
              {/* Provider text, rendered as text — never as HTML. */}
              <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed">
                {book.description}
              </p>
            </section>
          ) : null}
        </div>
      </div>

    </>
  );
}
