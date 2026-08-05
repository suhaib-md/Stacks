"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiBook } from "@/lib/books";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Shared write path for the reading controls.
 *
 * Every one of them is an autosave — status, progress, rating, notes — so they
 * all need the same three things: a request that supersedes the previous one, a
 * visible save state, and a refresh so the rest of the page catches up.
 */
export function usePatchBook(bookId: string) {
  const router = useRouter();
  const [state, setState] = useState<SaveState>("idle");
  const requestRef = useRef(0);

  // Clear the "Saved" tick after a moment. Timeout rather than an effect body,
  // so this is never a synchronous setState during render.
  useEffect(() => {
    if (state !== "saved") return;
    const timer = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(timer);
  }, [state]);

  const patch = useCallback(
    async (body: Record<string, unknown>): Promise<ApiBook | null> => {
      const seq = requestRef.current + 1;
      requestRef.current = seq;
      setState("saving");

      const res = await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);

      // A slower earlier save must not report over a newer one.
      if (seq !== requestRef.current) return null;

      if (!res?.ok) {
        setState("error");
        return null;
      }

      const data = (await res.json().catch(() => null)) as { book: ApiBook } | null;
      setState("saved");
      router.refresh();
      return data?.book ?? null;
    },
    [bookId, router],
  );

  return { patch, state };
}

export function SaveIndicatorText(state: SaveState): string | null {
  switch (state) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Couldn't save";
    default:
      return null;
  }
}
