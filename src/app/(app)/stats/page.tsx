import Link from "next/link";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { parseStringArray } from "@/db/serde";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stats · Stacks" };

/**
 * Facts about the COLLECTION, not about reading over time.
 *
 * There is deliberately no books-per-year chart, no heatmap and no streak.
 * `finished_at` is stamped when you change a book's status, which for a shelf
 * catalogued in one sitting is the day you catalogued it — not the day you read
 * it. Charting that would produce a confident, wrong picture of your reading.
 * Those views become worth building once the dates are real; the edit form now
 * lets you correct them.
 */

const STATUS_LABEL: Record<string, string> = {
  unread: "Unread",
  reading: "Reading",
  finished: "Finished",
  dnf: "Did not finish",
};

function Bar({ label, count, total, href }: { label: string; count: number; total: number; href?: string }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-ink-muted tabular">
          {count} <span className="text-ink-faint">· {percent}%</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunk">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
    </>
  );

  return (
    <li>
      {href ? (
        <Link href={href} className="block rounded-card py-1 transition-colors hover:bg-surface-sunk">
          {body}
        </Link>
      ) : (
        <div className="py-1">{body}</div>
      )}
    </li>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-rule pt-6">
      <h2 className="text-sm font-medium">{title}</h2>
      {note ? <p className="mt-1 text-xs text-ink-faint">{note}</p> : null}
      <ul className="mt-3 space-y-2">{children}</ul>
    </section>
  );
}

export default async function StatsPage() {
  const db = await getDb();
  const all = await db.select().from(books);
  const total = all.length;

  if (total === 0) {
    return (
      <>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Stats</h1>
        <p className="mt-4 text-sm text-ink-muted">
          Nothing to count yet.{" "}
          <Link href="/add" className="underline">
            Add a book
          </Link>
          .
        </p>
      </>
    );
  }

  const tally = <T extends string | number>(values: Iterable<T>) => {
    const map = new Map<T, number>();
    for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  const byStatus = tally(all.map((b) => b.readStatus));
  const byGenre = tally(all.map((b) => b.genre).filter((g): g is string => Boolean(g)));
  const byFormat = tally(all.map((b) => b.format));
  const byDecade = tally(
    all.map((b) => b.publishedYear).filter((y): y is number => Boolean(y)).map((y) => Math.floor(y / 10) * 10),
  ).sort((a, b) => a[0] - b[0]);

  const authorCounts = tally(all.flatMap((b) => parseStringArray(b.authors)));
  const repeatAuthors = authorCounts.filter(([, n]) => n > 1);

  const rated = all.filter((b) => b.rating);
  const pages = all.map((b) => b.pageCount).filter((p): p is number => Boolean(p));
  const totalPages = pages.reduce((sum, p) => sum + p, 0);
  const noGenre = total - byGenre.reduce((sum, [, n]) => sum + n, 0);

  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Stats</h1>
      <p className="mt-2 text-sm text-ink-muted tabular">
        {total} books · {totalPages.toLocaleString()} pages across {pages.length} with a known
        length
      </p>

      <Section title="Status">
        {byStatus.map(([status, count]) => (
          <Bar
            key={status}
            label={STATUS_LABEL[status] ?? status}
            count={count}
            total={total}
            href={`/?status=${status}`}
          />
        ))}
      </Section>

      <Section
        title="Genre"
        note={noGenre > 0 ? `${noGenre} without a genre` : undefined}
      >
        {byGenre.length === 0 ? (
          <li className="text-sm text-ink-muted">No genres recorded.</li>
        ) : (
          byGenre.map(([genre, count]) => (
            <Bar
              key={genre}
              label={genre}
              count={count}
              total={total}
              href={`/?genre=${encodeURIComponent(genre)}`}
            />
          ))
        )}
      </Section>

      <Section title="Published" note="By decade — when the editions on your shelf were printed.">
        {byDecade.map(([decade, count]) => (
          <Bar key={decade} label={`${decade}s`} count={count} total={total} />
        ))}
      </Section>

      <Section title="Format">
        {byFormat.map(([format, count]) => (
          <Bar
            key={format}
            label={format[0].toUpperCase() + format.slice(1)}
            count={count}
            total={total}
            href={`/?format=${format}`}
          />
        ))}
      </Section>

      <Section
        title="Authors you own more than one of"
        note={`${authorCounts.length} authors in total`}
      >
        {repeatAuthors.length === 0 ? (
          <li className="text-sm text-ink-muted">No repeats yet.</li>
        ) : (
          repeatAuthors.map(([author, count]) => (
            <Bar
              key={author}
              label={author}
              count={count}
              total={total}
              href={`/?q=${encodeURIComponent(author)}`}
            />
          ))
        )}
      </Section>

      <Section title="Ratings" note={rated.length === 0 ? "Nothing rated yet." : undefined}>
        {rated.length === 0 ? (
          <li className="text-sm text-ink-muted">
            Long-press books in the library and choose Rate to do several at once.
          </li>
        ) : (
          [5, 4, 3, 2, 1].map((stars) => (
            <Bar
              key={stars}
              label={"★".repeat(stars)}
              count={rated.filter((b) => b.rating === stars).length}
              total={rated.length}
            />
          ))
        )}
      </Section>

      <p className="mt-10 max-w-prose text-xs text-ink-faint">
        No reading-over-time charts here on purpose. Finish dates are stamped when a
        book&apos;s status changes, so for a shelf catalogued in one sitting they record
        when you catalogued it, not when you read it. Correct them on a book&apos;s edit
        page and those views become worth building.
      </p>
    </>
  );
}
