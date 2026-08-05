import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { booksToCsv, csvFilename } from "@/lib/csv";

/**
 * Full-library CSV export — the backup that makes every other risk in this app
 * survivable.
 *
 * Not paginated: exporting a partial library would defeat the point, and a few
 * thousand rows is nothing.
 */
export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(books).orderBy(asc(books.createdAt));

  const csv = booksToCsv(rows);

  return new Response(csv, {
    headers: {
      // charset matters as much as the BOM for anything that isn't Excel.
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${csvFilename()}"`,
      "cache-control": "no-store",
    },
  });
}
