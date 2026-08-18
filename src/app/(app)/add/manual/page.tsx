import { AddNav } from "@/components/book/AddNav";
import { ManualAdd } from "./ManualAdd";

export const metadata = { title: "Add manually · Stacks" };

export default async function ManualPage({
  searchParams,
}: {
  searchParams: Promise<{ isbn?: string; title?: string }>;
}) {
  const { isbn, title } = await searchParams;

  return (
    <>
      <h1 className="disp text-[34px] md:text-[40px]">Add a book</h1>
      <AddNav />
      <p className="mt-4 max-w-prose text-sm text-ink-muted">
        For books the catalogues don&apos;t have — older printings and regional editions
        especially. Only a title is required.
      </p>
      <ManualAdd initialIsbn={isbn ?? ""} initialTitle={title ?? ""} />
    </>
  );
}
