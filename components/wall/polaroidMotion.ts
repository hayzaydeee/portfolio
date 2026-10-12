"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { usePrefersReducedMotion } from "@/components/fx/runtime/motion";

/**
 * The two ways a polaroid moves, after ThreeUI's Koi Studies (MIT, Meng To): it leans toward a
 * mouse pointer over it (up to the original's 4.75 degrees each way, tracking quickly and
 * easing home), and its photo develops the first time it comes into view: a grid of tiles of
 * undeveloped film clears from left to right with a little jitter and a waterline in it, the
 * way Koi's cards reveal, and then the print's colour comes up.
 */

const TILT = 4.75;

export function useTilt(ref: RefObject<HTMLElement | null>) {
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const clamp = (v: number) => Math.max(-TILT, Math.min(TILT, v));
      el.style.setProperty("--tilt-x", `${clamp((0.5 - y) * 10).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${clamp((x - 0.5) * 10).toFixed(2)}deg`);
      el.dataset.tracking = "";
    };
    const leave = () => {
      delete el.dataset.tracking;
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      leave();
    };
  }, [ref, reduced]);
}

const TILE = 9;
const REVEAL_MS = 940;

export type DevelopState = "pending" | "developing" | "developed";

/**
 * Develops `photo` the first time a third of it is in view. Returns the state for the frame's
 * `data-develop`: "pending" until then (the veil in the markup covers the photo), "developing"
 * while the tiles clear, "developed" after. Under reduced motion it starts developed.
 */
export function useDevelop(photo: RefObject<HTMLElement | null>, enabled: boolean): DevelopState {
  const reduced = usePrefersReducedMotion();
  const [state, setState] = useState<DevelopState>(enabled ? "pending" : "developed");
  const started = useRef(false);

  useEffect(() => {
    const el = photo.current;
    if (!el || !enabled || reduced || started.current) return;
    let raf = 0;
    let canvas: HTMLCanvasElement | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || started.current) return;
        started.current = true;
        observer.disconnect();
        canvas = develop(el, () => setState("developed"), (id) => (raf = id));
        setState("developing");
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      canvas?.remove();
    };
  }, [photo, enabled, reduced]);

  return reduced ? "developed" : state;
}

/** Lays a canvas of undeveloped tiles over the photo and clears them; removes it when done */
function develop(photo: HTMLElement, done: () => void, track: (raf: number) => void): HTMLCanvasElement | null {
  const w = photo.clientWidth;
  const h = photo.clientHeight;
  if (!w || !h) {
    done();
    return null;
  }
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.className = "develop-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  const g = canvas.getContext("2d");
  if (!g) {
    done();
    return null;
  }
  photo.append(canvas);
  const film = getComputedStyle(photo).getPropertyValue("--wall-caption").trim() || "#2a2018";
  const cols = Math.ceil(w / TILE);
  const rows = Math.ceil(h / TILE);
  // Koi's entry order: mostly left to right, jittered per tile, with a slight waterline
  const hash = (x: number, y: number) => {
    const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const order = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const across = c / Math.max(1, cols - 1);
      const down = r / Math.max(1, rows - 1);
      order[r * cols + c] = Math.min(1, Math.max(0, across * 0.72 + hash(c * 1.91 + 17, r * 2.17 + 31) * 0.24 + Math.abs(down - 0.5) * 0.04 + Math.sin(r * 0.48) * 0.035));
    }
  }
  const start = performance.now();
  const frame = (now: number) => {
    const raw = Math.min(1, (now - start) / REVEAL_MS);
    const p = raw * raw * (3 - 2 * raw);
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, h);
    g.fillStyle = film;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (order[r * cols + c] > p) g.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }
    if (raw < 1) track(requestAnimationFrame(frame));
    else {
      canvas.remove();
      done();
    }
  };
  frame(start);
  return canvas;
}
