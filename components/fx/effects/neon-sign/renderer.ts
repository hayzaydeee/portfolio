import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB, resolveToken, rgbToCss } from "@/components/fx/runtime/palette";
import type { NeonSignOptions } from "./meta";

/**
 * Port of ThreeUI's Glassblown neon (MIT, Meng To). Letters are hand-built strokes in cap-height
 * units, and each is painted in the original's passes: a wide soft spill and a bloom (baked at
 * a third and a half of the resolution), the dark glass tube, a three-tone core, a specular
 * streak masked to the tube, dark end caps, and glowing electrodes where the gas enters. All of
 * it bakes once per size; a frame only composites the flickering letter over the steady sign
 * on the original's seeded stutter schedule, and only while it changes.
 *
 * The original covered G L A S B O W N; I T H E and a space are drawn here in the same hand.
 * Lines are centred rather than justified, so lines of different lengths sit naturally.
 */

const P = Math.PI;
type Cmd =
  | ["M", number, number]
  | ["L", number, number]
  | ["Q", number, number, number, number]
  | ["R", number, number, number, number, number]
  | ["E", number, number, number, number, number, number, number];
type Sub = { c: Cmd[]; closed?: boolean };
type Glyph = { w: number; sub: Sub[] };

const GLYPHS: Record<string, Glyph> = {
  G: { w: 0.88, sub: [{ c: [["M", 0.7946, 0.232], ["E", 0.44, 0.5, 0.42, 0.5, -0.18 * P, -1.87 * P, 1], ["Q", 0.902, 0.606, 0.86, 0.492], ["L", 0.47, 0.492]] }] },
  L: { w: 0.6, sub: [{ c: [["M", 0.09, 0], ["L", 0.09, 0.66], ["R", 0.09, 1, 0.6, 1, 0.2], ["L", 0.575, 1]] }] },
  A: { w: 0.9, sub: [{ c: [["M", 0.04, 1], ["R", 0.45, 0, 0.86, 1, 0.105], ["L", 0.86, 1]] }, { c: [["M", 0.174, 0.665], ["L", 0.726, 0.665]] }] },
  S: { w: 0.74, sub: [{ c: [["M", 0.588, 0.0478], ["E", 0.4, 0.25, 0.32, 0.25, -0.3 * P, 0.5 * P, 1], ["E", 0.4, 0.75, 0.32, 0.25, -0.5 * P, 0.86 * P, 0]] }] },
  B: {
    w: 0.74,
    sub: [
      { c: [["M", 0.09, 0], ["L", 0.09, 1]] },
      { c: [["M", 0.09, 0], ["L", 0.28, 0], ["E", 0.28, 0.25, 0.34, 0.25, -0.5 * P, 0.5 * P, 0], ["L", 0.09, 0.5]] },
      { c: [["M", 0.09, 0.5], ["L", 0.3, 0.5], ["E", 0.3, 0.75, 0.38, 0.25, -0.5 * P, 0.5 * P, 0], ["L", 0.09, 1]] },
    ],
  },
  O: { w: 0.9, sub: [{ closed: true, c: [["M", 0.46, 0], ["E", 0.46, 0.5, 0.42, 0.5, -0.5 * P, 1.5 * P, 0]] }] },
  W: { w: 1.09, sub: [{ c: [["M", 0.03, 0], ["R", 0.24, 1, 0.545, 0.3, 0.07], ["R", 0.545, 0.3, 0.85, 1, 0.07], ["R", 0.85, 1, 1.06, 0, 0.07], ["L", 1.06, 0]] }] },
  N: { w: 0.88, sub: [{ c: [["M", 0.08, 1], ["R", 0.08, 0, 0.84, 1, 0.075], ["R", 0.84, 1, 0.84, 0, 0.075], ["L", 0.84, 0]] }] },
  // Added in the same hand: single strokes, the original's rounded corners where a stroke turns
  I: { w: 0.2, sub: [{ c: [["M", 0.1, 0], ["L", 0.1, 1]] }] },
  T: { w: 0.7, sub: [{ c: [["M", 0.03, 0], ["L", 0.67, 0]] }, { c: [["M", 0.35, 0], ["L", 0.35, 1]] }] },
  H: { w: 0.82, sub: [{ c: [["M", 0.09, 0], ["L", 0.09, 1]] }, { c: [["M", 0.73, 0], ["L", 0.73, 1]] }, { c: [["M", 0.09, 0.5], ["L", 0.73, 0.5]] }] },
  E: {
    w: 0.66,
    sub: [
      { c: [["M", 0.62, 0], ["R", 0.09, 0, 0.09, 1, 0.16], ["R", 0.09, 1, 0.62, 1, 0.16], ["L", 0.62, 1]] },
      { c: [["M", 0.09, 0.5], ["L", 0.52, 0.5]] },
    ],
  },
  " ": { w: 0.36, sub: [] },
};

const MINGAP = 0.17;
const LINEGAP = 0.46;
const SPILL_S = 0.34;
const BLOOM_S = 0.5;

type Item = { g: Glyph; ox: number; oy: number; s: number };
type Gas = {
  spill: [string, string];
  bloom: [string, string];
  core: [string, string, string];
  tube: [string, string];
  spec: string;
  cap: string;
  capRim: string;
  capGlint: string;
  electrode: [string, string, string];
  electrodeRim: string;
  electrodeGlow: [string, string, string];
};

const SOURCE_GAS: Gas = {
  spill: ["rgba(255,22,118,1)", "rgba(255,40,140,1)"],
  bloom: ["rgba(255,40,146,1)", "rgba(255,100,188,1)"],
  core: ["#ff2a96", "#ff8ed2", "#fff4fb"],
  tube: ["#3d162a", "#280c1a"],
  spec: "rgba(255,240,250,.52)",
  cap: "#33101f",
  capRim: "rgba(255,150,205,.20)",
  capGlint: "rgba(255,205,235,.14)",
  electrode: ["#120a10", "#0b0509", "#180a12"],
  electrodeRim: "rgba(214,120,164,.30)",
  electrodeGlow: ["rgba(255,226,244,.95)", "rgba(255,90,180,.62)", "rgba(255,50,150,0)"],
};

/** A gas colour from the room: the token pushed to full brightness, so it reads as lit */
function gasFrom(rgb: RGB, base: RGB): Gas {
  const peak = Math.max(rgb[0], rgb[1], rgb[2], 1e-3);
  const neon: RGB = [rgb[0] / peak, rgb[1] / peak, rgb[2] / peak];
  const white: RGB = [1, 1, 1];
  return {
    spill: [rgbToCss(neon), rgbToCss(mixRGB(neon, white, 0.12))],
    bloom: [rgbToCss(mixRGB(neon, white, 0.08)), rgbToCss(mixRGB(neon, white, 0.36))],
    core: [rgbToCss(mixRGB(neon, white, 0.06)), rgbToCss(mixRGB(neon, white, 0.5)), rgbToCss(mixRGB(neon, white, 0.94))],
    tube: [rgbToCss(mixRGB(base, neon, 0.2)), rgbToCss(mixRGB(base, neon, 0.12))],
    spec: rgbToCss(mixRGB(neon, white, 0.9), 0.52),
    cap: rgbToCss(mixRGB(base, neon, 0.16)),
    capRim: rgbToCss(mixRGB(neon, white, 0.5), 0.2),
    capGlint: rgbToCss(mixRGB(neon, white, 0.75), 0.14),
    electrode: [rgbToCss(mixRGB(base, neon, 0.06)), rgbToCss(mixRGB(base, [0, 0, 0], 0.4)), rgbToCss(mixRGB(base, neon, 0.1))],
    electrodeRim: rgbToCss(mixRGB(neon, white, 0.3), 0.3),
    electrodeGlow: [rgbToCss(mixRGB(neon, white, 0.85), 0.95), rgbToCss(mixRGB(neon, white, 0.3), 0.62), rgbToCss(neon, 0)],
  };
}

function mk(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function emit(x: CanvasRenderingContext2D, sp: Sub, ox: number, oy: number, s: number) {
  for (const c of sp.c) {
    if (c[0] === "M") x.moveTo(ox + c[1] * s, oy + c[2] * s);
    else if (c[0] === "L") x.lineTo(ox + c[1] * s, oy + c[2] * s);
    else if (c[0] === "Q") x.quadraticCurveTo(ox + c[1] * s, oy + c[2] * s, ox + c[3] * s, oy + c[4] * s);
    else if (c[0] === "R") x.arcTo(ox + c[1] * s, oy + c[2] * s, ox + c[3] * s, oy + c[4] * s, c[5] * s);
    else x.ellipse(ox + c[1] * s, oy + c[2] * s, c[3] * s, c[4] * s, 0, c[5], c[6], !!c[7]);
  }
}

function trace(x: CanvasRenderingContext2D, items: Item[]) {
  x.beginPath();
  for (const it of items) for (const sp of it.g.sub) emit(x, sp, it.ox, it.oy, it.s);
}

function endsOf(sp: Sub): [number, number][] {
  if (sp.closed || !sp.c.length) return [];
  const a = sp.c[0];
  const last = sp.c[sp.c.length - 1];
  const out: [number, number][] = [[a[1], a[2]]];
  if (last[0] === "L" || last[0] === "M") out.push([last[1], last[2]]);
  else if (last[0] === "Q") out.push([last[3], last[4]]);
  else if (last[0] === "E") out.push([last[1] + last[3] * Math.cos(last[6]), last[2] + last[4] * Math.sin(last[6])]);
  return out;
}

const scaleItems = (items: Item[], k: number): Item[] => items.map((it) => ({ g: it.g, ox: it.ox * k, oy: it.oy * k, s: it.s * k }));

function strokePass(x: CanvasRenderingContext2D, items: Item[], w: number, blur: number, col: string, alpha: number, additive = true) {
  x.save();
  x.lineCap = "round";
  x.lineJoin = "round";
  if (blur > 0.25) x.filter = `blur(${blur.toFixed(2)}px)`;
  if (additive) x.globalCompositeOperation = "lighter";
  x.globalAlpha = alpha;
  x.lineWidth = w;
  x.strokeStyle = col;
  trace(x, items);
  x.stroke();
  x.restore();
}

export function create(ctx: FxContext, initial: NeonSignOptions): FxInstance<NeonSignOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  const out = canvas.getContext("2d");
  if (!out) throw new Error("2D canvas unavailable");

  let W = 0;
  let H = 0;
  let gas: Gas = SOURCE_GAS;
  let base: HTMLCanvasElement | null = null;
  let lit: HTMLCanvasElement | null = null;
  let lastF = -1;
  let clock = 0;
  let still = false;

  // The original's seeded stutter: a pair (sometimes two) of dips every 5.6-12.8 s
  let seed = 0x1981;
  const rnd = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  type Ev = { t0: number; dur: number; segs: { d: number; v: number }[] };
  let ev: Ev | null = null;
  const nextEvent = (after: number): Ev => {
    const segs: { d: number; v: number }[] = [];
    const n = 1 + (rnd() < 0.42 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      segs.push({ d: 0.2 + rnd() * 0.26, v: 0.22 + rnd() * 0.4 });
      segs.push({ d: 0.24 + rnd() * 0.34, v: 1 });
    }
    return { t0: after + 5.6 + rnd() * 7.2, dur: segs.reduce((s, x) => s + x.d, 0), segs };
  };
  const level = (t: number) => {
    if (!ev) ev = nextEvent(4.2);
    while (t > ev.t0 + ev.dur) ev = nextEvent(ev.t0 + ev.dur);
    if (t < ev.t0) return 1;
    let u = t - ev.t0;
    let prev = 1;
    for (const s of ev.segs) {
      if (u < s.d) {
        let p = u / s.d;
        p = p * p * (3 - 2 * p);
        return prev + (s.v - prev) * p;
      }
      u -= s.d;
      prev = s.v;
    }
    return 1;
  };

  const recolour = () => {
    gas = opts.sourcePalette ? SOURCE_GAS : gasFrom(opts.accent ? resolveToken(opts.accent) : palette.glow, palette.base);
  };

  const layout = () => {
    const lines = opts.text
      .toUpperCase()
      .split("/")
      .map((line) => Array.from(line).map((ch) => GLYPHS[ch]).filter(Boolean));
    const widths = lines.map((gl) => gl.reduce((s, g) => s + g.w, 0) + Math.max(0, gl.length - 1) * MINGAP);
    const blockW = Math.max(0.5, ...widths);
    const blockH = lines.length + (lines.length - 1) * LINEGAP;
    // Leave the spill and bloom room to fall off inside the canvas instead of clipping at its edge
    const cap = Math.max(10, Math.min((W * 0.8) / blockW, (H * 0.56) / blockH));
    const tube = cap * 0.105;
    const y0 = (H - blockH * cap) * 0.48;
    const items: Item[] = [];
    const elec: { x: number; y: number; a: number }[] = [];
    lines.forEach((gl, i) => {
      let pen = (W - widths[i] * cap) / 2;
      const top = y0 + i * (1 + LINEGAP) * cap;
      const lineItems: Item[] = [];
      for (const g of gl) {
        const it = { g, ox: pen, oy: top, s: cap };
        if (g.sub.length) {
          items.push(it);
          lineItems.push(it);
        }
        pen += (g.w + MINGAP) * cap;
      }
      // Electrodes where the gas enters and leaves each line
      const first = lineItems[0];
      const last = lineItems[lineItems.length - 1];
      if (first) {
        const [px, py] = endsOf(first.g.sub[0])[0] ?? [0, 0];
        elec.push({ x: first.ox + px * cap, y: first.oy + py * cap, a: -2.4 });
      }
      if (last && last !== first) {
        const sub = last.g.sub[last.g.sub.length - 1];
        const ends = endsOf(sub);
        const [px, py] = ends[ends.length - 1] ?? [0, 0];
        elec.push({ x: last.ox + px * cap, y: last.oy + py * cap, a: -0.7 });
      }
    });
    const flick = opts.flicker >= 0 ? (items[opts.flicker] ?? null) : null;
    return { items, flick, elec, cap, tube };
  };

  const spill = (items: Item[], cap: number) => {
    const c = mk(W * SPILL_S, H * SPILL_S);
    const x = c.getContext("2d")!;
    const it = scaleItems(items, SPILL_S);
    const k = cap * SPILL_S;
    strokePass(x, it, k * 0.62, k * 0.3, gas.spill[0], 0.115);
    strokePass(x, it, k * 0.42, k * 0.11, gas.spill[1], 0.2);
    return c;
  };

  const bloom = (items: Item[], tube: number) => {
    const c = mk(W * BLOOM_S, H * BLOOM_S);
    const x = c.getContext("2d")!;
    const it = scaleItems(items, BLOOM_S);
    const t = tube * BLOOM_S;
    strokePass(x, it, t * 2.6, t * 1.75, gas.bloom[0], 0.3);
    strokePass(x, it, t * 1.34, t * 0.58, gas.bloom[1], 0.48);
    return c;
  };

  const core = (x: CanvasRenderingContext2D, items: Item[], tube: number) => {
    strokePass(x, items, tube * 0.88, tube * 0.1, gas.core[0], 1);
    strokePass(x, items, tube * 0.54, tube * 0.06, gas.core[1], 1);
    strokePass(x, items, tube * 0.24, tube * 0.035, gas.core[2], 1);
  };

  const spec = (items: Item[], tube: number) => {
    const c = mk(W, H);
    const x = c.getContext("2d")!;
    x.save();
    x.translate(-tube * 0.02, -tube * 0.25);
    x.lineCap = "round";
    x.lineJoin = "round";
    x.lineWidth = tube * 0.17;
    x.strokeStyle = gas.spec;
    x.filter = `blur(${(tube * 0.11).toFixed(2)}px)`;
    trace(x, items);
    x.stroke();
    x.restore();
    x.globalCompositeOperation = "destination-in";
    x.lineCap = "round";
    x.lineJoin = "round";
    x.lineWidth = tube * 0.66;
    x.strokeStyle = "#fff";
    trace(x, items);
    x.stroke();
    return c;
  };

  const tips = (x: CanvasRenderingContext2D, items: Item[], tube: number) => {
    x.save();
    for (const it of items) {
      for (const sp of it.g.sub) {
        for (const [ex, ey] of endsOf(sp)) {
          const px = it.ox + ex * it.s;
          const py = it.oy + ey * it.s;
          x.beginPath();
          x.arc(px, py, tube * 0.47, 0, P * 2);
          x.fillStyle = gas.cap;
          x.fill();
          x.lineWidth = 1;
          x.strokeStyle = gas.capRim;
          x.stroke();
          x.beginPath();
          x.arc(px - tube * 0.06, py - tube * 0.1, tube * 0.2, 0, P * 2);
          x.fillStyle = gas.capGlint;
          x.fill();
        }
      }
    }
    x.restore();
  };

  const electrodes = (x: CanvasRenderingContext2D, list: { x: number; y: number; a: number }[], tube: number) => {
    x.save();
    for (const e of list) {
      const sx = e.x + Math.cos(e.a) * tube * 1.55;
      const sy = e.y + Math.sin(e.a) * tube * 1.55;
      x.beginPath();
      x.moveTo(e.x, e.y);
      x.lineTo(sx, sy);
      x.lineCap = "round";
      x.lineWidth = tube * 0.46;
      x.strokeStyle = gas.electrode[0];
      x.stroke();
      x.beginPath();
      x.arc(sx, sy, tube * 0.4, 0, P * 2);
      x.fillStyle = gas.electrode[1];
      x.fill();
      x.beginPath();
      x.arc(e.x, e.y, tube * 0.8, 0, P * 2);
      x.fillStyle = gas.electrode[2];
      x.fill();
      x.lineWidth = 1.4;
      x.strokeStyle = gas.electrodeRim;
      x.stroke();
      const grad = x.createRadialGradient(e.x, e.y, 0, e.x, e.y, tube * 1.25);
      grad.addColorStop(0, gas.electrodeGlow[0]);
      grad.addColorStop(0.24, gas.electrodeGlow[1]);
      grad.addColorStop(1, gas.electrodeGlow[2]);
      x.globalCompositeOperation = "lighter";
      x.beginPath();
      x.arc(e.x, e.y, tube * 1.25, 0, P * 2);
      x.fillStyle = grad;
      x.fill();
      x.globalCompositeOperation = "source-over";
    }
    x.restore();
  };

  const bake = () => {
    const { items, flick, elec, cap, tube } = layout();
    const steady = items.filter((it) => it !== flick);

    const b = mk(W, H);
    const bx = b.getContext("2d")!;
    bx.globalCompositeOperation = "lighter";
    bx.drawImage(spill(steady, cap), 0, 0, W, H);
    bx.drawImage(bloom(steady, tube), 0, 0, W, H);
    bx.globalCompositeOperation = "source-over";
    const t = mk(W, H);
    const tx = t.getContext("2d")!;
    strokePass(tx, items, tube, 0, gas.tube[0], 1, false);
    strokePass(tx, items, tube * 0.7, 0, gas.tube[1], 1, false);
    core(tx, steady, tube);
    tx.globalCompositeOperation = "lighter";
    tx.drawImage(spec(items, tube), 0, 0);
    tx.globalCompositeOperation = "source-over";
    tips(tx, items, tube);
    electrodes(tx, elec, tube);
    bx.drawImage(t, 0, 0);
    base = b;

    lit = null;
    if (flick) {
      const l = mk(W, H);
      const lx = l.getContext("2d")!;
      lx.globalCompositeOperation = "lighter";
      lx.drawImage(spill([flick], cap), 0, 0, W, H);
      lx.drawImage(bloom([flick], tube), 0, 0, W, H);
      lx.globalCompositeOperation = "source-over";
      core(lx, [flick], tube);
      // the lit gas never covers the end caps
      lx.globalCompositeOperation = "destination-out";
      for (const sp of flick.g.sub) {
        for (const [ex, ey] of endsOf(sp)) {
          lx.beginPath();
          lx.arc(flick.ox + ex * flick.s, flick.oy + ey * flick.s, tube * 0.47, 0, P * 2);
          lx.fill();
        }
      }
      lit = l;
    }
    lastF = -1;
  };

  const compose = (f: number) => {
    if (!base) return;
    out.globalCompositeOperation = "source-over";
    out.globalAlpha = 1;
    out.clearRect(0, 0, W, H);
    out.drawImage(base, 0, 0);
    if (lit && f > 0.002) {
      out.globalCompositeOperation = "lighter";
      out.globalAlpha = f;
      out.drawImage(lit, 0, 0);
    }
    out.globalCompositeOperation = "source-over";
    out.globalAlpha = 1;
    lastF = f;
  };

  recolour();

  return {
    resize(cssW, cssH, pr) {
      const nw = Math.max(1, Math.round(cssW * pr));
      const nh = Math.max(1, Math.round(cssH * pr));
      if (nw === W && nh === H) return;
      W = canvas.width = nw;
      H = canvas.height = nh;
      bake();
      compose(still ? 1 : level(clock));
    },

    render(_now, dt) {
      clock += Math.min(50, dt) / 1000;
      const f = level(clock);
      if (Math.abs(f - lastF) > 0.008) compose(f);
    },

    update(next) {
      opts = { ...opts, ...next };
      recolour();
      if (W && H) {
        bake();
        compose(still ? 1 : level(clock));
      }
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      if (W && H) {
        bake();
        compose(still ? 1 : level(clock));
      }
    },

    still() {
      still = true;
      compose(1);
    },

    dispose() {
      base = null;
      lit = null;
    },
  };
}
