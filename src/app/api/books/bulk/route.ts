import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { parseStringArray, serializeStringArray } from "@/db/serde";
import { bulkPatchSchema, deriveStatusChanges } from "@/lib/books";
import { apiError, apiOk } from "@/lib/http";

/**
 * Bulk status / tag / genre updates.
 *
 * Applied as a single `db.batch`, so it is one D1 round trip and either all of
 * it lands or none of it does. Per-row work is unavoidable because status
 * transitions and tag merges depend on each row's current values.
 */
export async function PATCH(req: Request) {
  const parsed = bulkPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "That bulk update isn't valid.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { ids, patch } = parsed.data;
  const db = await getDb();

  const rows = await db.select().from(books).where(inArray(books.id, ids));
  if (rows.length === 0) return apiError("NOT_FOUND", "None of those books exist.");

  const now = new Date().toISOString();

  const statements = rows.map((row) => {
    const changes: Record<string, unknown> = { updatedAt: now };

    if (patch.readStatus) {
      changes.readStatus = patch.readStatus;
      Object.assign(changes, deriveStatusChanges(row, patch.readStatus, row.pageCount));
    }

    if (patch.genre !== undefined) changes.genre = patch.genre || null;
    if (patch.rating !== undefined) changes.rating = patch.rating ?? null;

    if (patch.addTags?.length) {
      // Union, not replace — bulk tagging should never drop existing tags.
      const merged = new Set([...parseStringArray(row.tags), ...patch.addTags]);
      changes.tags = serializeStringArray([...merged]);
    }

    return db.update(books).set(changes).where(inArray(books.id, [row.id]));
  });

  if (statements.length > 0) {
    await db.batch(statements as [(typeof statements)[number], ...typeof statements]);
  }

  return apiOk({ updated: rows.length });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((v): v is string => typeof v === "string")
    : [];

  if (ids.length === 0) {
    return apiError("VALIDATION_FAILED", "No books were selected.");
  }

  const db = await getDb();
  const result = await db.delete(books).where(inArray(books.id, ids));
  return apiOk({ deleted: ids.length, meta: result.meta?.changes ?? null });
}
