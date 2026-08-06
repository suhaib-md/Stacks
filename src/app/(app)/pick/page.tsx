import { and, eq, isNotNull, sql } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { PickShuffle } from "./PickShuffle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pick for me · Stacks" };

/**
 * Answers "what should I read next?" from the unread shelf.
 *
 * Shuffling happens on the client from a list the server sends, not by
 * re-querying: a re-roll should be instant, and an unread shelf is small enough
 * that sending it whole costs nothing.
 */
export default async function PickPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const genre = typeof raw.genre === "string" ? raw.genre : null;

  const db = await getDb();

  const where = genre
    ? and(eq(books.readStatus, "unread"), eq(books.genre, genre))
    : eq(books.readStatus, "unread");

  const [pool, genreRows] = await Promise.all([
    db.select().from(books).where(where),
    db
      .selectDistinct({ genre: books.genre })
      .from(books)
      .where(and(eq(books.readStatus, "unread"), isNotNull(books.genre)))
      .orderBy(books.genre),
  ]);

  const genres = genreRows.map((r) => r.genre).filter((g): g is string => Boolean(g));

  const [{ unreadTotal }] = await db
    .select({ unreadTotal: sql<number>`count(*)` })
    .from(books)
    .where(eq(books.readStatus, "unread"));

  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Pick for me</h1>
      <p className="mt-2 text-sm text-ink-muted">
        {unreadTotal === 0
          ? "Nothing unread — you're all caught up."
          : `${unreadTotal} unread ${unreadTotal === 1 ? "book" : "books"} on the shelf.`}
      </p>

      {genres.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/pick"
            aria-current={genre === null ? "page" : undefined}
            className={`min-h-9 rounded-full px-3 text-xs font-medium leading-9 ${
              genre === null
                ? "border border-accent bg-accent-soft text-accent"
                : "bg-surface-sunk text-ink-muted"
            }`}
          >
            Any genre
          </Link>
          {genres.map((g) => (
            <Link
              key={g}
              href={`/pick?genre=${encodeURIComponent(g)}`}
              aria-current={genre === g ? "page" : undefined}
              className={`min-h-9 rounded-full px-3 text-xs font-medium leading-9 ${
                genre === g
                  ? "border border-accent bg-accent-soft text-accent"
                  : "bg-surface-sunk text-ink-muted"
              }`}
            >
              {g}
            </Link>
          ))}
        </div>
      ) : null}

      <PickShuffle books={pool} />
    </>
  );
}
