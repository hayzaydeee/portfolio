import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB } from "@/components/fx/runtime/palette";
import { HZY_MARK_PATH, HZY_MARK_VIEWBOX } from "@/components/nav/hzyMarkPath";
import type { HzyOrbOptions } from "./meta";

/**
 * Port of ThreeUI Brand Orbs' sampled-mark driver (MIT, Meng To): rasterise a logo path,
 * keep the lattice cells that land inside it, sway the lattice with a yaw/tilt projection
 * and run a crest of light through it. The original drew brand marks in greyscale inside
 * an iframe; this draws the HZY mark in the room's palette on the shared ticker.
 */

const TAU = Math.PI * 2;
const RASTER = 400;
/** Below this CSS size the lattice coarsens and dots grow, as the original's mini mode */
const MINI_PX = 32;
const PULSE_MS = 900;

type Dot = { x: number; y: number; z: number; r: number; v: number; c: number };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const luma = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Lattice points inside the mark, normalised to [-1, 1] on the mark's own bounding box */
function sampleMark(n: number): [number, number][] {
  const c = document.createElement("canvas");
  c.width = c.height = RASTER;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return [];
  g.setTransform(RASTER / HZY_MARK_VIEWBOX, 0, 0, RASTER / HZY_MARK_VIEWBOX, 0, 0);
  g.fillStyle = "#fff";
  g.fill(new Path2D(HZY_MARK_PATH));
  const img = g.getImageData(0, 0, RASTER, RASTER).data;
  const on = (i: number, j: number) => img[(j * RASTER + i) * 4 + 3] > 128;

  let x0 = RASTER, x1 = -1, y0 = RASTER, y1 = -1;
  for (let j = 0; j < RASTER; j++)
    for (let i = 0; i < RASTER; i++)
      if (on(i, j)) {
        if (i < x0) x0 = i;
        if (i > x1) x1 = i;
        if (j < y0) y0 = j;
        if (j > y1) y1 = j;
      }
  if (x1 < 0) return [];

  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const m = Math.max(x1 - x0, y1 - y0);
  const pts: [number, number][] = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const sx = mx + (((i + 0.5) / n) * 2 - 1) * (m / 2);
      const sy = my + (((j + 0.5) / n) * 2 - 1) * (m / 2);
      const ix = Math.round(sx);
      const iy = Math.round(sy);
      if (ix < 0 || iy < 0 || ix >= RASTER || iy >= RASTER || !on(ix, iy)) continue;
      pts.push([(sx - mx) / (m / 2), (sy - my) / (m / 2)]);
    }
  return pts;
}

/** Yaw + tilt, then orthographic projection into the canvas */
function projector(yaw: number, tilt: number, cx: number, cy: number, s: number) {
  const st = Math.sin(tilt), ct = Math.cos(tilt);
  const sy = Math.sin(yaw), cyw = Math.cos(yaw);
  return (x: number, y: number): [number, number, number] => {
    const px = x * cyw;
    const pz = -x * sy;
    const py = y * ct - pz * st;
    const z = y * st + pz * ct;
    return [cx + px * s, cy - py * s, z];
  };
}

export function create(ctx: FxContext, initial: HzyOrbOptions): FxInstance<HzyOrbOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");

  let palette = ctx.palette;
  let size = 1;
  let ratio = 1;
  let elapsed = 1.3;
  let still = false;
  let pulseAt = -Infinity;
  let clock = 0;
  const lattice = new Map<number, [number, number][]>();
  const dots: Dot[] = [];
  let ramp: string[] = [];

  const mini = () => size < MINI_PX;
  const cells = () => (mini() ? Math.max(16, Math.round(opts.density * 0.5)) : Math.round(opts.density));

  const points = () => {
    const n = cells();
    let pts = lattice.get(n);
    if (!pts) {
      pts = sampleMark(n);
      lattice.set(n, pts);
    }
    return pts;
  };

  // 64 precomputed fill colours from dim to crest, so a frame never builds colour strings
  const buildRamp = () => {
    const light = luma(palette.base) > 0.5;
    const from = opts.sourcePalette ? ([0.32, 0.32, 0.32] as RGB) : mixRGB(palette.base, palette.text, 0.45);
    const body = opts.sourcePalette ? ([0.85, 0.85, 0.85] as RGB) : palette.text;
    const crest = opts.sourcePalette ? ([1, 1, 1] as RGB) : light ? palette.accent : palette.glow;
    ramp = Array.from({ length: 64 }, (_, i) => {
      const t = i / 63;
      const [r, gg, b] = t < 0.7 ? mixRGB(from, body, t / 0.7) : mixRGB(body, crest, (t - 0.7) / 0.3);
      return `rgb(${Math.round(r * 255)} ${Math.round(gg * 255)} ${Math.round(b * 255)})`;
    });
  };

  const draw = () => {
    const w = size;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, w);

    const t = elapsed;
    const s = (w / 2) * 0.86;
    const project = projector(0.15 * Math.sin(t * 0.4), 0.13 * Math.sin(t * 0.31), w / 2, w / 2, s);
    // Dots scale with the lattice spacing, so any density reads as one continuous mark
    const spacing = (2 * s) / cells();
    const wave = ((((t * 0.4) % 1) + 1) % 1) * 2.4 - 1.2;
    const pulse = clamp01((clock - pulseAt) / PULSE_MS);
    const pulsing = pulse < 1;

    dots.length = 0;
    for (const [gx, gy] of points()) {
      let crest: number;
      if (opts.motion === "scan") crest = Math.exp(-((gy - wave) ** 2) / 0.05);
      else if (opts.motion === "sweep") {
        const ph = ((((Math.atan2(gy, gx) / TAU + 0.5 - t * 0.3) % 1) + 1) % 1);
        crest = Math.exp(-((ph - 0.5) ** 2) / 0.014);
      } else crest = Math.exp(-(((gx - gy) * 0.5 - wave) ** 2) / 0.05);
      // A pulse is a ring running out from the centre, fading as it goes
      if (pulsing) crest = Math.max(crest, Math.exp(-((Math.hypot(gx, gy) - pulse * 1.6) ** 2) / 0.03) * (1 - pulse));

      const [x, y, z] = project(gx, -gy);
      const depth = (z + 1) / 2;
      dots.push({
        x,
        y,
        z,
        r: Math.max(0.35, spacing * (0.26 + 0.14 * depth + 0.16 * crest)),
        v: clamp01(0.42 + 0.15 * depth + 0.43 * crest),
        c: crest,
      });
    }

    dots.sort((a, b) => a.z - b.z);
    for (const d of dots) {
      g.fillStyle = ramp[Math.round(d.v * 63)];
      g.beginPath();
      g.arc(d.x, d.y, d.r, 0, TAU);
      g.fill();
    }
  };

  buildRamp();

  return {
    resize(w, h, pixelRatio) {
      size = Math.max(1, Math.min(w, h));
      ratio = pixelRatio;
      canvas.width = Math.max(1, Math.round(w * pixelRatio));
      canvas.height = Math.max(1, Math.round(h * pixelRatio));
      if (still) draw();
    },

    render(now, dt) {
      clock = now;
      elapsed += Math.min(96, dt) * 0.001 * opts.speed * (mini() ? 1.25 : 1);
      draw();
    },

    update(next) {
      const recolour = next.sourcePalette !== undefined && next.sourcePalette !== opts.sourcePalette;
      opts = { ...opts, ...next };
      if (recolour) buildRamp();
      if (still) draw();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      buildRamp();
      if (still) draw();
    },

    still() {
      still = true;
      elapsed = 1.3;
      draw();
    },

    command(name) {
      if (name === "pulse") pulseAt = clock;
    },

    dispose() {
      lattice.clear();
      g.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
