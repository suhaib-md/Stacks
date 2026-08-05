import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { toApiBook } from "@/lib/books";
import { EditForm } from "./EditForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit · Stacks" };

export default async function EditBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getDb();
  const book = await db.select().from(books).where(eq(books.id, id)).get();

  if (!book) notFound();

  return <EditForm book={toApiBook(book)} />;
}
