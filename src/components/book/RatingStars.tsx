"use client";

import { useState } from "react";

/**
 * Five stars, no halves — the extra precision isn't worth the tap accuracy cost
 * on a phone. Tapping the current rating clears it, which is the only way to
 * undo a misfire.
 */
export function RatingStars({
  rating,
  onChange,
  autoFocus = false,
}: {
  rating: number | null;
  onChange: (rating: number | null) => void;
  autoFocus?: boolean;
}) {
  const [optimistic, setOptimistic] = useState(rating);

  function set(value: number) {
    const next = optimistic === value ? null : value;
    setOptimistic(next);
    onChange(next);
  }

  return (
    <div role="radiogroup" aria-label="Your rating" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((value) => {
        const filled = optimistic !== null && value <= optimistic;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={optimistic === value}
            aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
            autoFocus={autoFocus && value === 1}
            onClick={() => set(value)}
            className={`flex size-11 items-center justify-center text-2xl leading-none transition-colors ${
              filled ? "text-accent" : "text-ink-faint"
            }`}
          >
            {filled ? "★" : "☆"}
          </button>
        );
      })}

      {optimistic !== null ? (
        <button
          type="button"
          onClick={() => {
            setOptimistic(null);
            onChange(null);
          }}
          className="ml-2 text-xs text-ink-muted underline"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
