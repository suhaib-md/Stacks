"use client";

import { GeneratedCover } from "./CoverImage";
import { COVER_PALETTE, generatedCoverBackground, titleColor } from "@/lib/cover";

/**
 * Choose the colour of a generated cover.
 *
 * Deliberately not an image upload. Older and regional editions often have no
 * art anywhere, and storing photographs would put image bytes on the library's
 * hot path for a result that a chosen colour achieves just as well.
 *
 * Writes to `cover_color`, which already exists — no new column, no migration.
 */
export function CoverPicker({
  title,
  authors,
  coverUrl,
  value,
  onChange,
}: {
  title: string;
  authors: string;
  coverUrl: string;
  value: string | null;
  onChange: (hex: string | null) => void;
}) {
  const hasArt = coverUrl.trim().length > 0;
  const automatic = titleColor(title || "Untitled");

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-ink-muted">
        Cover
        {hasArt ? (
          <span className="ml-1 text-ink-faint">
            (this book has artwork — the colour tints its detail header)
          </span>
        ) : null}
      </span>

      <div className="flex gap-4">
        <div className="h-[132px] w-22 shrink-0 overflow-hidden">
          {/* Always previews the generated design, even when artwork exists, so
              you can see what you're choosing. */}
          <GeneratedCover
            title={title || "Untitled"}
            authors={authors || "Unknown author"}
            coverColor={value}
            className="h-full w-full"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-pressed={value === null}
              title="Automatic — derived from the title"
              className={`size-8 border-2 ${
                value === null ? "border-accent" : "border-rule"
              }`}
              style={{ background: generatedCoverBackground(automatic) }}
            >
              <span className="sr-only">Automatic colour</span>
            </button>

            {COVER_PALETTE.map((swatch) => (
              <button
                key={swatch.hex}
                type="button"
                onClick={() => onChange(swatch.hex)}
                aria-pressed={value === swatch.hex}
                title={swatch.name}
                className={`size-8 border-2 ${
                  value === swatch.hex ? "border-accent" : "border-rule"
                }`}
                style={{ background: generatedCoverBackground(swatch.hex) }}
              >
                <span className="sr-only">{swatch.name}</span>
              </button>
            ))}
          </div>

          <p className="mt-2 text-xs text-ink-faint">
            {value === null
              ? "Automatic — picked from the title, so it's always the same for this book."
              : COVER_PALETTE.find((s) => s.hex === value)?.name ?? value}
          </p>
        </div>
      </div>
    </div>
  );
}
