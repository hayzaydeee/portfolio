"use client";

import Link from "next/link";
import type { Currently } from "@/lib/data/currently";

interface CurrentlyIndicatorProps {
  data: Currently | null;
}

function getIcon(type: Currently["type"]) {
  switch (type) {
    case "project":
      return (
        <span className="relative flex h-2 w-2 mr-2 mt-0.75 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-(--color-accent) opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-(--color-accent)" />
        </span>
      );
    case "music":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
          className="mr-2 mt-0.5 shrink-0 text-(--color-accent-muted)"
        >
          {/* mini waveform */}
          {[2, 4, 6, 8, 10, 12].map((x, i) => (
            <rect
              key={x}
              x={x}
              y={7 - [3, 5, 4, 6, 3, 4][i]}
              width="1.5"
              height={[6, 10, 8, 12, 6, 8][i]}
              rx="1"
              fill="currentColor"
            />
          ))}
        </svg>
      );
    case "verse":
      return (
        <span className="mr-2 -mt-px shrink-0 text-(--color-accent-muted) font-serif text-lg leading-none">
          &ldquo;
        </span>
      );
    case "film":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
          className="mr-2 mt-0.5 shrink-0 text-(--color-accent-muted)"
        >
          <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="3" y="4" width="2" height="2" rx="0.5" fill="currentColor" />
          <rect x="9" y="4" width="2" height="2" rx="0.5" fill="currentColor" />
          <rect x="3" y="8" width="2" height="2" rx="0.5" fill="currentColor" />
          <rect x="9" y="8" width="2" height="2" rx="0.5" fill="currentColor" />
        </svg>
      );
    case "book":
      return null;
  }
}

export function CurrentlyIndicator({ data }: CurrentlyIndicatorProps) {
  if (!data) return null;

  const content =
    data.link ? (
      <a
        href={data.link}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-(--color-base-dark) transition-colors underline underline-offset-2 decoration-(--color-accent-muted)"
      >
        {data.content}
      </a>
    ) : data.type === "verse" ? (
      <Link href="/notebook" className="hover:text-(--color-base-dark) transition-colors">
        {data.content}
      </Link>
    ) : (
      <span>{data.content}</span>
    );

  return (
    <div className="fixed bottom-6 left-6 z-20 max-w-55">
      <div className="flex items-start text-xs font-sans text-(--color-text-muted)">
        {getIcon(data.type)}
        <span className="leading-relaxed">
          <span className="text-(--color-base-dark)">{data.verb}</span>
          {" — "}
          {content}
        </span>
      </div>
    </div>
  );
}
