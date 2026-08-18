"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
const STORAGE_KEY = "stacks-theme";
const OPTIONS: Theme[] = ["system", "light", "dark"];

/**
 * localStorage is external mutable state, so it is read through
 * useSyncExternalStore rather than mirrored into useState via an effect. The
 * effect version cascades renders (react-hooks/set-state-in-effect) and flashes
 * the wrong selection for a frame after mount.
 */
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // `storage` fires only for OTHER tabs; same-tab writes call emit() directly.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Returns a primitive, so React's identity check settles immediately.
function getSnapshot(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

// The server has no stored preference. React hydrates with this, then re-renders
// from getSnapshot — which is why this doesn't produce a hydration mismatch.
const getServerSnapshot = (): Theme => "system";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function apply(next: Theme) {
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.setAttribute("data-theme", next);
    }
    emit();
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="mt-2 flex gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option}
          role="radio"
          aria-checked={theme === option}
          onClick={() => apply(option)}
          className={`min-h-11 px-4 text-sm font-medium capitalize transition-colors ${
            theme === option
              ? "border-2 border-accent bg-accent text-on-accent"
              : "border-2 border-rule text-ink-muted"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
