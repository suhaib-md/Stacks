"use client";

import { useEffect, useRef } from "react";
import { extractDominantColor } from "@/lib/cover";

/**
 * Extracts the cover's dominant colour once, on first view, and caches it to the
 * row. Renders nothing.
 *
 * Failure is silent and expected: many cover hosts send no CORS headers, which
 * taints the canvas. Logging here would fire on most detail views.
 */
export function CoverColorProbe({
  bookId,
  coverUrl,
  hasColor,
}: {
  bookId: string;
  coverUrl: string | null;
  hasColor: boolean;
}) {
  const attempted = useRef(false);

  useEffect(() => {
    if (hasColor || !coverUrl || attempted.current) return;
    attempted.current = true;

    let cancelled = false;

    void (async () => {
      const color = await extractDominantColor(coverUrl);
      if (cancelled || !color) return;

      const res = await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ coverColor: color }),
      }).catch(() => null);

      // Repaint with the real colour. Only on success — a failed write should
      // not cause a pointless reload.
      if (!cancelled && res?.ok) {
        document.documentElement.style.setProperty("--book-accent", color);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookId, coverUrl, hasColor]);

  return null;
}
