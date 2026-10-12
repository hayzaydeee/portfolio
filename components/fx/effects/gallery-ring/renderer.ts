import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { rgbToCss } from "@/components/fx/runtime/palette";
import { loadFont, resolveFontFamily } from "@/components/fx/runtime/fonts";
import { seeded } from "@/components/fx/runtime/random";
import type { GalleryRingOptions } from "./meta";

/**
 * Port of ThreeUI's Gallery Heading (MIT, Meng To): a two-line headline ringed by twelve 4:3
 * plates on a tilted ring, projected in perspective, sorted by depth so the plates pass behind
 * the type and then in front of it. Each plate is one flat colour shaded by its own field
 * (dots on a rotated halftone screen, a matte noise rise, or a dithered riso print), and its
 * reverse side is the same plate darkened. The ring rests until the pointer is over it, then
 * eases up to one orbit every fifteen seconds, and eases back to a stop when it leaves.
 *
 * Changed for the wall: the plates take the colours of the pieces on the wall (`plates`
 * command; the original's "One Wall, Twelve Plates" palette until they arrive), the type is
 * the room's serif in its pin red and caption ink over a transparent stage, the headline is
 * never stretched to a width (it shrinks to fit instead), and the ring arrives turning and
 * settles, so a visitor sees it move once without reaching for it. It draws only while it
 * turns. Plate textures are painted on the CPU: a halftone plate is thousands of dots.
 */

/** The original's design frame; every length below is in it */
const DW = 2962;
const DH = 2160;
const DASP = DW / DH;
const RING = { cx: 1484, cy: 1108, a: 712, ratio: 0.492, n: 12, tile: 346, aspect: 0.75, radius: 0.22, dist: 13 };
/** One revolution, a seamless loop */
const DUR = 15.015;
const HEAD_CAP = 142;
const HEAD_MID = 1093;
const HEAD_TOPS = [930, 1114];
/** Seconds for the orbit to reach speed under the pointer, and to settle after it leaves */
const EASE = 0.55;
const SETTLE = 0.9;
/** Plate texture side: the plates never draw larger than this on a phone or a laptop */
const TS = 256;
/** The original's "One Wall, Twelve Plates" gallery: what the ring shows until the pieces' colours arrive */
const FALLBACK = ["#12110f", "#f2efe8", "#1c1b18", "#e4e0d7", "#2b2a26", "#d6d1c6", "#0a0a09", "#faf8f3", "#1f1e1a", "#eae6dd", "#161513", "#c0402c"];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

type C255 = [number, number, number];

function surface(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d", { willReadFrequently: true })! };
}

function parseHex(hex: string): C255 | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

const mix = (a: C255, b: C255, t: number): C255 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: C255) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const luma = (c: C255) => (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255;

/** Value noise on a 64x64 lattice, smoothstep-interpolated and wrapped */
function noiseField(seed: number) {
  const r = seeded(seed);
  const g = Float32Array.from({ length: 4096 }, () => r());
  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    let fx = x - x0;
    let fy = y - y0;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const ra = (y0 & 63) * 64;
    const rb = ((y0 + 1) & 63) * 64;
    const ca = x0 & 63;
    const cb = (x0 + 1) & 63;
    const a = g[ra + ca];
    const b = g[ra + cb];
    const c = g[rb + ca];
    const d = g[rb + cb];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

function fbm(n: (x: number, y: number) => number, x: number, y: number, oct: number) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  let tot = 0;
  for (let i = 0; i < oct; i++) {
    v += amp * n(x * f, y * f);
    tot += amp;
    amp *= 0.5;
    f *= 2;
  }
  return v / tot;
}

const grainTile = (() => {
  let tile: HTMLCanvasElement | null = null;
  return () => {
    if (tile) return tile;
    const s = surface(160, 160);
    const d = s.ctx.createImageData(160, 160);
    const r = seeded(0x51f3);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 128 + (r() - 0.5) * 116;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    s.ctx.putImageData(d, 0, 0);
    tile = s.canvas;
    return tile;
  };
})();

function grain(x: CanvasRenderingContext2D, alpha: number) {
  x.save();
  x.globalCompositeOperation = "overlay";
  x.globalAlpha = alpha;
  x.fillStyle = x.createPattern(grainTile(), "repeat")!;
  x.fillRect(0, 0, TS, TS);
  x.restore();
}

/** A low-resolution field, blown up over the whole plate: smooth for matte, nearest where it keeps its edges */
function field(x: CanvasRenderingContext2D, N: number, smooth: boolean, shade: (u: number, v: number, px: number, py: number) => C255) {
  const buf = surface(N, N);
  const d = buf.ctx.createImageData(N, N);
  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      const c = shade((px + 0.5) / N, (py + 0.5) / N, px, py);
      const o = (py * N + px) * 4;
      d.data[o] = c[0];
      d.data[o + 1] = c[1];
      d.data[o + 2] = c[2];
      d.data[o + 3] = 255;
    }
  }
  buf.ctx.putImageData(d, 0, 0);
  x.save();
  x.imageSmoothingEnabled = smooth;
  x.drawImage(buf.canvas, 0, 0, TS, TS);
  x.restore();
}

/** A museum plate: flat colour, one slow rise of noise across it, grain fine enough to read as surface */
function paintMatte(x: CanvasRenderingContext2D, base: C255, i: number) {
  const n = noiseField(0x2c41 + i * 9176);
  const hi = mix(base, [255, 255, 255], 0.13);
  const lo = mix(base, [0, 0, 0], 0.15);
  field(x, 160, true, (u, v) => {
    let s = 0.5 + (fbm(n, u * 6.5, v * 6.5, 5) - 0.5) * 1.9 + (v - 0.5) * 0.07;
    s = Math.min(1, Math.max(0, s));
    return s < 0.5 ? mix(lo, base, s * 2) : mix(base, hi, (s - 0.5) * 2);
  });
  grain(x, 0.1);
}

/** The printed plate: a lit corner and a noise field quantised to three tones through an ordered dither */
function paintRiso(x: CanvasRenderingContext2D, base: C255, i: number) {
  const n = noiseField(0x77a3 + i * 15731);
  const lo = mix(base, [24, 14, 6], 0.66);
  const hi = mix(base, [255, 238, 196], 0.5);
  const cx = 0.22 + (i % 3) * 0.28;
  const cy = 0.2 + Math.floor(i / 3) * 0.2;
  field(x, 100, false, (u, v, px, py) => {
    const d = Math.hypot(u - cx, v - cy);
    const s = (1 - d * 1.25) * 0.72 + fbm(n, u * 3.2, v * 3.2, 3) * 0.52 - 0.1;
    const band = Math.floor(s * 2.4 + (BAYER[(py & 3) * 4 + (px & 3)] + 0.5) / 16);
    return band <= 0 ? lo : band === 1 ? base : hi;
  });
  x.save();
  x.fillStyle = "rgba(28,14,4,0.18)";
  for (let k = 0; k < TS; k += 6) x.fillRect(0, k, TS, 2);
  x.restore();
  grain(x, 0.22);
}

/** One ink on one stock, shaded only by the size of the dots on a screen turned further for every plate */
function paintHalftone(x: CanvasRenderingContext2D, base: C255, i: number) {
  const n = noiseField(0x3f19 + i * 21467);
  x.fillStyle = css(base);
  x.fillRect(0, 0, TS, TS);
  const dot = luma(base) > 0.5 ? mix(base, [0, 0, 0], 0.88) : mix(base, [255, 255, 255], 0.9);
  const pitch = TS / 30;
  const a = ((17 + (i % 4) * 9) * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const span = Math.ceil(TS / pitch);
  x.save();
  x.fillStyle = css(dot);
  x.translate(TS / 2, TS / 2);
  x.rotate(a);
  x.beginPath();
  for (let gy = -span; gy <= span; gy++) {
    for (let gx = -span; gx <= span; gx++) {
      const wx = gx * pitch;
      const wy = gy * pitch;
      const u = (wx * ca - wy * sa) / TS + 0.5;
      const v = (wx * sa + wy * ca) / TS + 0.5;
      if (u < -0.1 || u > 1.1 || v < -0.1 || v > 1.1) continue;
      const s = fbm(n, u * 2.7, v * 2.7, 4) * 0.95 + (0.55 - v) * 0.5;
      const rad = pitch * 0.66 * Math.min(1, Math.max(0, s));
      if (rad < 0.4) continue;
      x.moveTo(wx + rad, wy);
      x.arc(wx, wy, rad, 0, Math.PI * 2);
    }
  }
  x.fill();
  x.restore();
  grain(x, 0.12);
}

const PAINTERS = { halftone: paintHalftone, matte: paintMatte, riso: paintRiso };

function roundRect(x: CanvasRenderingContext2D, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(-w / 2 + r, -h / 2);
  x.lineTo(w / 2 - r, -h / 2);
  x.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  x.lineTo(w / 2, h / 2 - r);
  x.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  x.lineTo(-w / 2 + r, h / 2);
  x.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  x.lineTo(-w / 2, -h / 2 + r);
  x.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  x.closePath();
}

export function create(ctx: FxContext, initial: GalleryRingOptions): FxInstance<GalleryRingOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");

  let plates: C255[] = FALLBACK.map((h) => parseHex(h)!);
  let front: HTMLCanvasElement[] = [];
  let back: HTMLCanvasElement[] = [];
  let family = "serif";
  let reduced = ctx.reducedMotion;
  let W = 1;
  let H = 1;
  let K = 1;
  let OX = 0;
  let OY = 0;
  let tNow = 0;
  let rate = 0;
  let dirty = true;
  let arrived = false;
  let U: [number, number, number] = [1, 0, 0];
  let V: [number, number, number] = [0, 1, 0];
  let AX: [number, number, number] = [0, 0, 1];
  let phase = 0;
  let direction = 1;

  const geometry = () => {
    const ax = (opts.axis * Math.PI) / 180;
    const cf = RING.ratio;
    const sf = Math.sqrt(1 - cf * cf);
    U = [Math.cos(ax), Math.sin(ax), 0];
    V = [-Math.sin(ax) * cf, Math.cos(ax) * cf, sf];
    AX = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]];
    // Where tile 0 rests and which way the ring turns, as the original's four galleries set them
    const a = Math.abs(opts.axis);
    phase = a >= 45 ? 90 - a : 90 + opts.axis * (3 / 25.5);
    direction = opts.axis >= 45 || opts.axis < 0 ? -1 : 1;
  };

  const paintPlates = () => {
    const painter = PAINTERS[opts.field] ?? paintHalftone;
    front = [];
    back = [];
    for (let i = 0; i < RING.n; i++) {
      const f = surface(TS, TS);
      painter(f.ctx, plates[i % plates.length], i);
      front.push(f.canvas);
      // The reverse side: the same plate, washed out and sunk into shadow
      const b = surface(TS, TS);
      b.ctx.drawImage(f.canvas, 0, 0);
      b.ctx.globalCompositeOperation = "saturation";
      b.ctx.fillStyle = "rgba(128,128,128,0.2)";
      b.ctx.fillRect(0, 0, TS, TS);
      b.ctx.globalCompositeOperation = "multiply";
      b.ctx.fillStyle = "rgba(10,12,24,0.45)";
      b.ctx.fillRect(0, 0, TS, TS);
      back.push(b.canvas);
    }
    canvas.dataset.plates = String(plates.length);
    dirty = true;
  };

  const project = (p: [number, number, number]) => {
    const k = (RING.a * K * RING.dist) / (RING.dist - p[2]);
    return [OX + RING.cx * K + k * p[0], OY + RING.cy * K + k * p[1]];
  };

  const drawTile = (i: number, psi: number) => {
    const c = Math.cos(psi);
    const s = Math.sin(psi);
    const C: [number, number, number] = [c * U[0] + s * V[0], c * U[1] + s * V[1], c * U[2] + s * V[2]];
    const T = [-s * U[0] + c * V[0], -s * U[1] + c * V[1], -s * U[2] + c * V[2]];
    const h = RING.tile / (2 * RING.a);
    const p0 = project(C);
    const pT = project([C[0] + T[0] * h, C[1] + T[1] * h, C[2] + T[2] * h]);
    const pA = project([C[0] + AX[0] * h, C[1] + AX[1] * h, C[2] + AX[2] * h]);
    const ex = pT[0] - p0[0];
    const ey = pT[1] - p0[1];
    const fx = pA[0] - p0[0];
    const fy = pA[1] - p0[1];
    if (Math.abs(ex * fy - ey * fx) < 0.4) return; // edge on
    const img = (C[2] > 0 ? front : back)[i];
    if (!img) return;
    g.save();
    g.setTransform((ex * 2) / TS, (ey * 2) / TS, (fx * 2) / TS, (fy * 2) / TS, p0[0], p0[1]);
    roundRect(g, TS, TS * RING.aspect, TS * RING.aspect * RING.radius);
    g.clip();
    g.drawImage(img, -TS / 2, -TS / 2, TS, TS);
    g.restore();
  };

  /** The two lines at the original's cap height, shrunk together if the longer would leave the frame */
  const drawHeadline = () => {
    const lines = [opts.title, opts.subtitle].map((s) => s.trim()).filter(Boolean);
    if (!lines.length) return;
    let cap = HEAD_CAP * opts.headlineSize * K;
    const probe = 100;
    g.font = `400 ${probe}px ${family}`;
    const capUnit = (g.measureText("H").actualBoundingBoxAscent || 71) / probe;
    let size = cap / capUnit;
    const track = 0.06 * cap;
    const setFont = () => {
      g.font = `400 ${size}px ${family}`;
      if ("letterSpacing" in g) g.letterSpacing = `${track.toFixed(2)}px`;
    };
    setFont();
    const widest = Math.max(...lines.map((l) => g.measureText(l).width));
    const room = DW * K * 0.9;
    if (widest > room) {
      size *= room / widest;
      cap *= room / widest;
      setFont();
    }
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    const inks = [palette.accent, palette.text];
    const tops = lines.length === 1 ? [HEAD_MID - HEAD_CAP / 2] : HEAD_TOPS;
    lines.forEach((line, i) => {
      g.fillStyle = rgbToCss(inks[i] as RGB);
      const top = OY + (HEAD_MID + (tops[i] - HEAD_MID) * opts.headlineSize) * K;
      g.fillText(line, OX + 1481 * K, top + cap);
    });
    if ("letterSpacing" in g) g.letterSpacing = "0px";
  };

  const render = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.imageSmoothingQuality = "high";
    const spin = (tNow / DUR) * Math.PI * 2 * direction;
    const list = Array.from({ length: RING.n }, (_, i) => {
      const psi = (phase * Math.PI) / 180 - (i * 2 * Math.PI) / RING.n + spin;
      return { i, psi, z: Math.cos(psi) * U[2] + Math.sin(psi) * V[2] };
    }).sort((a, b) => a.z - b.z);
    let typed = false;
    for (const t of list) {
      if (!typed && t.z > 0) {
        drawHeadline();
        typed = true;
      }
      drawTile(t.i, t.psi);
    }
    if (!typed) drawHeadline();
    dirty = false;
  };

  const ready = (async () => {
    family = resolveFontFamily("--font-serif");
    await loadFont(400, 64, family);
    geometry();
    paintPlates();
  })();

  return {
    ready,

    resize(cssW, cssH, pr) {
      W = Math.max(1, Math.round(cssW * pr));
      H = Math.max(1, Math.round(cssH * pr));
      canvas.width = W;
      canvas.height = H;
      const S = Math.min(W, H * DASP);
      K = S / DW;
      OX = (W - DW * K) / 2;
      OY = (H - DH * K) / 2;
      dirty = true;
      if (front.length) render();
    },

    render(_now, dt) {
      if (!front.length) return;
      const step = Math.min(dt, 64) / 1000;
      if (!arrived) {
        // It arrives turning and settles, so the ring is seen to move once on its own
        arrived = true;
        if (!reduced) rate = 2 * opts.speed;
      }
      if (reduced) {
        if (dirty) render();
        return;
      }
      const target = ctx.pointer().inside ? opts.speed : 0;
      rate += (target - rate) * (1 - Math.exp(-step / (target > rate ? EASE : SETTLE)));
      const turning = Math.abs(rate) > 0.0004;
      if (canvas.dataset.turning !== String(turning)) canvas.dataset.turning = String(turning);
      if (turning) {
        tNow = (((tNow + step * rate) % DUR) + DUR) % DUR;
        render();
      } else {
        rate = 0;
        if (dirty) render();
      }
    },

    update(next) {
      const repaint = next.field !== undefined && next.field !== opts.field;
      opts = { ...opts, ...next };
      geometry();
      if (repaint) paintPlates();
      dirty = true;
      if (reduced && front.length) render();
    },

    setPalette(p: RoomPalette) {
      palette = p;
      dirty = true;
      if (front.length) render();
    },

    command(name, arg) {
      if (name !== "plates" || !Array.isArray(arg)) return;
      const next = arg.map((c) => (typeof c === "string" ? parseHex(c) : null)).filter((c): c is C255 => c !== null);
      if (!next.length) return;
      plates = next;
      canvas.dataset.plateSource = "pieces";
      void ready.then(() => {
        paintPlates();
        render();
      });
    },

    still() {
      reduced = true;
      rate = 0;
      void ready.then(render);
    },

    dispose() {
      front = [];
      back = [];
    },
  };
}
