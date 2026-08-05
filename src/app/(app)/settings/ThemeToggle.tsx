"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const STORAGE_KEY = "stacks-theme";
const OPTIONS: Theme[] = ["system", "light", "dark"];

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  // Read after mount: localStorage doesn't exist during SSR, and reading it in
  // useState's initializer would desync the server and client markup.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.setAttribute("data-theme", next);
    }
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="mt-2 flex gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option}
          role="radio"
          aria-checked={theme === option}
          onClick={() => apply(option)}
          className={`min-h-11 rounded-full px-4 text-sm font-medium capitalize transition-colors ${
            theme === option
              ? "border border-accent bg-accent-soft text-accent"
              : "bg-surface-sunk text-ink-muted"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
