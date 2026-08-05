import Link from "next/link";

export const metadata = { title: "Add a book · Stacks" };

export default function AddPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Add a book</h1>
      <p className="mt-4 max-w-prose text-sm text-ink-muted">
        ISBN lookup and manual entry land in Phase 1; the barcode scanner in Phase 2.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-card border border-rule px-4 text-sm font-medium"
      >
        Back to library
      </Link>
    </>
  );
}
