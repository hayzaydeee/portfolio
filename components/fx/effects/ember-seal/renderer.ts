import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB, rgbToCss } from "@/components/fx/runtime/palette";
import { loadFont, resolveFontFamily } from "@/components/fx/runtime/fonts";
import { hashString, seeded } from "@/components/fx/runtime/random";
import type { EmberSealOptions } from "./meta";

/**
 * After ThreeUI's Spark Badge (MIT, Meng To), its technique on a figure of our own. A shape is
 * rasterised to a mask, its edges become emitters with outward normals, and each spark is a
 * moving particle drawn as its own motion blur: a short dotted tick along its heading, bent
 * by two layers of curl noise. Edges marked as "pinned" hold their sparks on the contour so
 * they chain into a bright line; looser edges throw them off as fur. Sparks are batched by
 * brightness and dash into fifteen paths and laid down additively, so dense edges burn
 * through to white. Rain slants across the plate, most of it behind the figure (punched out
 * by its silhouette) and some in front. A seventeen-second cycle loosens it and draws it back.
 *
 * Changed for the wall: the figure is a wax seal (a scalloped disc, a carved ring, and the
 * label carved through its face) where the original had a lanyard badge with another
 * company's wordmark; the sparks burn in the room's pin red on a dark plate instead of white
 * on black; there's no waterline; counts follow the seal's area so a polaroid-sized seal
 * stays light; and the curl fields are shared by every seal on the page, each reading them at
 * its own offset. It draws on the CPU: a frame is thousands of hairline segments.
 */

const TAU = Math.PI * 2;
const NS = 256;
const NM = NS - 1;
/** The mask is one art unit across */
const MW = 320;
const SEG = 0.0082;
const NF0 = 17600;
const NR0 = 300;
const REF_S = 900;
const WANG = (60 * Math.PI) / 180;
const WIND = { x: Math.cos(WANG), y: Math.sin(WANG) };
const LEVELS = [0.19, 0.31, 0.47, 0.68, 0.97];
const DASHES = [[], [3.2, 3.4], [1.15, 4.6]];

type Curl = { cx: Float32Array; cy: Float32Array };

/** A tileable smooth scalar field and its curl, built once per page and shared */
function makeCurlField(seed: number): Curl {
  const r = seeded(seed);
  const a = Float32Array.from({ length: NS * NS }, () => r());
  const b = new Float32Array(NS * NS);
  const R = 5;
  for (let p = 0; p < 3; p++) {
    for (let y = 0; y < NS; y++) {
      const o = y * NS;
      for (let x = 0; x < NS; x++) {
        let s = 0;
        for (let k = -R; k <= R; k++) s += a[o + ((x + k) & NM)];
        b[o + x] = s / (2 * R + 1);
      }
    }
    for (let x = 0; x < NS; x++) {
      for (let y = 0; y < NS; y++) {
        let s = 0;
        for (let k = -R; k <= R; k++) s += b[((y + k) & NM) * NS + x];
        a[y * NS + x] = s / (2 * R + 1);
      }
    }
  }
  let mn = Infinity;
  let mx = -Infinity;
  for (let i = 0; i < NS * NS; i++) {
    mn = Math.min(mn, a[i]);
    mx = Math.max(mx, a[i]);
  }
  const sc = 2 / (mx - mn);
  for (let i = 0; i < NS * NS; i++) a[i] = (a[i] - mn) * sc - 1;
  const cx = new Float32Array(NS * NS);
  const cy = new Float32Array(NS * NS);
  const H = 2;
  let vmax = 0;
  for (let y = 0; y < NS; y++) {
    for (let x = 0; x < NS; x++) {
      const dy = a[((y + H) & NM) * NS + x] - a[((y - H + NS) & NM) * NS + x];
      const dx = a[y * NS + ((x + H) & NM)] - a[y * NS + ((x - H + NS) & NM)];
      const i = y * NS + x;
      cx[i] = dy;
      cy[i] = -dx;
      vmax = Math.max(vmax, Math.abs(dy) + Math.abs(dx));
    }
  }
  const inv = 1.9 / vmax;
  for (let i = 0; i < NS * NS; i++) {
    cx[i] *= inv;
    cy[i] *= inv;
  }
  return { cx, cy };
}

let shared: { F1: Curl; F2: Curl } | null = null;
const fields = () => (shared ??= { F1: makeCurlField(0x1234), F2: makeCurlField(0x9abc) });

function curlSample(F: Curl, x: number, y: number, out: Float32Array) {
  x *= NS;
  y *= NS;
  let x0 = Math.floor(x);
  let y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  x0 &= NM;
  y0 &= NM;
  const x1 = (x0 + 1) & NM;
  const y1 = (y0 + 1) & NM;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const i00 = y0 * NS + x0;
  const i01 = y0 * NS + x1;
  const i10 = y1 * NS + x0;
  const i11 = y1 * NS + x1;
  const ax = F.cx[i00] + (F.cx[i01] - F.cx[i00]) * u;
  const bx = F.cx[i10] + (F.cx[i11] - F.cx[i10]) * u;
  const ay = F.cy[i00] + (F.cy[i01] - F.cy[i00]) * u;
  const by = F.cy[i10] + (F.cy[i11] - F.cy[i10]) * u;
  out[0] = ax + (bx - ax) * v;
  out[1] = ay + (by - ay) * v;
}

function surface(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d", { willReadFrequently: true })! };
}

type Pool = ReturnType<typeof pool>;
const pool = (n: number) => ({
  x: new Float32Array(n),
  y: new Float32Array(n),
  nx: new Float32Array(n),
  ny: new Float32Array(n),
  rx: new Float32Array(n),
  ry: new Float32Array(n),
  spd: new Float32Array(n),
  len: new Float32Array(n),
  br: new Float32Array(n),
  seed: new Float32Array(n),
  style: new Uint8Array(n),
  life: new Float32Array(n),
  max: new Float32Array(n),
  vx: new Float32Array(n),
  vy: new Float32Array(n),
  pin: new Float32Array(n),
  age: new Float32Array(n),
  k: new Uint8Array(n),
});

export function create(ctx: FxContext, initial: EmberSealOptions): FxInstance<EmberSealOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("2D canvas unavailable");

  let rnd = seeded(hashString(opts.seed || "seal"));
  let offset = [0, 0, 0, 0];
  let reduced = ctx.reducedMotion;
  let VW = 1;
  let VH = 1;
  let ART = { x: 0, y: 0, s: 1 };
  let LW = 1;
  let CT = 0;
  let turb = 1;
  let spread = 1;
  let NF = 0;
  let NR = 0;
  let FUR: Pool = pool(1);
  let RAIN: Pool = pool(1);
  let family = "serif";
  let built = false;
  let plate: HTMLCanvasElement | null = null;
  let silhouette: HTMLCanvasElement | null = null;
  let occlusion: HTMLCanvasElement | null = null;
  let em: { n: number; total: number; cdf: Float32Array; x: Float32Array; y: Float32Array; nx: Float32Array; ny: Float32Array; e: Float32Array; dr: Float32Array } | null = null;
  const cur = new Float32Array(2);
  const tmp = new Float32Array(2);
  const paths: Path2D[] = [];

  const reseed = () => {
    const h = hashString(opts.seed || "seal");
    rnd = seeded(h);
    offset = [((h & 255) / 255) * 4, (((h >> 8) & 255) / 255) * 4, (((h >> 16) & 255) / 255) * 4, (((h >> 24) & 255) / 255) * 4];
  };

  const curlAt = (x: number, y: number, out: Float32Array) => {
    const { F1, F2 } = fields();
    curlSample(F1, x * 1.3 + CT * 0.011 + offset[0], y * 1.3 - CT * 0.019 + offset[1], tmp);
    const ox = tmp[0];
    const oy = tmp[1];
    curlSample(F2, x * 3.05 - CT * 0.026 + offset[2], y * 3.05 + CT * 0.015 + offset[3], tmp);
    out[0] = ox + tmp[0] * 0.45;
    out[1] = oy + tmp[1] * 0.45;
  };

  /** The seal in art units: a scalloped disc, a carved ring, the label carved through its face */
  const sealPath = (x: CanvasRenderingContext2D, S: number) => {
    x.beginPath();
    for (let k = 0; k <= 240; k++) {
      const a = (k / 240) * TAU;
      const r = 0.335 * (1 + 0.042 * Math.cos(16 * a) + 0.012 * Math.cos(5 * a + 1.3));
      const px = (0.5 + Math.cos(a) * r) * S;
      const py = (0.5 + Math.sin(a) * r) * S;
      if (k) x.lineTo(px, py);
      else x.moveTo(px, py);
    }
    x.closePath();
  };

  const ring = (x: CanvasRenderingContext2D, S: number, grow: number) => {
    x.lineWidth = (0.013 + grow) * S;
    x.beginPath();
    x.arc(0.5 * S, 0.5 * S, 0.262 * S, 0, TAU);
    x.stroke();
  };

  const lettering = (x: CanvasRenderingContext2D, S: number, grow: number) => {
    const cap = 0.15 * S;
    x.font = `600 100px ${family}`;
    const unit = (x.measureText("H").actualBoundingBoxAscent || 71) / 100;
    x.font = `600 ${(cap / unit).toFixed(2)}px ${family}`;
    x.textAlign = "center";
    x.textBaseline = "alphabetic";
    const label = (opts.label || "hzy").slice(0, 6);
    x.fillText(label, 0.5 * S, 0.5 * S + cap * 0.42);
    if (grow > 0) {
      x.lineWidth = grow * S;
      x.strokeText(label, 0.5 * S, 0.5 * S + cap * 0.42);
    }
  };

  const buildEmitters = () => {
    const detail = surface(MW, MW);
    detail.ctx.fillStyle = "#fff";
    sealPath(detail.ctx, MW);
    detail.ctx.fill();
    detail.ctx.globalCompositeOperation = "destination-out";
    detail.ctx.strokeStyle = "#000";
    detail.ctx.fillStyle = "#000";
    ring(detail.ctx, MW, 0);
    lettering(detail.ctx, MW, 0);

    // Region emphasis, read where the edges are: [ink, drift] x 78 in red and green
    const emph = surface(MW, MW);
    emph.ctx.fillStyle = `rgb(78, ${Math.round(78 * 0.32)}, 0)`;
    sealPath(emph.ctx, MW);
    emph.ctx.fill();
    // The ring holds its sparks in a fine line; the lettering throws them off
    emph.ctx.strokeStyle = `rgb(${Math.round(78 * 0.75)}, ${Math.round(78 * 0.12)}, 0)`;
    ring(emph.ctx, MW, 0.03);
    emph.ctx.strokeStyle = emph.ctx.fillStyle = `rgb(78, ${Math.round(78 * 0.55)}, 0)`;
    lettering(emph.ctx, MW, 0.02);

    const d = detail.ctx.getImageData(0, 0, MW, MW).data;
    const ed = emph.ctx.getImageData(0, 0, MW, MW).data;
    const a = Float32Array.from({ length: MW * MW }, (_, i) => d[i * 4 + 3] / 255);
    const b = new Float32Array(MW * MW);
    const R = 2;
    for (let p = 0; p < 2; p++) {
      for (let y = 0; y < MW; y++) {
        for (let x = 0; x < MW; x++) {
          let s = 0;
          let n = 0;
          for (let k = -R; k <= R; k++) {
            const xx = x + k;
            if (xx < 0 || xx >= MW) continue;
            s += a[y * MW + xx];
            n++;
          }
          b[y * MW + x] = s / n;
        }
      }
      for (let x = 0; x < MW; x++) {
        for (let y = 0; y < MW; y++) {
          let s = 0;
          let n = 0;
          for (let k = -R; k <= R; k++) {
            const yy = y + k;
            if (yy < 0 || yy >= MW) continue;
            s += b[yy * MW + x];
            n++;
          }
          a[y * MW + x] = s / n;
        }
      }
    }
    const ex: number[] = [];
    const ey: number[] = [];
    const enx: number[] = [];
    const eny: number[] = [];
    const ew: number[] = [];
    const ee: number[] = [];
    const edr: number[] = [];
    for (let y = 1; y < MW - 1; y++) {
      for (let x = 1; x < MW - 1; x++) {
        const i = y * MW + x;
        const gx = a[i + 1] - a[i - 1];
        const gy = a[i + MW] - a[i - MW];
        const m = Math.hypot(gx, gy);
        if (m < 0.035) continue;
        const w = ed[i * 4] / 78;
        if (w <= 0) continue;
        ex.push(x / MW);
        ey.push(y / MW);
        enx.push(-gx / m);
        eny.push(-gy / m);
        ew.push(m * w);
        ee.push(w);
        edr.push(ed[i * 4 + 1] / 78);
      }
    }
    const cdf = new Float32Array(ew.length);
    let acc = 0;
    ew.forEach((v, i) => {
      acc += v;
      cdf[i] = acc;
    });
    em = {
      n: ew.length,
      total: acc,
      cdf,
      x: Float32Array.from(ex),
      y: Float32Array.from(ey),
      nx: Float32Array.from(enx),
      ny: Float32Array.from(eny),
      e: Float32Array.from(ee),
      dr: Float32Array.from(edr),
    };

    // The un-carved silhouette, for the rain to fall behind
    const occ = surface(MW, MW);
    occ.ctx.fillStyle = "#fff";
    sealPath(occ.ctx, MW);
    occ.ctx.fill();
    occlusion = occ.canvas;
  };

  const pickEdge = () => {
    const E = em!;
    const t = rnd() * E.total;
    let lo = 0;
    let hi = E.n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (E.cdf[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  /** Rejection-sample toward the arcs the field is running hot on right now */
  const pickHot = () => {
    const E = em!;
    let e = pickEdge();
    for (let t = 0; t < 3; t++) {
      curlSample(fields().F1, E.x[e] * 0.85 + CT * 0.045 + offset[0], E.y[e] * 0.85 - CT * 0.03 + offset[1], tmp);
      const hot = tmp[0] * 0.5 + 0.5;
      if (rnd() < hot * hot * 1.15) break;
      e = pickEdge();
    }
    return e;
  };

  const pickStyle = () => {
    const r = rnd();
    return r < 0.46 ? 0 : r < 0.78 ? 1 : 2;
  };
  const stepsFor = (len: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(len / (SEG * ART.s))));

  const spawnFur = (i: number, seeded0: boolean) => {
    const E = em!;
    const e = pickHot();
    const j = 0.0032 * ART.s;
    FUR.x[i] = ART.x + E.x[e] * ART.s + (rnd() - 0.5) * j;
    FUR.y[i] = ART.y + E.y[e] * ART.s + (rnd() - 0.5) * j;
    const eb = Math.sqrt(E.e[e]);
    const dr = E.dr[e];
    // How strongly this edge holds its sparks on the contour: pinned ones chain into a line
    const pin = Math.max(0, Math.min(1, 1 - dr / 0.85));
    FUR.pin[i] = pin;
    const sp =
      rnd() < 0.58 + pin * 0.38 ? (rnd() < 0.5 ? -1 : 1) * (1.44 + (rnd() - 0.5) * 0.42 * (1 - pin * 0.7)) : (rnd() - 0.5) * 1.15;
    const cs = Math.cos(sp);
    const sn = Math.sin(sp);
    FUR.rx[i] = E.nx[e] * cs - E.ny[e] * sn;
    FUR.ry[i] = E.nx[e] * sn + E.ny[e] * cs;
    FUR.nx[i] = FUR.rx[i];
    FUR.ny[i] = FUR.ry[i];
    FUR.spd[i] = ART.s * (0.01 + Math.pow(rnd(), 1.8) * 0.098) * (0.24 + dr * 0.9) * (1 - pin * 0.9);
    FUR.len[i] = ART.s * (0.0022 + Math.pow(rnd(), 2.3) * 0.011) * (1 - pin * 0.28);
    FUR.br[i] = (0.74 + rnd() * 0.94) * eb * (1 + pin * 0.3);
    FUR.max[i] = (0.17 + rnd() * 0.74) * (1 - pin * 0.55) * (0.75 + dr * 0.42);
    FUR.k[i] = stepsFor(FUR.len[i], 1, 6);
    FUR.seed[i] = rnd() * 1000;
    FUR.style[i] = pickStyle();
    FUR.life[i] = seeded0 ? rnd() * FUR.max[i] : FUR.max[i];
  };

  /** Rain falls through the frame: in above the top edge, out past the bottom */
  const spawnRain = (i: number, seeded0: boolean) => {
    const sp = ART.s * (0.4 + Math.pow(rnd(), 1.2) * 0.46);
    RAIN.vx[i] = WIND.x * sp;
    RAIN.vy[i] = WIND.y * sp;
    RAIN.len[i] = ART.s * (0.035 + Math.pow(rnd(), 1.45) * 0.15);
    RAIN.br[i] = 0.3 + Math.pow(rnd(), 1.3) * 1.05;
    RAIN.k[i] = stepsFor(RAIN.len[i], 3, 14);
    RAIN.seed[i] = rnd() * 1000;
    RAIN.style[i] = rnd() < 0.74 ? 0 : rnd() < 0.6 ? 1 : 2;
    RAIN.pin[i] = rnd() < 0.24 ? 1 : 0;
    if (seeded0) {
      RAIN.x[i] = rnd() * VW;
      RAIN.y[i] = rnd() * VH;
    } else {
      const skew = (WIND.x / WIND.y) * (VH + RAIN.len[i]);
      RAIN.x[i] = -skew + rnd() * (VW + skew);
      RAIN.y[i] = -RAIN.len[i] * WIND.y - rnd() * ART.s * 0.25;
    }
    RAIN.age[i] = 0;
  };

  const levelOf = (a: number) => (a < 0.26 ? 0 : a < 0.39 ? 1 : a < 0.57 ? 2 : a < 0.82 ? 3 : 4);
  /** Stochastic on/off along a strand: the dotted filament */
  const lit = (seed: number, k: number) => {
    const v = Math.sin((seed + k * 1.7) * 127.1) * 43758.5453;
    return v - Math.floor(v) > 0.28;
  };

  const strand = (P: Pool, i: number, mode: 0 | 1) => {
    const K = P.k[i];
    let env: number;
    if (mode === 1) env = Math.min(1, P.age[i] * 9);
    else {
      const t = 1 - P.life[i] / P.max[i];
      env = Math.min(1, t * 9) * Math.min(1, (1 - t) * 3.4);
    }
    if (env <= 0.01) return;
    const style = P.style[i];
    const seed = P.seed[i];
    const base = P.br[i] * env;
    const L = P.len[i] * (mode === 0 ? spread : 1);
    const h = L / K;
    let x = P.x[i];
    let y = P.y[i];
    let prev = -1;
    let moved = true;
    const ix = 1 / ART.s;
    for (let k = 0; k < K; k++) {
      const s = k / K;
      curlAt((x - ART.x) * ix, (y - ART.y) * ix, cur);
      let dx: number;
      let dy: number;
      if (mode === 0) {
        const c = (0.1 + s * 0.42) * turb * (1 - P.pin[i] * 0.85);
        dx = P.nx[i] + cur[0] * c;
        dy = P.ny[i] + cur[1] * c;
      } else {
        const c = (0.05 + s * 0.17) * turb;
        dx = -WIND.x + cur[0] * c;
        dy = -WIND.y + cur[1] * c;
      }
      const m = Math.hypot(dx, dy) || 1;
      dx /= m;
      dy /= m;
      const nx2 = x + dx * h;
      const ny2 = y + dy * h;
      const a = base * Math.pow(1 - s, mode === 1 ? 0.75 : 0.95);
      if (a > 0.15 && lit(seed, k)) {
        const lvl = levelOf(a);
        if (lvl !== prev) moved = true;
        const p = paths[style * LEVELS.length + lvl];
        if (moved) p.moveTo(x, y);
        p.lineTo(nx2, ny2);
        prev = lvl;
        moved = false;
      } else {
        moved = true;
        prev = -1;
      }
      x = nx2;
      y = ny2;
    }
  };

  const stepRain = (d: number) => {
    for (let i = 0; i < NR; i++) {
      RAIN.age[i] += d;
      RAIN.x[i] += RAIN.vx[i] * d;
      RAIN.y[i] += RAIN.vy[i] * d;
      const ty = RAIN.y[i] - RAIN.len[i] * WIND.y;
      const tx = RAIN.x[i] - RAIN.len[i] * WIND.x;
      if (ty > VH || tx > VW) spawnRain(i, false);
    }
  };

  const stepFur = (d: number) => {
    for (let i = 0; i < NF; i++) {
      FUR.life[i] -= d;
      if (FUR.life[i] <= 0) {
        spawnFur(i, false);
        continue;
      }
      const age = 1 - FUR.life[i] / FUR.max[i];
      const pin = FUR.pin[i];
      const free = 1 - pin;
      curlAt((FUR.x[i] - ART.x) / ART.s, (FUR.y[i] - ART.y) / ART.s, cur);
      const rad = (Math.pow(1 - age, 1.5) * 0.9 * free + 0.62 * pin) * 1.45;
      const c = (0.34 + age * 1.25) * turb * (1 - pin * 0.88);
      let dx = FUR.rx[i] * rad + WIND.x * 0.5 * free + cur[0] * c;
      let dy = FUR.ry[i] * rad + WIND.y * 0.5 * free + cur[1] * c;
      const m = Math.hypot(dx, dy) || 1;
      dx /= m;
      dy /= m;
      FUR.x[i] += dx * FUR.spd[i] * d;
      FUR.y[i] += dy * FUR.spd[i] * d;
      FUR.nx[i] = dx;
      FUR.ny[i] = dy;
    }
  };

  /** The slow loosen and reform */
  const cycle = () => {
    const c = 0.5 - 0.5 * Math.cos((CT * TAU) / 17);
    turb = 0.62 + c * 0.78;
    spread = 0.88 + c * 0.44;
  };

  const step = (d: number) => {
    CT += d;
    cycle();
    stepRain(d);
    stepFur(d);
  };

  /** The dark plate, and the seal's own silhouette in it (a hint of wax) to punch the rain behind it */
  const paintPlates = () => {
    const bg = mixRGB(palette.text, [0, 0, 0], 0.5);
    const p = surface(VW, VH);
    p.ctx.fillStyle = rgbToCss(bg);
    p.ctx.fillRect(0, 0, VW, VH);
    const glow = p.ctx.createRadialGradient(VW / 2, VH * 0.46, 0, VW / 2, VH / 2, Math.max(VW, VH) * 0.7);
    glow.addColorStop(0, rgbToCss(mixRGB(bg, palette.accent, 0.28)));
    glow.addColorStop(1, rgbToCss(bg, 0));
    p.ctx.fillStyle = glow;
    p.ctx.fillRect(0, 0, VW, VH);
    plate = p.canvas;

    const s = surface(VW, VH);
    s.ctx.filter = `blur(${(ART.s * 0.004).toFixed(2)}px)`;
    s.ctx.drawImage(occlusion!, ART.x, ART.y, ART.s, ART.s);
    s.ctx.filter = "none";
    s.ctx.globalCompositeOperation = "source-in";
    s.ctx.drawImage(plate, 0, 0);
    s.ctx.fillStyle = rgbToCss(palette.accent, 0.1);
    s.ctx.fillRect(0, 0, VW, VH);
    silhouette = s.canvas;
  };

  const flush = (colour: RGB, scale: number) => {
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = rgbToCss(colour);
    g.lineWidth = LW;
    g.lineCap = "butt";
    DASHES.forEach((dash, s) => {
      g.setLineDash(dash.map((v) => v * LW));
      LEVELS.forEach((level, l) => {
        g.globalAlpha = level * scale;
        g.stroke(paths[s * LEVELS.length + l]);
      });
    });
    g.setLineDash([]);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  };

  const fresh = () => {
    for (let i = 0; i < LEVELS.length * DASHES.length; i++) paths[i] = new Path2D();
  };

  const render = () => {
    if (!built || !plate || !silhouette) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.drawImage(plate, 0, 0);
    const ember = mixRGB(palette.accent, [1, 0.62, 0.25], 0.5);
    const rain = mixRGB(palette.glow, [0.85, 0.9, 1], 0.3);
    // Rain behind the seal first, so its silhouette can be laid over it
    fresh();
    for (let i = 0; i < NR; i++) if (!RAIN.pin[i]) strand(RAIN, i, 1);
    flush(rain, 0.5);
    g.drawImage(silhouette, 0, 0);
    fresh();
    for (let i = 0; i < NF; i++) strand(FUR, i, 0);
    flush(ember, 1);
    // and the rest in front, so falling lines cross the seal too
    fresh();
    for (let i = 0; i < NR; i++) if (RAIN.pin[i]) strand(RAIN, i, 1);
    flush(rain, 0.5);
  };

  const layout = () => {
    if (!em) return;
    const s = Math.min(VW, VH);
    ART = { x: (VW - s) / 2, y: (VH - s) / 2, s };
    LW = Math.max(0.85, (s / 1280) * 1.05);
    const area = (s / REF_S) ** 2;
    NF = Math.round(Math.max(300, Math.min(9000, NF0 * area * 1.6 * opts.heat)));
    NR = Math.round(Math.max(opts.rain > 0 ? 24 : 0, Math.min(900, NR0 * area * 1.4 * opts.rain)));
    FUR = pool(NF);
    RAIN = pool(Math.max(1, NR));
    for (let i = 0; i < NF; i++) spawnFur(i, true);
    for (let i = 0; i < NR; i++) spawnRain(i, true);
    paintPlates();
    // Fresh sparks all sit exactly on the contour; run the sim on a second before the first frame
    for (let n = 0; n < 30; n++) step(1 / 30);
    canvas.dataset.embers = String(NF);
  };

  const ready = (async () => {
    family = resolveFontFamily("--font-serif");
    await loadFont(600, 48, family);
    reseed();
    fields();
    buildEmitters();
    built = true;
    layout();
    render();
  })();

  return {
    ready,

    resize(cssW, cssH, pr) {
      VW = Math.max(1, Math.round(cssW * pr));
      VH = Math.max(1, Math.round(cssH * pr));
      canvas.width = VW;
      canvas.height = VH;
      if (built) {
        layout();
        render();
      }
    },

    render(_now, dt) {
      if (!built || reduced) return;
      step((Math.min(dt, 100) / 1000) * opts.speed);
      render();
    },

    update(next) {
      const rebuild = (next.label !== undefined && next.label !== opts.label) || (next.seed !== undefined && next.seed !== opts.seed);
      const recount = (next.heat !== undefined && next.heat !== opts.heat) || (next.rain !== undefined && next.rain !== opts.rain);
      opts = { ...opts, ...next };
      if (!built) return;
      if (rebuild) {
        reseed();
        buildEmitters();
      }
      if (rebuild || recount) layout();
      render();
    },

    setPalette(p: RoomPalette) {
      palette = p;
      if (built) {
        paintPlates();
        render();
      }
    },

    still() {
      reduced = true;
      void ready.then(render);
    },

    dispose() {
      built = false;
      plate = silhouette = occlusion = null;
      em = null;
    },
  };
}
