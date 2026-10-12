import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB, resolveToken } from "@/components/fx/runtime/palette";
import { hashString, seeded } from "@/components/fx/runtime/random";
import type { EngravedPlateOptions } from "./meta";

/**
 * Port of ThreeUI's Engraved Certificate ("Kinetic Lathe", MIT, Meng To). Everything is drawn
 * the way the original draws it: a ground of wave rules under paper speckle, a guilloché band
 * (nine phase-shifted sine strands run along a rounded-rect rail) between hairline rules, and a
 * medallion of hypotrochoid rosettes, the inner one slowly turning.
 *
 * Changed for the notebook: the plate fills an entry's header band and the page's own type sits
 * on it, so the medallion moves beside the header on a wide plate and becomes a faint watermark
 * behind it on a narrow one. The rosettes' lobe counts and phases come from the entry (its
 * `seed`), so every entry carries its own seal; the original cycled four cams on a timer. It is
 * engraved in the journal's colour on paper a shade lighter than the room. The static plate is
 * drawn once per size into a buffer; a frame repaints only the medallion.
 */

const TAU = Math.PI * 2;
/** The original advanced the turning rosette 0.019 rad every 140 ms */
const TURN_RATE = 0.019 / 0.14;
const FRAME_MS = 70;

type Rail = [number, number, number, number][];

function circleOutline(cx: number, cy: number, r: number, samples: number): [number, number][] {
  return Array.from({ length: samples }, (_, i) => {
    const th = (i / samples) * TAU;
    return [cx + Math.cos(th) * r, cy + Math.sin(th) * r];
  });
}

function rectOutline(x: number, y: number, w: number, h: number, r: number): [number, number][] {
  const pts: [number, number][] = [];
  const push = (px: number, py: number) => {
    const l = pts[pts.length - 1];
    if (l && Math.abs(l[0] - px) < 1e-4 && Math.abs(l[1] - py) < 1e-4) return;
    pts.push([px, py]);
  };
  const seg = (x0: number, y0: number, xe: number, ye: number) => {
    const n = Math.max(2, Math.round(Math.hypot(xe - x0, ye - y0) / 4));
    for (let i = 0; i <= n; i++) push(x0 + ((xe - x0) * i) / n, y0 + ((ye - y0) * i) / n);
  };
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    const n = Math.max(7, Math.round((Math.abs(a1 - a0) * r) / 1.6));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  };
  const x1 = x + w;
  const y1 = y + h;
  const HP = Math.PI / 2;
  seg(x + r, y, x1 - r, y);
  arc(x1 - r, y + r, -HP, 0);
  seg(x1, y + r, x1, y1 - r);
  arc(x1 - r, y1 - r, 0, HP);
  seg(x1 - r, y1, x + r, y1);
  arc(x + r, y1 - r, HP, Math.PI);
  seg(x, y1 - r, x, y + r);
  arc(x + r, y + r, Math.PI, Math.PI * 1.5);
  return pts;
}

/** Resample an outline to M evenly spaced points, each with its outward normal */
function rail(pts: [number, number][], M: number): Rail {
  const nP = pts.length;
  const cum = new Float64Array(nP + 1);
  for (let i = 1; i <= nP; i++) {
    const p = pts[i % nP];
    const q = pts[i - 1];
    cum[i] = cum[i - 1] + Math.hypot(p[0] - q[0], p[1] - q[1]);
  }
  const L = cum[nP];
  const out: Rail = new Array(M);
  let j = 0;
  for (let i = 0; i < M; i++) {
    const target = (i / M) * L;
    while (j < nP - 1 && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const u = (target - cum[j]) / seg;
    const p = pts[j];
    const q = pts[(j + 1) % nP];
    out[i] = [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, (q[1] - p[1]) / seg, -(q[0] - p[0]) / seg];
  }
  return out;
}

export function create(ctx: FxContext, initial: EngravedPlateOptions): FxInstance<EngravedPlateOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  // Both canvases raster on the CPU: the rosettes are single paths of tens of thousands of
  // hairline segments, which the CPU fills in milliseconds and the GPU path renderer can take
  // seconds over (and a CPU canvas copies cheaply, which the page turn does)
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("2D canvas unavailable");
  const buffer = document.createElement("canvas");
  const b = buffer.getContext("2d", { willReadFrequently: true })!;

  let w = 1;
  let h = 1;
  let ratio = 1;
  let reduced = ctx.reducedMotion;
  let phase = 0;
  let sinceDraw = Infinity;
  let inkRGB: RGB = [0.12, 0.18, 0.35];
  let medal: { cx: number; cy: number; R: number; fade: number } | null = null;
  let cams = { m: 11, m2: 19, m3: 14, p1: 0.2, p2: 0.9 };

  const ink = (a: number) => `rgba(${Math.round(inkRGB[0] * 255)},${Math.round(inkRGB[1] * 255)},${Math.round(inkRGB[2] * 255)},${a})`;
  const paperRGB = (): RGB => mixRGB(palette.base, [1, 1, 1], 0.35);
  const paper = (a: number) => {
    const p = paperRGB();
    return `rgba(${Math.round(p[0] * 255)},${Math.round(p[1] * 255)},${Math.round(p[2] * 255)},${a})`;
  };

  /** The entry's own cams: lobe counts and phases picked from its seed */
  const pickCams = () => {
    const r = seeded(hashString(opts.seed || "plate"));
    const pick = (set: number[]) => set[Math.floor(r() * set.length)];
    cams = { m: pick([7, 9, 11, 13, 15]), m2: pick([13, 15, 17, 19, 23]), m3: pick([9, 11, 12, 14, 18]), p1: r() * TAU, p2: r() * TAU };
  };

  const band = (c: CanvasRenderingContext2D, r: Rail, o: { amp: number; waves: number; K: number; alpha: number; lw: number; phase?: number }) => {
    const M = r.length;
    c.lineWidth = o.lw;
    c.strokeStyle = ink(o.alpha);
    c.beginPath();
    for (let k = 0; k < o.K; k++) {
      const ph = (o.phase || 0) + (k / o.K) * TAU;
      for (let i = 0; i <= M; i++) {
        const p = r[i % M];
        const off = o.amp * Math.sin(o.waves * ((i % M) / M) * TAU + ph);
        const x = p[0] + p[2] * off;
        const y = p[1] + p[3] * off;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
    }
    c.stroke();
  };

  const railLine = (c: CanvasRenderingContext2D, r: Rail, off: number, alpha: number, lw: number) => {
    const M = r.length;
    c.lineWidth = lw;
    c.strokeStyle = ink(alpha);
    c.beginPath();
    for (let i = 0; i <= M; i++) {
      const p = r[i % M];
      const x = p[0] + p[2] * off;
      const y = p[1] + p[3] * off;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();
  };

  const rosette = (
    c: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    o: { A: number; d: number; m: number; n: number; pts: number; alpha: number; lw: number; dir?: number; shrink?: number; phase?: number }
  ) => {
    const dir = o.dir || 1;
    const shrink = o.shrink === undefined ? 0.06 : o.shrink;
    c.lineWidth = o.lw;
    c.strokeStyle = ink(o.alpha);
    c.lineJoin = "round";
    c.beginPath();
    for (let k = 0; k < o.n; k++) {
      const f = k / o.n;
      const phi = (o.phase || 0) + dir * f * TAU;
      const a = o.A * (1 - shrink * f);
      for (let i = 0; i <= o.pts; i++) {
        const t = (i / o.pts) * TAU;
        const x = cx + a * Math.cos(t) + o.d * Math.cos(o.m * t + phi);
        const y = cy + a * Math.sin(t) - o.d * Math.sin(o.m * t + phi);
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
    }
    c.stroke();
  };

  /** Where the medallion goes for this plate's size and the chosen placement */
  const placeMedal = () => {
    const mode = opts.medal === "auto" ? (w >= 720 ? "right" : "watermark") : opts.medal;
    if (mode === "none") return null;
    if (mode === "right") {
      const R = Math.min(h * 0.4, 150);
      return { cx: w - R - Math.max(28, w * 0.05), cy: h / 2, R, fade: 1 };
    }
    const R = Math.min(w, h) * 0.46;
    return { cx: w - R * 0.62, cy: h * 0.5, R, fade: 0.42 };
  };

  /** The plate and the medallion's fixed rings, once per size, into the buffer */
  const drawStatic = () => {
    buffer.width = canvas.width;
    buffer.height = canvas.height;
    b.setTransform(ratio, 0, 0, ratio, 0, 0);
    b.globalAlpha = 1;
    b.fillStyle = paper(1);
    b.fillRect(0, 0, w, h);

    let gr = b.createRadialGradient(w * 0.28, h * 0.16, 8, w * 0.28, h * 0.16, Math.max(w, h) * 0.95);
    gr.addColorStop(0, "rgba(255,252,240,.85)");
    gr.addColorStop(1, "rgba(255,252,240,0)");
    b.fillStyle = gr;
    b.fillRect(0, 0, w, h);
    gr = b.createRadialGradient(w * 0.88, h * 0.94, 8, w * 0.88, h * 0.94, Math.max(w, h) * 0.85);
    gr.addColorStop(0, ink(0.06));
    gr.addColorStop(1, ink(0));
    b.fillStyle = gr;
    b.fillRect(0, 0, w, h);

    // Paper speckle, at the original's density per area
    const rnd = seeded(4409);
    const specks = Math.round((1100 * w * h) / (720 * 667));
    for (let i = 0; i < specks; i++) {
      b.fillStyle = ink(0.018 + rnd() * 0.05);
      b.fillRect(rnd() * w, rnd() * h, 1, rnd() < 0.12 ? 2 : 1);
    }

    // The wave-ruled ground
    b.lineWidth = 0.5;
    b.strokeStyle = ink(0.075);
    const pitch = 6.2;
    b.beginPath();
    for (let i = 0; i < Math.ceil(h / pitch) + 2; i++) {
      const y0 = i * pitch - 3;
      const ph = i * 0.44;
      for (let x = 0; x <= w; x += 7) {
        const y = y0 + 3.3 * Math.sin(x * 0.0139 + ph) + 1.9 * Math.sin(x * 0.0327 - ph * 1.7) + 0.9 * Math.sin(x * 0.0715 + ph * 0.6);
        if (x) b.lineTo(x, y);
        else b.moveTo(x, y);
      }
    }
    b.stroke();

    // The guilloché border
    const narrow = w < 520;
    const inset = narrow ? 7 : 10;
    const half = narrow ? 3.1 : 3.8;
    const perimeter = 2 * (w + h);
    const br = rail(rectOutline(inset + half, inset + half, w - 2 * (inset + half), h - 2 * (inset + half), narrow ? 5 : 7), Math.round(perimeter * 0.5));
    band(b, br, { amp: half, waves: Math.round(perimeter / 23), K: 9, alpha: 0.3, lw: 0.5 });
    railLine(b, br, -half - 1.9, 0.34, 0.6);
    railLine(b, br, half + 1.9, 0.3, 0.5);
    railLine(b, br, half + 4.4, 0.13, 0.5);

    medal = placeMedal();
    if (!medal) return;
    const { cx, cy, R, fade } = medal;
    const small = R < 130;
    b.globalAlpha = fade;
    const disc = b.createRadialGradient(cx, cy, R * 0.06, cx, cy, R);
    disc.addColorStop(0, paper(0.92));
    disc.addColorStop(0.76, paper(0.84));
    disc.addColorStop(1, paper(0));
    b.fillStyle = disc;
    b.beginPath();
    b.arc(cx, cy, R, 0, TAU);
    b.fill();

    const ring = rail(circleOutline(cx, cy, R * 0.93, 640), small ? 460 : 620);
    band(b, ring, { amp: R * 0.036, waves: (cams.m + 1) * 5, K: 7, alpha: 0.3, lw: 0.5 });
    railLine(b, ring, -R * 0.036 - 1.8, 0.34, 0.6);
    railLine(b, ring, R * 0.036 + 1.8, 0.28, 0.5);
    rosette(b, cx, cy, { A: R * 0.655, d: R * 0.215, m: cams.m, n: small ? 44 : 58, pts: small ? 340 : 470, alpha: 0.42, lw: 0.5, shrink: 0.035, phase: cams.p1 });
    rosette(b, cx, cy, { A: R * 0.335, d: R * 0.115, m: cams.m2, n: small ? 34 : 44, pts: small ? 280 : 380, alpha: 0.38, lw: 0.5, dir: -1, shrink: 0.05, phase: cams.p2 });
    b.beginPath();
    b.arc(cx, cy, R * 0.07, 0, TAU);
    b.fillStyle = paper(0.86);
    b.fill();
    b.lineWidth = 0.6;
    b.strokeStyle = ink(0.32);
    b.stroke();
    b.beginPath();
    b.arc(cx, cy, R * 0.04, 0, TAU);
    b.strokeStyle = ink(0.24);
    b.lineWidth = 0.5;
    b.stroke();
    b.globalAlpha = 1;
  };

  /** The whole plate on the first frame; afterwards only the medallion's square is repainted */
  const draw = (full: boolean) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (full || !medal) {
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.drawImage(buffer, 0, 0);
    }
    if (!medal) return;
    const { cx, cy, R, fade } = medal;
    const x0 = Math.max(0, Math.floor((cx - R) * ratio));
    const y0 = Math.max(0, Math.floor((cy - R) * ratio));
    const x1 = Math.min(canvas.width, Math.ceil((cx + R) * ratio));
    const y1 = Math.min(canvas.height, Math.ceil((cy + R) * ratio));
    if (!full) {
      g.clearRect(x0, y0, x1 - x0, y1 - y0);
      g.drawImage(buffer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    }
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.save();
    g.beginPath();
    g.arc(cx, cy, R * 0.9, 0, TAU);
    g.clip();
    g.globalAlpha = fade;
    const small = R < 130;
    rosette(g, cx, cy, { A: R * 0.515, d: R * 0.165, m: cams.m3, n: small ? 26 : 34, pts: small ? 240 : 320, alpha: 0.3, lw: 0.5, shrink: 0.03, phase });
    g.restore();
  };

  const rebuild = () => {
    inkRGB = resolveToken(opts.ink || "notebook-text");
    pickCams();
    drawStatic();
    draw(true);
  };

  return {
    resize(cssW, cssH, pr) {
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      ratio = pr;
      canvas.width = Math.max(1, Math.round(w * pr));
      canvas.height = Math.max(1, Math.round(h * pr));
      rebuild();
    },

    render(_now, dt) {
      if (reduced || opts.turn <= 0 || !medal) return;
      phase = (phase + (dt / 1000) * TURN_RATE * opts.turn) % TAU;
      sinceDraw += dt;
      if (sinceDraw < FRAME_MS) return;
      sinceDraw = 0;
      draw(false);
    },

    update(next) {
      const before = `${opts.seed}|${opts.ink}|${opts.medal}`;
      opts = { ...opts, ...next };
      if (`${opts.seed}|${opts.ink}|${opts.medal}` !== before) rebuild();
    },

    setPalette(p: RoomPalette) {
      palette = p;
      rebuild();
    },

    still() {
      reduced = true;
      draw(true);
    },

    dispose() {
      buffer.width = buffer.height = 0;
    },
  };
}
