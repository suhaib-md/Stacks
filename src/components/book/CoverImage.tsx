"use client";

import { useState } from "react";
import { titleColor } from "@/lib/cover";

/**
 * A cover, or a generated spine-style tile when there isn't one.
 *
 * Client-side only because a dead cover URL has to be caught at runtime —
 * cover hosts rot, and a broken-image icon in the middle of the grid is the one
 * thing FR-9 rules out.
 */
export function CoverImage({
  src,
  title,
  authors,
  className = "",
  sizes,
}: {
  src: string | null;
  title: string;
  authors: string;
  className?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  if (showFallback) {
    return (
      <div
        className={`flex flex-col justify-between overflow-hidden p-2 text-white ${className}`}
        style={{ backgroundColor: titleColor(title) }}
        role="img"
        aria-label={`No cover available for ${title}`}
      >
        <span className="line-clamp-4 font-display text-[11px] leading-tight">{title}</span>
        <span className="line-clamp-2 text-[9px] opacity-80">{authors}</span>
      </div>
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
