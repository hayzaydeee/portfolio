"use client";

import { useEffect, useRef } from "react";
import { holdRoomReveal } from "@/lib/fx/portalStore";

/**
 * The workshop's loading state, after ThreeUI's Uplink Loader (MIT, Meng To): a readout
 * plate, a skewed tick bar that lights as it fills, and a status line that steps through
 * phases. A route load reports no progress, so the bar follows a curve that eases toward 99
 * and never claims 100; the real finish is this component unmounting. Like RoomLoading it
 * holds the portal's reveal and carries no heading, and the only live text is one stable
 * sentence (the moving readout is hidden from assistive tech).
 */

const TICKS = 56;
const MARK_EVERY = 8;
const PHASES: [number, string][] = [
  [0, "indexing projects"],
  [28, "growing the file tree"],
  [56, "warming the terminal"],
  [84, "opening the workshop"],
];
/** Time constant of the fill curve, in ms: about two thirds full after this long */
const TAU = 1400;

export function UplinkLoader() {
  const numRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<HTMLSpanElement>(null);
  const dotsRef = useRef<HTMLSpanElement>(null);

  useEffect(() => holdRoomReveal("workshop"), []);

  useEffect(() => {
    const ticks = Array.from(barRef.current?.children ?? []) as HTMLElement[];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let lastLit = -1;
    let lastPct = -1;
    let lastPhase = "";
    let lastDots = -1;
    let raf = 0;

    const frame = (now: number) => {
      const t = now - start;
      const pct = reduced ? 50 : Math.min(99, 99 * (1 - Math.exp(-t / TAU)));
      const shown = Math.round(pct);
      if (shown !== lastPct && numRef.current) {
        numRef.current.textContent = String(shown);
        lastPct = shown;
      }
      const phase = PHASES.reduce((p, [at, text]) => (shown >= at ? text : p), PHASES[0][1]);
      if (phase !== lastPhase && phaseRef.current) {
        phaseRef.current.textContent = phase;
        lastPhase = phase;
      }
      const lit = Math.round((pct / 100) * TICKS);
      if (lit !== lastLit) {
        ticks.forEach((tick, i) => tick.classList.toggle("is-on", i < lit));
        // The newest tick flashes as it lights
        if (lit > lastLit && lit > 0 && lastLit >= 0) {
          const head = ticks[lit - 1];
          head.classList.remove("is-flash");
          void head.offsetWidth;
          head.classList.add("is-flash");
        }
        lastLit = lit;
      }
      const dots = reduced ? 3 : Math.floor((t / 380) % 4);
      if (dots !== lastDots && dotsRef.current) {
        dotsRef.current.textContent = ".".repeat(dots);
        lastDots = dots;
      }
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div data-room-loading="workshop" className="uplink flex min-h-[70svh] flex-1 flex-col items-center justify-center py-24">
      <p role="status" className="sr-only">
        loading the workshop
      </p>
      <div className="uplink__rig" aria-hidden="true">
        <div className="uplink__plate">
          <span className="uplink__readout">
            <b ref={numRef}>0</b>
            <u>%</u>
          </span>
        </div>
        <div className="uplink__label">uplink</div>
        <div className="uplink__bar" ref={barRef}>
          {Array.from({ length: TICKS }, (_, i) => (
            <i key={i} className={(i + 1) % MARK_EVERY === 0 ? "uplink__tick is-mark" : "uplink__tick"} />
          ))}
        </div>
        <div className="uplink__status">
          <span ref={phaseRef}>{PHASES[0][1]}</span>
          <span ref={dotsRef} className="uplink__dots" />
        </div>
        {(["tl", "tr", "bl", "br"] as const).map((corner) => (
          <span key={corner} className={`uplink__marker uplink__marker--${corner}`} />
        ))}
      </div>
    </div>
  );
}
