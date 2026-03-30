"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Journal } from "@/lib/data/notebook";

type Props = {
  journal: Journal;
  prevSlug: string | null; // older entry (prev in reading order)
  nextSlug: string | null; // newer entry (next in reading order)
};

export function PageCurl({ journal, prevSlug, nextSlug }: Props) {
  const router = useRouter();
  const curlingRef = useRef(false);

  function navigatePrev() {
    if (!prevSlug || curlingRef.current) return;
    router.push(`/notebook/${journal}/${prevSlug}`);
  }

  function navigateNext() {
    if (!nextSlug || curlingRef.current) return;
    router.push(`/notebook/${journal}/${nextSlug}`);
  }

  // Keyboard arrow keys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") navigatePrev();
      if (e.key === "ArrowRight") navigateNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Touch / swipe
  const touchStartX = useRef<number | null>(null);
  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX;
    }
    function onTouchEnd(e: TouchEvent) {
      if (touchStartX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) < 40) return; // threshold
      if (dx > 0) navigatePrev();
      else navigateNext();
      touchStartX.current = null;
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  });

  const hasPrev = !!prevSlug;
  const hasNext = !!nextSlug;

  if (!hasPrev && !hasNext) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 pointer-events-none"
      aria-label="Entry navigation"
    >
      {/* Desktop: page-curl style buttons at corners */}
      <div className="hidden md:flex items-end justify-between px-8 pb-8">
        {/* Previous (older) — bottom-left corner */}
        <button
          disabled={!hasPrev}
          onClick={navigatePrev}
          className="pointer-events-auto group flex items-center gap-2 transition-opacity duration-150 disabled:opacity-0"
          style={{ color: "var(--notebook-text-muted)" }}
          aria-label="Previous entry"
        >
          <span
            className="text-xs font-mono group-hover:underline"
            style={{ textUnderlineOffset: "3px" }}
          >
            ← older
          </span>
        </button>

        {/* Next (newer) — bottom-right corner with page curl affordance */}
        <button
          disabled={!hasNext}
          onClick={navigateNext}
          className="pointer-events-auto group relative transition-opacity duration-150 disabled:opacity-0"
          aria-label="Next entry"
        >
          {/* Curl triangle */}
          <CurlCorner />
          <span
            className="text-xs font-mono group-hover:underline"
            style={{
              color: "var(--notebook-text-muted)",
              textUnderlineOffset: "3px",
            }}
          >
            newer →
          </span>
        </button>
      </div>

      {/* Mobile: bottom pill navigation */}
      <div
        className="md:hidden pointer-events-auto flex items-center justify-between px-6 py-4"
        style={{
          background: "var(--notebook-surface)",
          borderTop: "1px solid var(--notebook-border)",
        }}
      >
        <button
          disabled={!hasPrev}
          onClick={navigatePrev}
          className="text-xs font-mono disabled:opacity-30 transition-opacity"
          style={{ color: "var(--notebook-text-muted)" }}
          aria-label="Previous entry"
        >
          ← older
        </button>
        <button
          disabled={!hasNext}
          onClick={navigateNext}
          className="text-xs font-mono disabled:opacity-30 transition-opacity"
          style={{ color: "var(--notebook-text-muted)" }}
          aria-label="Next entry"
        >
          newer →
        </button>
      </div>
    </nav>
  );
}

/**
 * Pure CSS page-curl affordance at the bottom-right corner.
 * Animates with CSS on the parent button's hover state.
 */
function CurlCorner() {
  return (
    <span
      className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none"
      aria-hidden="true"
      style={{
        background:
          "conic-gradient(from 225deg at 100% 100%, var(--notebook-shadow) 0deg 90deg, transparent 90deg)",
        borderTopLeftRadius: 2,
        transition: "transform 0.18s ease",
        transformOrigin: "bottom right",
      }}
    />
  );
}
