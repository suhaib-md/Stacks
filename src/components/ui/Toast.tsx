"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * No id field: the dismiss timer keys off object identity, and every call site
 * builds a fresh object. An id would only exist to be a `Date.now()` call, which
 * the compiler rightly flags as impure.
 */
export type ToastMessage = {
  text: string;
  href?: string;
  linkLabel?: string;
};

export function Toast({
  message,
  onDismiss,
  ms = 3500,
}: {
  message: ToastMessage | null;
  onDismiss: () => void;
  ms?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, ms);
    return () => clearTimeout(timer);
  }, [message, ms, onDismiss]);

  if (!message) return null;

  return (
    // aria-live so a save is announced without stealing focus from the input.
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-sm items-center gap-3 border-2 border-accent bg-ink px-4 py-3 text-[13px] text-paper motion-safe:animate-[toastIn_200ms_ease-out] md:bottom-8"
    >
      <span className="flex-1">{message.text}</span>
      {message.href ? (
        <Link href={message.href} className="shrink-0 font-medium underline">
          {message.linkLabel ?? "View"}
        </Link>
      ) : null}
      <style>{`
        @keyframes toastIn {
          from { transform: translateY(8px); opacity: 0 }
          to { transform: translateY(0); opacity: 1 }
        }
      `}</style>
    </div>
  );
}
