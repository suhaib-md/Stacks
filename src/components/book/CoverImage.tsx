"use client";

import { useState } from "react";
import { effectiveCoverColor, generatedCoverBackground, readableOn } from "@/lib/cover";

/**
 * A cover, or a generated one when there isn't any art.
 *
 * Client-side because a dead cover URL has to be caught at runtime — cover hosts
 * rot, and a broken-image icon in the middle of the grid is the one thing FR-9
 * rules out.
 */
export function CoverImage({
  src,
  title,
  authors,
  coverColor,
  className = "",
  sizes,
}: {
  src: string | null;
  title: string;
  authors: string;
  /** Chosen (or extracted) colour. Falls back to one derived from the title. */
  coverColor?: string | null;
  className?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <GeneratedCover
        title={title}
        authors={authors}
        coverColor={coverColor}
        className={className}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Cover of ${title} by ${authors}`}
      loading="lazy"
      decoding="async"
      sizes={sizes}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

/**
 * Typeset rather than merely coloured: a head band, the title set in the display
 * face, and the author beneath. Sized in container query units so one component
 * looks right as a 40px thumbnail and as a 240px detail cover.
 */
export function GeneratedCover({
  title,
  authors,
  coverColor,
  className = "",
}: {
  title: string;
  authors: string;
  coverColor?: string | null;
  className?: string;
}) {
  const base = effectiveCoverColor(coverColor, title);
  const fg = readableOn(base);

  return (
    // Stub art: a solid field with the title set on it. No gradient, no bands,
    // no radius — a generated cover is still a cover, so it sits in the same
    // 2:3 box as real jacket art with nothing else marking it out.
    // Container query units keep one component right at 40px and at 240px.
    <div
      className={`@container flex flex-col justify-between overflow-hidden ${className}`}
      style={{ background: generatedCoverBackground(base), color: fg }}
      role="img"
      aria-label={`Generated cover for ${title} by ${authors}`}
    >
      <span className="line-clamp-5 px-[9%] pt-[9%] font-display text-[13cqw] leading-[1.12]">
        {title}
      </span>
      <span className="line-clamp-2 px-[9%] pb-[9%] text-[7.5cqw] leading-tight opacity-70">
        {authors}
      </span>
    </div>
  );
}
