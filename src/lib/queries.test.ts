import { describe, expect, it } from "vitest";
import { hasActiveFilters, parseFilters } from "./queries";

const params = (init: Record<string, string> = {}) => {
  const search = new URLSearchParams(init);
  return { get: (key: string) => search.get(key) };
};

describe("parseFilters", () => {
  it("defaults to recently added, newest first, grid", () => {
    const f = parseFilters(params());
    expect(f).toMatchObject({ sort: "created", order: "desc", view: "grid", page: 1 });
  });

  it("orders the Finished view by when you finished, not when you added", () => {
    expect(parseFilters(params({ status: "finished" })).sort).toBe("finished");
  });

  it("lets an explicit sort override that default", () => {
    expect(parseFilters(params({ status: "finished", sort: "title" })).sort).toBe("title");
  });

  it("does not apply the finished default to other statuses", () => {
    expect(parseFilters(params({ status: "reading" })).sort).toBe("created");
  });

  it("ignores unknown enum values rather than trusting the URL", () => {
    const f = parseFilters(params({ status: "nonsense", format: "papyrus", sort: "chaos" }));
    expect(f.status).toBeNull();
    expect(f.format).toBeNull();
    expect(f.sort).toBe("created");
  });

  it("honours a saved view preference but lets the URL win", () => {
    expect(parseFilters(params(), { view: "list" }).view).toBe("list");
    expect(parseFilters(params({ view: "grid" }), { view: "list" }).view).toBe("grid");
  });

  it("clamps paging to sane bounds", () => {
    expect(parseFilters(params({ page: "0" })).page).toBe(1);
    expect(parseFilters(params({ page: "-3" })).page).toBe(1);
    expect(parseFilters(params({ perPage: "5000" })).perPage).toBe(100);
    expect(parseFilters(params({ perPage: "abc" })).perPage).toBe(60);
  });

  it("treats a blank query as no query", () => {
    expect(parseFilters(params({ q: "   " })).q).toBeNull();
  });
});

describe("hasActiveFilters", () => {
  it("is false for a bare library view", () => {
    expect(hasActiveFilters(parseFilters(params()))).toBe(false);
  });

  it("is true once anything narrows the list", () => {
    expect(hasActiveFilters(parseFilters(params({ q: "dune" })))).toBe(true);
    expect(hasActiveFilters(parseFilters(params({ status: "unread" })))).toBe(true);
    expect(hasActiveFilters(parseFilters(params({ genre: "Fantasy" })))).toBe(true);
  });

  it("is not triggered by sort or view, which do not narrow anything", () => {
    expect(hasActiveFilters(parseFilters(params({ sort: "title", view: "list" })))).toBe(false);
  });
});
