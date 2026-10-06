"use client";

import { useEffect, useRef } from "react";
import { HZY_MARK_PATH, HZY_MARK_VIEWBOX, hzyRevealAt } from "@/components/nav/hzyMarkPath";

/**
 * The splash's mark formation, after ThreeUI's SemanticBloom (MIT, Meng To): the HZY outline
 * is sampled into particles that drift in from around the logo and land just ahead of
 * HzyMark's left-to-right clip reveal, then dissolve into the solid fill as it passes them.
 * Runs once for `duration` plus its tail, then removes itself.
 */

const TRAVEL_MS = 650;
const FADE_MS = 260;
const ALPHA_STEPS = 8;
const MAX_POINTS = 2600;

type Particle = { sx: number; sy: number; tx: number; ty: number; arrive: number; drift: number };

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function sample(size: number): { pts: [number, number][]; step: number } {
  const px = Math.round(Math.min(size, 640));
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return { pts: [], step: 1 };
  g.setTransform(px / HZY_MARK_VIEWBOX, 0, 0, px / HZY_MARK_VIEWBOX, 0, 0);
  g.fill(new Path2D(HZY_MARK_PATH));
  const img = g.getImageData(0, 0, px, px).data;
  let step = Math.max(3, Math.round(px / 110));
  let pts: [number, number][] = [];
  // Coarsen until the count fits; the mark's thin strokes need a fine grid on large screens
  for (;;) {
    pts = [];
    for (let y = 0; y < px; y += step)
      for (let x = 0; x < px; x += step) if (img[(y * px + x) * 4 + 3] > 128) pts.push([x / px, y / px]);
    if (pts.length <= MAX_POINTS) break;
    step += 1;
  }
  return { pts, step: step / px };
}

export function MarkBloom({ size, duration, colorVar = "--color-base-dark" }: { size: number; duration: number; colorVar?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * ratio);
    canvas.height = Math.round(size * ratio);
    const color = getComputedStyle(document.documentElement).getPropertyValue(colorVar).trim() || "#141414";

    const { pts, step } = sample(size);
    const radius = Math.max(0.6, step * size * 0.34);
    const particles: Particle[] = pts.map(([u, v]) => {
      const angle = Math.random() * Math.PI * 2;
      const reach = size * (0.45 + Math.random() * 0.55);
      return {
        sx: size / 2 + Math.cos(angle) * reach,
        sy: size / 2 + Math.sin(angle) * reach * 0.8,
        tx: u * size,
        ty: v * size,
        // The clip edge reaches this column at eased progress u
        arrive: hzyRevealAt(u) * duration,
        drift: Math.random() * Math.PI * 2,
      };
    });
    const buckets: number[][] = Array.from({ length: ALPHA_STEPS + 1 }, () => []);
    const positions = new Float32Array(particles.length * 2);

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = now - start;
      g.setTransform(ratio, 0, 0, ratio, 0, 0);
      g.clearRect(0, 0, size, size);
      g.fillStyle = color;

      // Everything fades in over the first moments, then each particle flies, lands, and dissolves
      const intro = clamp01(t / 300);
      particles.forEach((p, i) => {
        const flight = clamp01((t - (p.arrive - TRAVEL_MS)) / TRAVEL_MS);
        const k = easeOut(flight);
        const wobble = (1 - k) * 4;
        positions[i * 2] = p.sx + (p.tx - p.sx) * k + Math.cos(p.drift + t * 0.002) * wobble;
        positions[i * 2 + 1] = p.sy + (p.ty - p.sy) * k + Math.sin(p.drift + t * 0.002) * wobble;
        const alpha = intro * (0.35 + 0.55 * k) * (1 - clamp01((t - p.arrive) / FADE_MS));
        if (alpha > 0.02) buckets[Math.round(alpha * ALPHA_STEPS)].push(i);
      });

      // One path per alpha step
      buckets.forEach((bucket, level) => {
        if (!bucket.length) return;
        g.globalAlpha = level / ALPHA_STEPS;
        g.beginPath();
        for (const i of bucket) {
          const x = positions[i * 2];
          const y = positions[i * 2 + 1];
          g.moveTo(x + radius, y);
          g.arc(x, y, radius, 0, Math.PI * 2);
        }
        g.fill();
        bucket.length = 0;
      });
      g.globalAlpha = 1;

      if (t < duration + FADE_MS) raf = requestAnimationFrame(frame);
      else g.clearRect(0, 0, size, size);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size, duration, colorVar]);

  return <canvas ref={ref} data-splash-bloom="" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />;
}
