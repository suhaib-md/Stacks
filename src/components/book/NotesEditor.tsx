"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Notes autosave on a 1s idle pause and on blur.
 *
 * The unsaved-changes guard matters more than it looks: notes are the only
 * content in this app that exists nowhere else, so losing a paragraph to a
 * navigation is unrecoverable.
 */
export function NotesEditor({
  notes,
  onSave,
}: {
  notes: string | null;
  onSave: (notes: string | null) => void;
}) {
  const [value, setValue] = useState(notes ?? "");
  const savedRef = useRef(notes ?? "");

  useEffect(() => {
    if (value === savedRef.current) return;

    const timer = setTimeout(() => {
      savedRef.current = value;
      onSave(value.trim().length > 0 ? value : null);
    }, 1000);

    return () => clearTimeout(timer);
  }, [value, onSave]);

  // Catch the tab-close case the idle timer would miss.
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (value !== savedRef.current) event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [value]);

  function flush() {
    if (value === savedRef.current) return;
    savedRef.current = value;
    onSave(value.trim().length > 0 ? value : null);
  }

  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={flush}
      rows={5}
      placeholder="What you thought, where you found it, who lent it to you…"
      aria-label="Notes"
      className="mt-2 w-full border border-rule-control bg-surface-sunk px-3 py-2 text-sm leading-relaxed outline-none"
    />
  );
}
