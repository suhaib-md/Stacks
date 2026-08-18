import { AddNav } from "@/components/book/AddNav";
import { SearchAdd } from "./SearchAdd";

export const metadata = { title: "Search for a book · Stacks" };

export default function SearchPage() {
  return (
    <>
      <h1 className="disp text-[34px] md:text-[40px]">Add a book</h1>
      <AddNav />
      <SearchAdd />
    </>
  );
}
