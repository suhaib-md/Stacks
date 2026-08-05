import { and, asc, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { books, type Book } from "@/db/schema";
import { parseStringArray, serializeStringArray } from "@/db/serde";
import {
  createBookSchema,
  isProbableDuplicate,
  toApiBook,
  type ApiBook,
} from "@/lib/books";
import { apiError, apiOk } from "@/lib/http";
import { parseIsbn } from "@/lib/isbn";

const SORTABLE = {
  created: books.createdAt,
  title: books.title,
  author: books.authors,
  rating: books.rating,
  finished: books.finishedAt,
} as const;

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const db = await getDb();

  const filters: SQL[] = [];

  const q = params.get("q")?.trim();
  if (q) {
    const needle = `%${q.toLowerCase()}%`;
    // LIKE over a few hundred rows is entirely adequate; the upgrade path if it
    // ever isn't is an FTS5 virtual table, not a rewrite.
    const match = or(
      like(sql`lower(${books.title})`, needle),
      like(sql`lower(${books.authors})`, needle),
      like(sql`lower(${books.notes})`, needle),
    );
    if (match) filters.push(match);
  }

  const status = params.get("status");
  if (status) filters.push(eq(books.readStatus, status as Book["readStatus"]));

  const genre = params.get("genre");
  if (genre) filters.push(eq(books.genre, genre));

  const format = params.get("format");
  if (format) filters.push(eq(books.format, format as Book["format"]));

  const where = filters.length > 0 ? and(...filters) : undefined;

  const sortKey = (params.get("sort") ?? "created") as keyof typeof SORTABLE;
  const column = SORTABLE[sortKey] ?? books.createdAt;
  const direction = params.get("order") === "asc" ? asc : desc;

  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Number.parseInt(params.get("perPage") ?? "60", 10) || 60),
  );

  const [rows, counted] = await Promise.all([
    db
      .select()
      .from(books)
      .where(where)
      .orderBy(direction(column))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ total: sql<number>`count(*)` }).from(books).where(where),
  ]);

  return apiOk({
    items: rows.map(toApiBook),
    total: counted[0]?.total ?? 0,
    page,
    perPage,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createBookSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "Some fields need fixing.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const input = parsed.data;
  const db = await getDb();

  // Normalize any supplied ISBN to bare ISBN-13 before it can be stored or
  // compared. A malformed one is rejected rather than silently stored.
  let isbn13: string | null = null;
  let isbn10: string | null = input.isbn10 ?? null;
  if (input.isbn13 || input.isbn10) {
    const identifier = parseIsbn(input.isbn13 || input.isbn10 || "");
    if (!identifier) {
      return apiError("INVALID_ISBN", "That ISBN isn't valid.");
    }
    isbn13 = identifier.isbn13;
    isbn10 = identifier.isbn10;
  }

  // Exact duplicate: hard block, with the existing book so the UI can link to it.
  if (isbn13) {
    const existing = await db
      .select({ id: books.id, title: books.title })
      .from(books)
      .where(eq(books.isbn13, isbn13))
      .get();

    if (existing) {
      return apiError("DUPLICATE_ISBN", "That book is already in your library.", {
        details: { bookId: existing.id, title: existing.title },
      });
    }
  }

  // Soft duplicate: same title and author, different or absent ISBN. Never
  // blocks — second copies and alternate editions are legitimate.
  const candidates = await db
    .select({ id: books.id, title: books.title, authors: books.authors })
    .from(books);

  const probable = candidates.find((candidate) =>
    isProbableDuplicate(
      { title: candidate.title, authors: parseStringArray(candidate.authors) },
      { title: input.title, authors: input.authors },
    ),
  );

  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    isbn13,
    isbn10,
    title: input.title,
    subtitle: input.subtitle,
    authors: serializeStringArray(input.authors),
    publisher: input.publisher,
    publishedYear: input.publishedYear ?? null,
    pageCount: input.pageCount ?? null,
    genre: input.genre,
    tags: serializeStringArray(input.tags),
    format: input.format,
    language: input.language,
    description: input.description,
    coverUrl: input.coverUrl ?? null,
    coverColor: null,
    readStatus: input.readStatus,
    currentPage: 0,
    rating: input.rating ?? null,
    notes: input.notes,
    // Reading dates are applied by the PATCH handler's transition rules; a book
    // created directly as "reading" gets its start date here.
    startedAt: input.readStatus === "reading" ? now.slice(0, 10) : null,
    finishedAt:
      input.readStatus === "finished" || input.readStatus === "dnf"
        ? now.slice(0, 10)
        : null,
    source: input.source,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.insert(books).values(row);
  } catch (error) {
    // The unique index is the real guarantee; the pre-check above only exists to
    // produce a better message. This catches the concurrent-insert race.
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("UNIQUE") || message.includes("2067")) {
      return apiError("DUPLICATE_ISBN", "That book is already in your library.");
    }
    throw error;
  }

  const created: ApiBook = toApiBook(row as Book);

  return apiOk(
    {
      book: created,
      warnings: probable
        ? [
            {
              code: "POSSIBLE_DUPLICATE" as const,
              message: "You may already own this.",
              bookId: probable.id,
            },
          ]
        : [],
    },
    201,
  );
}
