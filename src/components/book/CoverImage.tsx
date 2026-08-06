"use client";

import { useState } from "react";
import { effectiveCoverColor, generatedCoverBackground } from "@/lib/cover";

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

  return (
    <div
      className={`@container flex flex-col justify-between overflow-hidden text-white ${className}`}
      style={{ background: generatedCoverBackground(base) }}
      role="img"
      aria-label={`Generated cover for ${title} by ${authors}`}
    >
      <div
        aria-hidden="true"
        className="h-[8%] w-full shrink-0"
        style={{ background: "rgba(0,0,0,0.28)" }}
      />
      <div className="flex flex-1 flex-col justify-center px-[8%] py-[4%]">
        <span className="line-clamp-5 font-display text-[13cqw] font-semibold leading-tight drop-shadow-sm">
          {title}
        </span>
        <span className="mt-[4%] line-clamp-2 text-[8cqw] leading-tight opacity-75">
          {authors}
        </span>
      </div>
      <div
        aria-hidden="true"
        className="h-[3%] w-full shrink-0"
        style={{ background: "rgba(0,0,0,0.18)" }}
      />
    </div>
  );
}
