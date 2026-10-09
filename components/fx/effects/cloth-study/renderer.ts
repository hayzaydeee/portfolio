import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { rgbToCss } from "@/components/fx/runtime/palette";
import { loadFont, resolveFontFamily } from "@/components/fx/runtime/fonts";
import type { ClothStudyOptions } from "./meta";

/**
 * Port of "Cloth" from ThreeUI's Text Path Studies II (MIT, Meng To): a verlet sheet of
 * particles on a fixed 120 Hz step, held to its rest spacing by six passes of distance
 * constraints and a final hard clamp, so it stretches a little and then refuses. Gravity, a
 * two-frequency breeze and a passing pointer move it; a held point leads and the cloth
 * follows. Each cell carries one letter, turned and scaled by the cell's own shear and
 * stretch, its ink by how square-on the cell faces you.
 *
 * Changed for the notebook: the sheet is a wide banner hung from six pegs, one per journal,
 * and its rows are the journals' names woven in full ink through a faint weave of filler
 * letters (the original ran one phrase through every cell). It draws in the room's ink on a
 * clear canvas. `grab`/`pull`/`drop` (stage px) come from the page's pointer layer, since the
 * canvas never takes input; `tug` throws a gust.
 */

const COLS = 17;
const PEGS = 6;
const H = 1 / 120;
const DAMP = 0.992;
/** Glyph rotations snap to 64 steps so the glyph cache stays warm */
const QA = (Math.PI * 2) / 64;
const qang = (a: number) => Math.round(a / QA) * QA;

type Point = { x: number; y: number; px: number; py: number; pin: { x: number; y: number } | null };
type Cell = { ch: string; strong: boolean };

export function create(ctx: FxContext, initial: ClothStudyOptions): FxInstance<ClothStudyOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");
  const family = resolveFontFamily("--font-serif");

  let w = 1;
  let h = 1;
  let ratio = 1;
  let still = false;
  let gx = COLS + 1;
  let gy = 2;
  let rest = 1;
  let unit = 1;
  let pts: Point[] = [];
  let cells: Cell[] = [];
  let builtFor = "";
  let wind = 0;
  let gust = 0;
  let acc = 0;
  let held: (Point & { gx: number; gy: number }) | null = null;
  let ink: string[] = [];
  let faint: string[] = [];
  let pegInk = "";

  /** 64 ready-made ink strings per weight: building an rgba() per glyph per frame is what drags this from 60fps to 20 */
  const recolour = () => {
    const text: RGB = palette.text;
    ink = Array.from({ length: 64 }, (_, i) => rgbToCss(text, (i / 63) * 0.92));
    faint = Array.from({ length: 64 }, (_, i) => rgbToCss(text, (i / 63) * 0.3));
    pegInk = rgbToCss(palette.accent, 0.85);
  };
  const shade = (set: string[], a: number) => set[a <= 0 ? 0 : a >= 1 ? 63 : (a * 63) | 0];

  /** The rows, centred, with the weave's letters running through every cell they don't fill */
  const weaveCells = () => {
    const rows = opts.lines
      .split("/")
      .map((r) => r.trim())
      .filter(Boolean);
    const filler = Array.from(opts.weave.replace(/\s+/g, "") || "·");
    const all: Cell[] = [];
    let f = 0;
    const fill = () => filler[f++ % filler.length];
    const hem = () => {
      for (let i = 0; i < COLS; i++) all.push({ ch: fill(), strong: false });
    };
    hem();
    for (const row of rows) {
      const letters = Array.from(row.slice(0, COLS));
      const start = Math.floor((COLS - letters.length) / 2);
      for (let i = 0; i < COLS; i++) {
        const ch = letters[i - start];
        if (ch !== undefined && ch !== " ") all.push({ ch, strong: true });
        else all.push({ ch: fill(), strong: false });
      }
    }
    hem();
    return { all, rowCount: rows.length + 2 };
  };

  const build = () => {
    const woven = weaveCells();
    cells = woven.all;
    gx = COLS + 1;
    gy = woven.rowCount + 1;
    // As wide as the stage allows, short enough to hang inside it with room to swing
    rest = Math.max(4, Math.min((w * 0.9) / (gx - 1), (h * 0.74) / (gy - 1)));
    // The original's sizes are shares of its plate, where the sheet spans 0.58 of it
    unit = (rest * (gx - 1)) / 0.58;
    const x0 = w / 2 - (rest * (gx - 1)) / 2;
    const y0 = Math.max(rest * 0.6, h * 0.1);
    const pegs = new Set(Array.from({ length: PEGS }, (_, k) => Math.round((k * (gx - 1)) / (PEGS - 1))));
    pts = [];
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const x = x0 + i * rest;
        const y = y0 + j * rest;
        pts.push({ x, y, px: x, py: y, pin: j === 0 && pegs.has(i) ? { x, y } : null });
      }
    }
    held = null;
    builtFor = `${w}x${h}|${opts.lines}|${opts.weave}`;
    canvas.dataset.pegs = String(pegs.size);
    canvas.dataset.cells = String(cells.length);
  };

  const P = (i: number, j: number) => pts[j * gx + i];

  const solve = (a: Point, b: Point, len: number) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1e-4;
    const diff = ((d - len) / d) * 0.5;
    a.x += dx * diff;
    a.y += dy * diff;
    b.x -= dx * diff;
    b.y -= dy * diff;
  };

  const fixed = (p: Point) => p === held || !!p.pin;

  const clampPair = (a: Point, b: Point, lim: number) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d <= lim || d < 1e-4) return;
    const f = ((d - lim) / d) * 0.5;
    if (!fixed(a)) {
      a.x += dx * f;
      a.y += dy * f;
    }
    if (!fixed(b)) {
      b.x -= dx * f;
      b.y -= dy * f;
    }
  };

  const substep = (step: number, pointer: { x: number; y: number } | null) => {
    const gravity = unit * 1.6;
    wind += step;
    const hh = step * step;
    gust *= Math.pow(0.25, step);
    for (const p of pts) {
      if (p === held) {
        p.px = p.x;
        p.py = p.y;
        // The hand leads, the cloth follows
        p.x += (held.gx - p.x) * 0.45;
        p.y += (held.gy - p.y) * 0.45;
        continue;
      }
      if (p.pin) {
        p.x = p.px = p.pin.x;
        p.y = p.py = p.pin.y;
        continue;
      }
      const vx = (p.x - p.px) * DAMP;
      const vy = (p.y - p.py) * DAMP;
      p.px = p.x;
      p.py = p.y;
      const breeze = ((Math.sin(wind * 1.9 + p.y * 0.035) * 0.55 + Math.sin(wind * 0.7) * 0.45) * opts.breeze + gust) * unit * 0.55;
      p.x += vx + breeze * hh;
      p.y += vy + gravity * hh;
      if (pointer && !held) {
        // A passing hand only brushes it
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d = Math.hypot(dx, dy);
        const reach = unit * 0.13;
        if (d < reach && d > 0.001) {
          const push = (1 - d / reach) * (1 - d / reach) * unit * 0.008;
          p.x += (dx / d) * push;
          p.y += (dy / d) * push;
        }
      }
    }
    // A hand on it needs the constraint to travel further
    const iters = held ? 12 : 6;
    for (let it = 0; it < iters; it++) {
      for (let j = 0; j < gy; j++) {
        for (let i = 0; i < gx; i++) {
          if (i < gx - 1) solve(P(i, j), P(i + 1, j), rest);
          if (j < gy - 1) solve(P(i, j), P(i, j + 1), rest);
        }
      }
      for (const q of pts) {
        if (q === held) {
          q.x = held.gx;
          q.y = held.gy;
        } else if (q.pin) {
          q.x = q.pin.x;
          q.y = q.pin.y;
        }
      }
    }
    // A final hard clamp: cloth stretches a little and then simply refuses, or a long pull draws it into strings
    const lim = rest * 1.14;
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        if (i < gx - 1) clampPair(P(i, j), P(i + 1, j), lim);
        if (j < gy - 1) clampPair(P(i, j), P(i, j + 1), lim);
      }
    }
  };

  /** Fixed-step: a variable dt under-relaxes the constraint pass and the sheet collapses instead of hanging */
  const simulate = (dtMs: number) => {
    const p = ctx.pointer();
    const pointer = p.inside ? { x: p.x, y: p.y } : null;
    acc += Math.min(50, dtMs) / 1000;
    let guard = 0;
    while (acc >= H && guard++ < 2) {
      acc -= H;
      substep(H, pointer);
    }
  };

  const draw = () => {
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, h);
    if (!pts.length) return;
    const fs = rest * 0.86;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `600 ${fs.toFixed(2)}px ${family}`;
    let idx = 0;
    for (let j = 0; j < gy - 1; j++) {
      for (let i = 0; i < gx - 1; i++) {
        const cell = cells[idx++];
        if (!cell) continue;
        const a = P(i, j);
        const b = P(i + 1, j);
        const c = P(i, j + 1);
        const d = P(i + 1, j + 1);
        const mx = (a.x + b.x + c.x + d.x) / 4;
        const my = (a.y + b.y + c.y + d.y) / 4;
        const ex = (b.x - a.x + d.x - c.x) / 2;
        const ey = (b.y - a.y + d.y - c.y) / 2;
        const fx = (c.x - a.x + d.x - b.x) / 2;
        const fy = (c.y - a.y + d.y - b.y) / 2;
        const sx = Math.hypot(ex, ey) / rest;
        const sy = Math.hypot(fx, fy) / rest;
        // Area stands in for facing: a cell turned edge-on to you thins to nothing
        const area = Math.abs(ex * fy - ey * fx) / (rest * rest);
        const alpha = 0.2 + 0.75 * Math.min(1, area);
        g.save();
        g.translate(mx, my);
        g.rotate(qang(Math.atan2(ey, ex)));
        g.scale(Math.max(0.15, Math.min(1.7, sx)), Math.max(0.15, Math.min(1.7, sy)));
        g.fillStyle = shade(cell.strong ? ink : faint, alpha);
        g.fillText(cell.ch, 0, 0);
        g.restore();
      }
    }
    // The pegs it hangs from
    g.fillStyle = pegInk;
    for (let i = 0; i < gx; i++) {
      const q = P(i, 0);
      if (!q.pin) continue;
      g.beginPath();
      g.arc(q.pin.x, q.pin.y, Math.max(2.5, unit * 0.009), 0, Math.PI * 2);
      g.fill();
    }
  };

  /** Hang it and let it settle without wind, for the still frame */
  const settle = () => {
    const breeze = opts.breeze;
    opts.breeze = 0;
    for (let k = 0; k < 240; k++) substep(H, null);
    opts.breeze = breeze;
  };

  const ensureBuilt = () => {
    if (builtFor !== `${w}x${h}|${opts.lines}|${opts.weave}`) {
      build();
      if (still) settle();
    }
  };

  const nearest = (x: number, y: number) => {
    let best: Point | null = null;
    let bd = Infinity;
    for (const q of pts) {
      if (q.pin) continue;
      const d = (q.x - x) ** 2 + (q.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best && bd < (unit * 0.24) ** 2 ? best : null;
  };

  recolour();
  const ready = loadFont(600, 24, family);

  return {
    ready,

    resize(cssW, cssH, pixelRatio) {
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      ratio = pixelRatio;
      canvas.width = Math.max(1, Math.round(w * ratio));
      canvas.height = Math.max(1, Math.round(h * ratio));
      ensureBuilt();
      if (still) draw();
    },

    render(_now, dt) {
      ensureBuilt();
      simulate(dt);
      draw();
    },

    update(next) {
      opts = { ...opts, ...next };
      ensureBuilt();
      if (still) draw();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      if (still) draw();
    },

    still() {
      still = true;
      ensureBuilt();
      settle();
      draw();
    },

    command(name, arg) {
      if (still) return;
      if (name === "grab") {
        const { x, y } = arg as { x: number; y: number };
        const q = nearest(x, y);
        if (q) {
          held = Object.assign(q, { gx: x, gy: y });
          canvas.dataset.held = "1";
        }
      } else if (name === "pull" && held) {
        const { x, y } = arg as { x: number; y: number };
        held.gx = x;
        held.gy = y;
      } else if (name === "drop") {
        held = null;
        delete canvas.dataset.held;
      } else if (name === "tug") {
        gust = 2.2;
      }
    },

    dispose() {
      held = null;
      for (const key of ["pegs", "cells", "held"]) delete canvas.dataset[key];
      g.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
