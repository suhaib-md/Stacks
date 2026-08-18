"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * Filters, sort and view live in the URL — not in client state. That is what
 * makes the back button, deep links and "restore where I was" work without any
 * extra machinery, and it lets the server resolve the query.
 *
 * Shared by the desktop rail and the mobile toolbar so the two can never drift
 * on what a filter change means.
 */

/**
 * Remembered for next visit. A cookie rather than localStorage so the server
 * can honour it on first paint instead of flashing the wrong layout.
 */
function rememberView(view: string): void {
  document.cookie = `stacks-view=${view}; path=/; max-age=31536000; samesite=lax`;
}

export function useLibraryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const currentQ = params.get("q") ?? "";
  const [query, setQuery] = useState(currentQ);

  // Debounced search, written to the URL rather than to state.
  useEffect(() => {
    if (query === currentQ) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query) next.set("q", query);
      else next.delete("q");
      next.delete("page");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, currentQ, params, pathname, router]);

  const update = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null) next.delete(key);
      else next.set(key, value);
      next.delete("page"); // any filter change invalidates the current page

      if (key === "view" && value) rememberView(value);

      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  /** Filters are toggles, not radio buttons: picking the active one clears it. */
  const toggle = useCallback(
    (key: string, value: string) => {
      update(key, params.get(key) === value ? null : value);
    },
    [params, update],
  );

  const clearAll = useCallback(() => {
    setQuery("");
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const active = ["status", "genre", "format"].filter((k) => params.get(k));

  return {
    params,
    query,
    setQuery,
    currentQ,
    update,
    toggle,
    clearAll,
    hasActive: active.length > 0 || currentQ.length > 0,
    view: params.get("view") ?? "grid",
    sort: params.get("sort") ?? "created",
    order: params.get("order") ?? "desc",
  };
}
