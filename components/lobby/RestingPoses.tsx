"use client";

import { useEffect } from "react";
import { useLobbyBackdrop } from "./LobbyBackdrop";
import { POSES, type LobbySection } from "./poses";

/**
 * The resting page's half of the backdrop choreography: whichever section fills most of the
 * viewport poses the horizon, as each slide does in the sequence.
 */
export function RestingPoses() {
  const { command } = useLobbyBackdrop();

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-lobby-section]"));
    if (!sections.length) return;
    // Visible height in px, not a ratio: the pinned sections are several screens tall
    const shown = new Map<Element, number>();
    let current: string | null = null;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) shown.set(e.target, e.isIntersecting ? e.intersectionRect.height : 0);
        let best: HTMLElement | null = null;
        let most = 0;
        for (const el of sections) {
          const h = shown.get(el) ?? 0;
          if (h > most) {
            most = h;
            best = el;
          }
        }
        const key = best?.dataset.lobbySection as LobbySection | undefined;
        if (!key || key === current || !(key in POSES)) return;
        current = key;
        command("slide", POSES[key]);
      },
      { threshold: Array.from({ length: 11 }, (_, i) => i / 10) }
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [command]);

  return null;
}
