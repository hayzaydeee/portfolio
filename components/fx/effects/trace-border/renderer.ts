import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { rgbToCss } from "@/components/fx/runtime/palette";
import type { TraceBorderOptions } from "./meta";

/**
 * Port of ThreeUI's Thinking ("Uploading") button trace (MIT, Meng To). The comet runs a
 * rounded rectangle by arc length, with the original's measured taper (hot head, flat core,
 * long uneven fade) and a lap of 2.7s. The source stacked three filter blurs; here the glow is
 * one shadow pass, the outline fits whatever the canvas wraps, and colours come from the room.
 */

const TAIL = 0.389;
const TAPER = [1.16, 1.09, 1.03, 1, 1.02, 1, 1, 1, 1, 0.98, 0.97, 0.94, 0.91, 0.89, 0.84, 0.77, 0.74, 0.65, 0.61, 0.52, 0.43, 0.4, 0.27, 0.23, 0.17, 0.12, 0.075, 0.02, 0];
const TSTEP = TAIL / (TAPER.length - 1);
const SEGMENTS = 64;

function taper(u: number) {
  if (u < 0 || u >= TAIL) return 0;
  const f = u / TSTEP;
  const i = Math.floor(f);
  return TAPER[i] + (TAPER[i + 1] - TAPER[i]) * (f - i);
}

const SOURCE = { glow: [95 / 255, 125 / 255, 242 / 255] as RGB, core: [0.85, 0.88, 1] as RGB, track: [120 / 255, 140 / 255, 1] as RGB };

export function create(ctx: FxContext, initial: TraceBorderOptions): FxInstance<TraceBorderOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");

  let palette = ctx.palette;
  let w = 1;
  let h = 1;
  let ratio = 1;
  let phase = 0;
  let still = false;
  let ramp: string[] = [];
  let glow = "";
  let track = "";

  const recolour = () => {
    const c = opts.sourcePalette ? SOURCE : { glow: palette.glow, core: palette.text, track: palette.glow };
    // Brightness 0..1.3 across 27 steps: past 1 the core heats toward the text colour
    ramp = Array.from({ length: 27 }, (_, i) => {
      const a = (i / 26) * 1.3;
      const hot = Math.max(0, a - 1) / 0.3;
      const rgb: RGB = [0, 1, 2].map((k) => c.glow[k] + (c.core[k] - c.glow[k]) * (0.35 + 0.65 * hot)) as RGB;
      return rgbToCss(rgb, Math.min(1, a));
    });
    glow = rgbToCss(c.glow, 0.9);
    track = rgbToCss(c.track, 0.08);
  };

  // The outline, as a point at arc length s, clockwise from the top-left tangent point
  const geometry = () => {
    const i = opts.inset;
    const L = i;
    const T = i;
    const R = w - i;
    const B = h - i;
    const r = Math.max(0, Math.min(opts.radius, (R - L) / 2, (B - T) / 2));
    const sw = R - L - 2 * r;
    const sh = B - T - 2 * r;
    const arc = (Math.PI * r) / 2;
    const perim = 2 * sw + 2 * sh + 4 * arc;
    const at = (s: number): [number, number] => {
      s -= Math.floor(s / perim) * perim;
      if (s < sw) return [L + r + s, T];
      s -= sw;
      if (s < arc) return [R - r + r * Math.sin(s / r), T + r - r * Math.cos(s / r)];
      s -= arc;
      if (s < sh) return [R, T + r + s];
      s -= sh;
      if (s < arc) return [R - r + r * Math.cos(s / r), B - r + r * Math.sin(s / r)];
      s -= arc;
      if (s < sw) return [R - r - s, B];
      s -= sw;
      if (s < arc) return [L + r - r * Math.sin(s / r), B - r + r * Math.cos(s / r)];
      s -= arc;
      if (s < sh) return [L, B - r - s];
      s -= sh;
      return [L + r - r * Math.cos(s / r), T + r - r * Math.sin(s / r)];
    };
    return { L, T, R, B, r, perim, at };
  };

  const draw = () => {
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, h);
    const { L, T, R, B, r, perim, at } = geometry();
    if (perim <= 0) return;

    // The faint track the light runs on
    g.beginPath();
    g.roundRect(L, T, R - L, B - T, r);
    g.strokeStyle = track;
    g.lineWidth = opts.width;
    g.stroke();

    // The comet, segment by segment from the tail to the head, bloomed in one shadow pass
    const head = phase * perim;
    const stepLen = (TAIL * perim) / SEGMENTS;
    g.lineCap = "round";
    g.lineWidth = opts.width;
    g.shadowColor = glow;
    g.shadowBlur = 6;
    for (let i = SEGMENTS; i >= 1; i--) {
      const a = taper((i * stepLen) / perim);
      if (a <= 0.002) continue;
      const [x1, y1] = at(head - i * stepLen);
      const [xm, ym] = at(head - (i - 0.5) * stepLen);
      const [x0, y0] = at(head - (i - 1) * stepLen);
      g.strokeStyle = ramp[Math.min(26, Math.round((Math.min(a, 1.3) / 1.3) * 26))];
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(xm, ym);
      g.lineTo(x0, y0);
      g.stroke();
    }
    g.shadowBlur = 0;
  };

  recolour();

  return {
    resize(cssW, cssH, pr) {
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      ratio = pr;
      canvas.width = Math.max(1, Math.round(w * pr));
      canvas.height = Math.max(1, Math.round(h * pr));
      if (still) draw();
    },

    render(_now, dt) {
      phase = (phase + Math.min(50, dt) / 1000 / Math.max(0.1, opts.lap)) % 1;
      draw();
    },

    update(next) {
      opts = { ...opts, ...next };
      recolour();
      if (still) draw();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      if (still) draw();
    },

    still() {
      // Reduced motion: the comet parked at the top-left, still reading as "working"
      still = true;
      phase = 0.12;
      draw();
    },

    dispose() {
      g.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
