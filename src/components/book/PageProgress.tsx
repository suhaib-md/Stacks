"use client";

import { useState } from "react";
import { clampPage } from "@/lib/books";

/**
 * Page progress. Quick increments carry the common case; the field handles the
 * rest. The bar moves on tap and reconciles on response — waiting for a round
 * trip to see your own progress move is the difference between a habit and a
 * chore.
 */
export function PageProgress({
  currentPage,
  pageCount,
  onChange,
  compact = false,
}: {
  currentPage: number;
  pageCount: number | null;
  onChange: (page: number) => void;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState(String(currentPage));
  const [optimistic, setOptimistic] = useState(currentPage);

  const percent =
    pageCount && pageCount > 0
      ? Math.min(100, Math.round((optimistic / pageCount) * 100))
      : null;

  function commit(next: number) {
    const clamped = clampPage(next, pageCount);
    setOptimistic(clamped);
    setDraft(String(clamped));
    onChange(clamped);
  }

  return (
    <div className={compact ? "" : "mt-4"}>
      <div className="flex items-center gap-2">
        <StepButton onClick={() => commit(optimistic - 10)} disabled={optimistic <= 0}>
          −10
        </StepButton>

        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={() => commit(Number.parseInt(draft, 10) || 0)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          inputMode="numeric"
          aria-label="Current page"
          className="min-h-11 w-16 border border-rule-control bg-surface-sunk text-center text-sm tabular outline-none"
        />

        <StepButton
          onClick={() => commit(optimistic + 10)}
          disabled={pageCount ? optimistic >= pageCount : false}
        >
          +10
        </StepButton>
        <StepButton
          onClick={() => commit(optimistic + 25)}
          disabled={pageCount ? optimistic >= pageCount : false}
        >
          +25
        </StepButton>

        {pageCount ? (
          <span className="ml-auto text-xs text-ink-muted tabular">of {pageCount}</span>
        ) : null}
      </div>

      {percent !== null ? (
        <div className="mt-3 flex items-center gap-3">
          <div
            className="h-2.5 flex-1 overflow-hidden bg-progress-track"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Reading progress"
          >
            <div
              className="h-full bg-progress transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-xs text-ink-muted tabular">{percent}%</span>
        </div>
      ) : (
        // No page count means no honest percentage to draw.
        <p className="mt-2 text-xs text-ink-faint">
          Add a page count to see progress.
        </p>
      )}
    </div>
  );
}

function StepButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 border border-rule-control bg-surface-sunk px-3 text-sm font-medium tabular disabled:opacity-40"
    >
      {children}
    </button>
  );
}
