"use client";

import { useRef, useEffect, useId } from "react";
import { HZY_MARK_PATH, HZY_MARK_VIEWBOX, hzyRevealEase } from "./hzyMarkPath";

const FILL_MAP = {
  light: "#141414",
  dark: "#D4E8D8",
  "on-green": "#F5F4F0",
} as const;

export type HzyMarkMode = keyof typeof FILL_MAP;

interface HzyMarkProps {
  mode?: HzyMarkMode;
  /** Size in px — applied to both width and height. Omit to fill container (100%). */
  size?: number;
  /** Run the reveal animation on mount */
  animate?: boolean;
  /** Duration of clip-path reveal in ms */
  duration?: number;
  className?: string;
}


export function HzyMark({
  mode = "light",
  size,
  animate: shouldAnimate = false,
  duration = 1500,
  className,
}: HzyMarkProps) {
  const rectWidthRef = useRef<SVGRectElement>(null);
  const clipId = useId().replace(/:/g, "");

  useEffect(() => {
    if (!shouldAnimate || !rectWidthRef.current) return;
    const el = rectWidthRef.current;
    el.setAttribute("width", "0");

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      el.setAttribute("width", "1024");
      return;
    }

    let start: number | null = null;
    const dur = duration;


    let raf: number;
    function step(now: number) {
      if (start === null) start = now;
      const t = Math.min((now - start) / dur, 1);
      el.setAttribute("width", String(hzyRevealEase(t) * HZY_MARK_VIEWBOX));
      if (t < 1) raf = requestAnimationFrame(step);
    }

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [shouldAnimate]);

  const fill = FILL_MAP[mode];

  return (
    <svg
      width={size ?? "100%"}
      height={size ?? "100%"}
      viewBox={`0 0 ${HZY_MARK_VIEWBOX} ${HZY_MARK_VIEWBOX}`}
      aria-hidden="true"
      className={className}
    >
      <defs>
        <clipPath id={`hzy-clip-${clipId}`}>
          <rect ref={rectWidthRef} x="0" y="0" width={shouldAnimate ? "0" : "1024"} height="1024" />
        </clipPath>
      </defs>
      <path clipPath={`url(#hzy-clip-${clipId})`} fill={fill} style={{ transition: "fill 0.8s ease-in-out" }} d={HZY_MARK_PATH} />
    </svg>
  );
}
