import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB, rgbToCss } from "@/components/fx/runtime/palette";
import { loadFont, resolveFontFamily } from "@/components/fx/runtime/fonts";
import { HZY_MARK_PATH } from "@/components/nav/hzyMarkPath";
import type { OutlineTypeflowOptions } from "./meta";

/**
 * Port of "Outline Typeflow" from ThreeUI's Text Path Studies II (MIT, Meng To): a mark's
 * outline sampled into arc-length-parameterised polylines, with a phrase flowing along them,
 * each glyph turned to the path's tangent. The original traced a third-party logo; this one
 * traces the HZY mark, in the room's ink with a glow where the pointer looks.
 */

const SVGNS = "http://www.w3.org/2000/svg";
/** Sample step as a share of the mark's viewBox (the original's 0.05 on 24) */
const SAMPLE = 0.05 / 24;
/** The mark's long side as a share of the canvas short side */
const SPAN = 0.8;
const HOVER_SPEED = 3.1;
const KICK_S = 1.1;
const LIT_STEPS = 5;
/** Glyph rotations snap to 64 steps so the glyph cache stays warm */
const QA = (Math.PI * 2) / 64;
const qang = (a: number) => Math.round(a / QA) * QA;

type Line = { xs: Float32Array; ys: Float32Array; acc: Float32Array; len: number };

/** Dense samples of the path, split wherever the pen jumps between subpaths */
function polylines(host: HTMLElement, d: string, step: number): { lines: Line[]; box: { x0: number; y0: number; x1: number; y1: number } } {
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  const el = document.createElementNS(SVGNS, "path");
  el.setAttribute("d", d);
  svg.appendChild(el);
  host.appendChild(svg);

  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const runs: { x: number; y: number }[][] = [];
  try {
    const L = el.getTotalLength();
    const n = Math.max(64, Math.ceil(L / step));
    let cur: { x: number; y: number }[] = [];
    let prev: DOMPoint | null = null;
    for (let i = 0; i <= n; i++) {
      const p = el.getPointAtLength((L * i) / n);
      if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) > step * 6) {
        if (cur.length > 3) runs.push(cur);
        cur = [];
      }
      cur.push({ x: p.x, y: p.y });
      box.x0 = Math.min(box.x0, p.x);
      box.y0 = Math.min(box.y0, p.y);
      box.x1 = Math.max(box.x1, p.x);
      box.y1 = Math.max(box.y1, p.y);
      prev = p;
    }
    if (cur.length > 3) runs.push(cur);
  } finally {
    svg.remove();
  }

  const lines = runs
    .map((pts) => {
      const xs = new Float32Array(pts.length);
      const ys = new Float32Array(pts.length);
      const acc = new Float32Array(pts.length);
      pts.forEach((p, i) => {
        xs[i] = p.x;
        ys[i] = p.y;
        if (i) acc[i] = acc[i - 1] + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
      });
      return { xs, ys, acc, len: acc[pts.length - 1] };
    })
    .filter((l) => l.len > step * 8);
  return { lines, box };
}

const at = { x: 0, y: 0, a: 0 };
function atLength(line: Line, t: number) {
  t -= Math.floor(t / line.len) * line.len;
  const a = line.acc;
  let lo = 0;
  let hi = a.length - 1;
  while (lo < hi - 1) {
    const m = (lo + hi) >> 1;
    if (a[m] <= t) lo = m;
    else hi = m;
  }
  const f = (t - a[lo]) / (a[hi] - a[lo] || 1);
  at.x = line.xs[lo] + (line.xs[hi] - line.xs[lo]) * f;
  at.y = line.ys[lo] + (line.ys[hi] - line.ys[lo]) * f;
  at.a = Math.atan2(line.ys[hi] - line.ys[lo], line.xs[hi] - line.xs[lo]);
  return at;
}

export function create(ctx: FxContext, initial: OutlineTypeflowOptions): FxInstance<OutlineTypeflowOptions> {
  let opts = { ...initial };
  const { canvas, layer } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");

  const family = resolveFontFamily("--font-sans");
  const { lines, box } = polylines(layer, HZY_MARK_PATH, 1024 * SAMPLE);
  let palette = ctx.palette;
  let w = 1;
  let h = 1;
  let ratio = 1;
  let still = false;
  let flow = 0;
  let speed = 1;
  let kickAt = -Infinity;
  let lit: string[] = [];
  let chars = Array.from(opts.phrase);

  const recolour = () => {
    const ink: RGB = opts.sourcePalette ? [226 / 255, 228 / 255, 233 / 255] : palette.text;
    const glow: RGB = opts.sourcePalette ? ink : palette.glow;
    // Base ink, then brighter steps toward the glow where the pointer looks
    lit = Array.from({ length: LIT_STEPS + 1 }, (_, i) => rgbToCss(mixRGB(ink, glow, i / LIT_STEPS), 0.8 + (0.2 * i) / LIT_STEPS));
  };

  const draw = (now: number, dt: number) => {
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, h);
    if (!lines.length) return;

    const p = ctx.pointer();
    if (!still) {
      speed += ((p.inside ? HOVER_SPEED : 1) - speed) * Math.min(1, dt / 280);
      flow += ((speed * opts.speed * dt) / 1000) * 1.9 * (1024 / 24);
    }

    const u = Math.min(w, h);
    const span = Math.max(box.x1 - box.x0, box.y1 - box.y0) || 1;
    const k = (u * SPAN) / span;
    const mx = (box.x0 + box.x1) / 2;
    const my = (box.y0 + box.y1) / 2;
    const cx = w / 2;
    const cy = h / 2;
    const fs = u * opts.glyph;
    const step = (fs * 0.76) / k;

    // The latest click shoves every letter outward, settling back over a second
    const age = (now - kickAt) / 1000;
    let kick = Math.max(0, 1 - age / KICK_S);
    kick *= kick;

    const look = !still && p.inside ? p : null;
    const LR = u * 0.22;
    const LR2 = LR * LR;

    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `700 ${fs.toFixed(2)}px ${family}`;
    g.globalAlpha = 1 - kick * 0.35;
    let level = -1;
    let idx = 0;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const n = Math.max(3, Math.round(line.len / step));
      const sp = line.len / n;
      for (let i = 0; i < n; i++) {
        const q = atLength(line, i * sp + flow);
        let x = cx + (q.x - mx) * k;
        let y = cy + (q.y - my) * k;
        if (kick > 0) {
          const dx = x - cx;
          const dy = y - cy;
          const d = Math.hypot(dx, dy) || 1;
          const wob = Math.sin(i * 1.7 + li * 2.3);
          x += (dx / d) * kick * u * 0.11 * (0.6 + 0.5 * wob);
          y += (dy / d) * kick * u * 0.11 * (0.6 + 0.5 * wob);
        }
        let lv = 0;
        if (look) {
          const dd = (x - look.x) ** 2 + (y - look.y) ** 2;
          if (dd < LR2) lv = Math.min(LIT_STEPS, Math.ceil((1 - Math.sqrt(dd) / LR) * LIT_STEPS));
        }
        // Quantised, so fillStyle changes rarely
        if (lv !== level) {
          level = lv;
          g.fillStyle = lit[lv];
        }
        const ch = chars[idx++ % chars.length];
        if (ch === " ") continue;
        g.save();
        g.translate(x, y);
        g.rotate(qang(q.a));
        g.fillText(ch, 0, 0);
        g.restore();
      }
    }
    g.globalAlpha = 1;
  };

  recolour();
  canvas.dataset.lines = String(lines.length);
  const ready = loadFont(700, 16, family);

  return {
    ready,

    resize(cssW, cssH, pixelRatio) {
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      ratio = pixelRatio;
      canvas.width = Math.max(1, Math.round(w * ratio));
      canvas.height = Math.max(1, Math.round(h * ratio));
      if (still) draw(performance.now(), 0);
    },

    render(now, dt) {
      draw(now, Math.min(64, dt));
    },

    update(next) {
      opts = { ...opts, ...next };
      chars = Array.from(opts.phrase || "·");
      recolour();
      if (still) draw(performance.now(), 0);
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      if (still) draw(performance.now(), 0);
    },

    still() {
      still = true;
      flow = 0;
      draw(performance.now(), 0);
    },

    command(name) {
      if (name === "click" || name === "kick") kickAt = performance.now();
    },

    dispose() {
      g.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
