import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { apiError, apiOk } from "@/lib/http";

/**
 * Phase 0 exit check: proves the D1 binding resolves and the schema is applied.
 * Kept past Phase 0 as a deploy smoke test.
 */
export async function GET() {
  try {
    const db = await getDb();
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(books);

    return apiOk({
      ok: true,
      database: "connected",
      books: count,
      time: new Date().toISOString(),
    });
  } catch (error) {
    return apiError("INTERNAL", "Database check failed.", {
      details: { message: error instanceof Error ? error.message : String(error) },
    });
  }
}
