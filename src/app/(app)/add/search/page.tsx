import { AddNav } from "@/components/book/AddNav";
import { SearchAdd } from "./SearchAdd";

export const metadata = { title: "Search for a book · Stacks" };

export default function SearchPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Add a book</h1>
      <AddNav />
      <SearchAdd />
    </>
  );
}
