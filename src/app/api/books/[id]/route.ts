import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { serializeStringArray } from "@/db/serde";
import {
  clampPage,
  deriveStatusChanges,
  toApiBook,
  updateBookSchema,
} from "@/lib/books";
import { apiError, apiOk } from "@/lib/http";
import { parseIsbn } from "@/lib/isbn";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const book = await db.select().from(books).where(eq(books.id, id)).get();

  if (!book) return apiError("NOT_FOUND", "No such book.");
  return apiOk({ book: toApiBook(book) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const parsed = updateBookSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "Some fields need fixing.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const db = await getDb();
  const existing = await db.select().from(books).where(eq(books.id, id)).get();
  if (!existing) return apiError("NOT_FOUND", "No such book.");

  const input = parsed.data;
  const patch: Record<string, unknown> = {};

  // Copy through only the keys actually present, so an omitted field is left
  // alone rather than nulled.
  for (const key of [
    "title",
    "subtitle",
    "publisher",
    "publishedYear",
    "pageCount",
    "genre",
    "format",
    "language",
    "description",
    "coverUrl",
    "coverColor",
    "readStatus",
    "rating",
    "notes",
    "currentPage",
    "startedAt",
    "finishedAt",
  ] as const) {
    if (key in input && input[key] !== undefined) patch[key] = input[key];
  }

  if (input.authors) patch.authors = serializeStringArray(input.authors);
  if (input.tags) patch.tags = serializeStringArray(input.tags);

  if (input.isbn13 !== undefined || input.isbn10 !== undefined) {
    const raw = input.isbn13 || input.isbn10;
    if (!raw) {
      patch.isbn13 = null;
      patch.isbn10 = null;
    } else {
      const identifier = parseIsbn(raw);
      if (!identifier) return apiError("INVALID_ISBN", "That ISBN isn't valid.");
      patch.isbn13 = identifier.isbn13;
      patch.isbn10 = identifier.isbn10;
    }
  }

  // Business rules run server-side, never only in the UI — but they are
  // DEFAULTS. A date you typed in the same request must survive: assigning
  // derived over the patch would silently replace "I finished this in March"
  // with today.
  const derived = deriveStatusChanges(
    existing,
    input.readStatus,
    input.pageCount ?? existing.pageCount,
  );
  for (const [key, value] of Object.entries(derived)) {
    if (!(key in patch)) patch[key] = value;
  }

  const effectivePageCount =
    (patch.pageCount as number | null | undefined) ?? existing.pageCount;
  if (patch.currentPage !== undefined) {
    patch.currentPage = clampPage(patch.currentPage as number, effectivePageCount);
  } else if (patch.pageCount !== undefined) {
    // Lowering pageCount can strand currentPage past the new end.
    patch.currentPage = clampPage(existing.currentPage, effectivePageCount);
  }

  // Never trusted from the client.
  patch.updatedAt = new Date().toISOString();

  try {
    await db.update(books).set(patch).where(eq(books.id, id));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("UNIQUE") || message.includes("2067")) {
      return apiError("DUPLICATE_ISBN", "Another book already has that ISBN.");
    }
    throw error;
  }

  const updated = await db.select().from(books).where(eq(books.id, id)).get();
  return apiOk({ book: updated ? toApiBook(updated) : null });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();

  const existing = await db
    .select({ id: books.id, title: books.title })
    .from(books)
    .where(eq(books.id, id))
    .get();
  if (!existing) return apiError("NOT_FOUND", "No such book.");

  await db.delete(books).where(eq(books.id, id));
  return apiOk({ deleted: existing.id, title: existing.title });
}
