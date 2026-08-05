import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { InstallPrompt } from "./InstallPrompt";
import { SignOutButton } from "./SignOutButton";
import { ThemeToggle } from "./ThemeToggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Stacks" };

const STATUS_LABEL: Record<string, string> = {
  unread: "Unread",
  reading: "Reading",
  finished: "Finished",
  dnf: "Did not finish",
};

export default async function SettingsPage() {
  const db = await getDb();

  const [totals, byStatus] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(books),
    db
      .select({ status: books.readStatus, count: sql<number>`count(*)` })
      .from(books)
      .groupBy(books.readStatus),
  ]);

  const total = totals[0]?.total ?? 0;

  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Your library</h2>
        <p className="mt-1 text-sm text-ink-muted tabular">
          {total} {total === 1 ? "book" : "books"}
          {byStatus.length > 0
            ? ` · ${byStatus
                .map((row) => `${row.count} ${STATUS_LABEL[row.status]?.toLowerCase() ?? row.status}`)
                .join(" · ")}`
            : ""}
        </p>
      </section>

      <section className="mt-8 border-t border-rule pt-6">
        <h2 className="text-sm font-medium">Backup</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Everything you own, as a spreadsheet. Descriptions are left out — they come
          from the catalogues, not from you, and the ISBN recovers them.
        </p>
        {/* A plain link, not fetch(): lets the browser handle the download and
            the filename without any JavaScript in the way. */}
        <a
          href="/api/export/csv"
          download
          className="mt-3 inline-flex min-h-11 items-center rounded-card bg-accent px-4 text-sm font-medium text-paper"
        >
          Export CSV
        </a>
      </section>

      <section className="mt-8 border-t border-rule pt-6">
        <h2 className="text-sm font-medium">Install</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Adds Stacks to your home screen and keeps your library readable without a
          connection.
        </p>
        <InstallPrompt />
      </section>

      <section className="mt-8 border-t border-rule pt-6">
        <h2 className="text-sm font-medium">Theme</h2>
        <ThemeToggle />
      </section>

      <section className="mt-8 border-t border-rule pt-6">
        <SignOutButton />
      </section>
    </>
  );
}
