"use client";

import { useEffect, useRef } from "react";

/**
 * Bottom sheet on phones, centred modal on desktop (docs/uiux.md §5.5, §8).
 *
 * Escape closes, backdrop closes, focus moves in on open and returns to the
 * trigger on close, and Tab is trapped while open.
 */
export function Sheet({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    // Focus the first real control, not the panel, so typing works immediately.
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const items = panelRef.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!items || items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/55 motion-safe:animate-[fadeIn_150ms_ease-out]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative max-h-[90dvh] w-full overflow-y-auto border-t border-rule-control bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] motion-safe:animate-[sheetIn_220ms_cubic-bezier(0.32,0.72,0,1)] sm:max-w-[420px] sm:border-2 sm:pb-4"
      >
        {/* Grab handle — affordance on phones, meaningless on desktop. */}
        <div
          aria-hidden="true"
          className="mx-auto mb-3 h-1 w-10 bg-rule sm:hidden"
        />
        {children}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sheetIn {
          from { transform: translateY(16px); opacity: 0 }
          to { transform: translateY(0); opacity: 1 }
        }
      `}</style>
    </div>
  );
}
