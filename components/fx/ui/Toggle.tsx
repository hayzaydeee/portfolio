"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { RoomKey } from "@/components/fx/runtime/types";
import { usePrimRoom } from "./usePrimRoom";

type Props = {
  /** The switch's accessible name, also shown as its caption */
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Caption words for each state */
  onText?: string;
  offText?: string;
  size?: "sm" | "md";
  room?: RoomKey;
  className?: string;
};

/**
 * ThreeUI's modern skeuomorphic toggle (MIT, Meng To) as a room primitive: a real
 * role="switch" button whose thumb travels on a damped spring, squashing in the direction it
 * moves. Colours come from the room tokens (app/styles/primitives.css); under reduced motion
 * the thumb jumps.
 */
export function Toggle({ label, checked, onChange, onText = "on", offText = "off", size = "sm", room, className }: Props) {
  const scope = usePrimRoom(room);
  const switchRef = useRef<HTMLButtonElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const spring = useRef({ x: checked ? 1 : 0, v: 0 });

  useEffect(() => {
    const sw = switchRef.current;
    const thumb = thumbRef.current;
    if (!sw || !thumb) return;
    const target = checked ? 1 : 0;
    const s = spring.current;

    const place = (x: number, v: number) => {
      const travel = Math.max(0, sw.clientWidth - thumb.offsetLeft * 2 - thumb.offsetWidth);
      const stretch = Math.min(1, Math.abs(v) / 6);
      thumb.style.transformOrigin = v >= 0 ? "right center" : "left center";
      thumb.style.transform = `translate3d(${(x * travel).toFixed(2)}px, 0, 0) scale(${(1 + stretch * 0.16).toFixed(4)}, ${(1 - stretch * 0.1).toFixed(4)})`;
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      s.x = target;
      s.v = 0;
      place(target, 0);
      return;
    }

    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      s.v += ((target - s.x) * 210 - s.v * 19.5) * dt;
      s.x += s.v * dt;
      if (Math.abs(target - s.x) < 6e-4 && Math.abs(s.v) < 6e-3) {
        s.x = target;
        s.v = 0;
        place(target, 0);
        return;
      }
      place(s.x, s.v);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [checked]);

  return (
    <span className={cn("prim toggle", size === "md" && "toggle--md", className)} data-room={scope} data-state={checked ? "on" : "off"}>
      <button
        ref={switchRef}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="toggle__switch"
        onClick={() => onChange(!checked)}
      >
        <span className="toggle__track" aria-hidden="true" />
        <span ref={thumbRef} className="toggle__thumb" aria-hidden="true">
          <span className="toggle__mark">
            <svg viewBox="0 0 24 24" data-mark="check">
              <path d="M5 12.8 9.6 17.4 19 8" />
            </svg>
            <svg viewBox="0 0 24 24" data-mark="dash">
              <path d="M6.5 12h11" />
            </svg>
          </span>
        </span>
      </button>
      <span className="toggle__caption" aria-hidden="true">
        <span>{label}</span>
        <b>{checked ? onText : offText}</b>
      </span>
    </span>
  );
}
