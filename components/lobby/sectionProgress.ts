"use client";

import { useEffect, type RefObject } from "react";
import { animate, useMotionValue, useScroll, useReducedMotion, type MotionValue, type UseScrollOptions } from "motion/react";

export type LobbyMode = "sequence" | "resting";

type Options = {
  /** useScroll offsets for the resting page */
  offset?: UseScrollOptions["offset"];
  /** Seconds the sequence slide takes to play its progress through */
  duration?: number;
  delay?: number;
  /** Sequence easing; "linear" for progress that already carries its own pacing */
  ease?: "linear" | "settle";
};

/**
 * One progress source per lobby section, 0 to 1. The resting page has a scroll to read; the
 * sequence has none (one slide fills the screen), so there the slide plays its progress
 * through on entry instead. Sections and their renderers only ever read the MotionValue.
 */
export function useSectionProgress(
  mode: LobbyMode,
  target: RefObject<HTMLElement | null>,
  { offset, duration = 2.4, delay = 0.2, ease = "settle" }: Options = {}
): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target, offset });
  const timed = useMotionValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (mode !== "sequence") return;
    if (reduced) {
      timed.set(1);
      return;
    }
    timed.set(0);
    const controls = animate(timed, 1, { duration, delay, ease: ease === "linear" ? "linear" : [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [mode, reduced, timed, duration, delay, ease]);

  return mode === "sequence" ? timed : scrollYProgress;
}
