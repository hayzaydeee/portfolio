import {
  ACESFilmicToneMapping,
  AmbientLight,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
} from "three";
import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB, resolveToken, rgbToCss } from "@/components/fx/runtime/palette";
import { loadFont, resolveFontFamily } from "@/components/fx/runtime/fonts";
import { drawMotif } from "../journal-motifs";
import type { WovenClothOptions } from "./meta";

/**
 * Port of ThreeUI's Woven Cloth, washi variant (MIT, Meng To): a noren of dyed kozo paper hung
 * on a wooden rod before a lit shoji. One sheet, 60 by 40 cells on a verlet step with three
 * passes of structural and shear links, the horizontal links cut below the sleeve at two slits
 * so the three panels hang and sway as their own pieces of cloth, each catching an indoor draft
 * on its own beat. The paper is a transmissive physical material with sheen, so the lantern
 * behind the shoji shows through it; its torn lower edge and feathered sides are one alpha mask
 * shared with the shading. Physics, lights, camera sway and paper painting follow the original.
 *
 * Changed for the notebook: the cloth is dyed in the journal's colour instead of indigo, and
 * what is resisted out of it is the journal's: its mark as the crest, "note" and "book" down the
 * outer panels, its name across all three (split by the slits, as a noren's lettering is), and
 * its volume numeral on the vermilion seal. The shoji is the room's own paper lit warm at the
 * centre and unlit at the edges, so the stage meets the page without a frame. A passing pointer
 * parts the panels, the way you walk through a noren. The step runs on an accumulator at the
 * original's 16 ms, so a slow device sways at the same pace.
 */

const TW = 1500;
const TH = 980;
const PANELS = 3;
/** The uncut sleeve the rod runs through */
const BAND = 0.15;
const SLIT_U = [1 / 3, 2 / 3];
const BW = 4.4;
const BH = 2.9;
const GX = 60;
const GY = 40;
const GRAV = -1.65;
const DAMP = 0.986;
const DT = 0.016;
const FOV = 38;
const VERMILION = "#a8342a";

/** The original's small xorshift, so the deckle and fibres are the same every load */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function surface(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d", { willReadFrequently: true })! };
}

/** One torn profile, sampled by both the alpha mask and the shading */
const deckleLow = (() => {
  const r = rng(20260826);
  const control = Array.from({ length: 25 }, () => r());
  const out = new Float32Array(TW);
  for (let x = 0; x < TW; x++) {
    const f = (x / TW) * 24;
    const i = Math.floor(f);
    const t = f - i;
    const smooth = t * t * (3 - 2 * t);
    const base = control[i] + (control[Math.min(24, i + 1)] - control[i]) * smooth;
    const fine = Math.sin(x * 0.19) * 0.16 + Math.sin(x * 0.061 + 1.7) * 0.24;
    out[x] = TH - 14 - (base * 26 + fine * 12);
  }
  return out;
})();

function makeAlphaMask() {
  const s = surface(TW, TH);
  const x = s.ctx;
  x.fillStyle = "#fff";
  x.fillRect(0, 0, TW, TH);
  x.fillStyle = "#000";
  const slitW = 22;
  const bandPx = TH * BAND;
  SLIT_U.forEach((u) => x.fillRect(u * TW - slitW / 2, bandPx, slitW, TH - bandPx));
  x.beginPath();
  x.moveTo(0, TH);
  for (let px = 0; px < TW; px++) x.lineTo(px, deckleLow[px]);
  x.lineTo(TW, TH);
  x.closePath();
  x.fill();
  const side = rng(771);
  for (let e = 0; e < 2; e++) {
    x.beginPath();
    x.moveTo(e ? TW : 0, 0);
    for (let py = 0; py <= TH; py += 6) {
      const w = 6 + side() * 9;
      x.lineTo(e ? TW - w : w, py);
    }
    x.lineTo(e ? TW : 0, TH);
    x.closePath();
    x.fill();
  }
  return s.canvas;
}

const css = (rgb: RGB, a = 1) => rgbToCss(rgb, a);

type Paint = { dye: RGB; resist: RGB; title: string; numeral: string; motif: WovenClothOptions["motif"]; serif: string };

/** The cloth: the dye vat, the papermaking screen's lines, kozo fibres, and the resist-dyed journal */
function makeClothCanvas(p: Paint) {
  const s = surface(TW, TH);
  const x = s.ctx;
  const resist = css(p.resist);
  const light = mixRGB(p.dye, [1, 1, 1], 0.32);
  const dark = mixRGB(p.dye, [0, 0, 0], 0.45);

  const g = x.createLinearGradient(0, 0, 0, TH);
  g.addColorStop(0, css(mixRGB(p.dye, [1, 1, 1], 0.1)));
  g.addColorStop(0.42, css(p.dye));
  g.addColorStop(1, css(mixRGB(p.dye, [0, 0, 0], 0.18)));
  x.fillStyle = g;
  x.fillRect(0, 0, TW, TH);

  // The vat's unevenness: deeper where the sheet was dipped longest
  const cloud = rng(4471);
  for (let i = 0; i < 26; i++) {
    const cx = cloud() * TW;
    const cy = cloud() * TH;
    const r = 120 + cloud() * 320;
    const lighter = cloud() > 0.5;
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, lighter ? css(light, 0.13) : css(dark, 0.16));
    rg.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = rg;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // Laid lines from the bamboo screen, then the heavier chain lines
  x.strokeStyle = css(mixRGB(light, [1, 1, 1], 0.4), 0.045);
  x.lineWidth = 1;
  for (let px = 0; px < TW; px += 4) {
    x.beginPath();
    x.moveTo(px + 0.5, 0);
    x.lineTo(px + 0.5, TH);
    x.stroke();
  }
  x.strokeStyle = css(mixRGB(light, [1, 1, 1], 0.5), 0.1);
  x.lineWidth = 2;
  for (let py = 26; py < TH; py += 38) {
    x.beginPath();
    x.moveTo(0, py + 0.5);
    x.lineTo(TW, py + 0.5);
    x.stroke();
  }

  // Kozo fibres: long, mostly aligned, a few standing proud of the sheet
  const fib = rng(90210);
  for (let i = 0; i < 2200; i++) {
    const fx = fib() * TW;
    const fy = fib() * TH;
    const len = 30 + fib() * 150;
    const ang = (fib() - 0.5) * 0.9 + (fib() > 0.82 ? Math.PI / 2 : 0);
    const bow = (fib() - 0.5) * 26;
    const pale = fib();
    x.strokeStyle = pale > 0.3 ? css(mixRGB(light, [1, 1, 1], 0.6), 0.022 + fib() * 0.048) : css(dark, 0.04 + fib() * 0.07);
    x.lineWidth = 0.7 + fib() * 1.9;
    x.beginPath();
    x.moveTo(fx, fy);
    x.quadraticCurveTo(fx + Math.cos(ang) * len * 0.5 + bow, fy + Math.sin(ang) * len * 0.5 - bow, fx + Math.cos(ang) * len, fy + Math.sin(ang) * len);
    x.stroke();
  }

  // Katazome: a resist-dyed frame inside each panel
  const panelW = TW / PANELS;
  x.strokeStyle = css(p.resist, 0.72);
  for (let k = 0; k < PANELS; k++) {
    const x0 = k * panelW + 34;
    const w = panelW - 68;
    x.lineWidth = 5;
    x.strokeRect(x0, TH * BAND + 34, w, TH - TH * BAND - 118);
    x.lineWidth = 2;
    x.strokeRect(x0 + 13, TH * BAND + 47, w - 26, TH - TH * BAND - 144);
  }

  // The sleeve the rod runs through, and its shadow on the cloth below
  x.fillStyle = css(dark, 0.3);
  x.fillRect(0, 0, TW, TH * BAND);
  const sh = x.createLinearGradient(0, TH * BAND, 0, TH * BAND + 54);
  sh.addColorStop(0, css(dark, 0.42));
  sh.addColorStop(1, css(dark, 0));
  x.fillStyle = sh;
  x.fillRect(0, TH * BAND, TW, 54);
  x.strokeStyle = css(p.resist, 0.5);
  x.lineWidth = 2.5;
  x.beginPath();
  x.moveTo(0, TH * BAND);
  x.lineTo(TW, TH * BAND);
  x.stroke();

  x.fillStyle = resist;
  x.textAlign = "center";
  x.textBaseline = "middle";

  // "note" and "book" down the outer panels
  const vertical = (word: string, cx: number) => {
    x.font = `600 64px ${p.serif}`;
    [...word].forEach((ch, i) => x.fillText(ch, cx, TH * 0.27 + i * 76));
  };
  vertical("NOTE", panelW * 0.5);
  vertical("BOOK", panelW * 2.5);

  // The journal's mark as the crest, inside a resist ring
  const cx = TW * 0.5;
  const cy = TH * 0.4;
  x.lineWidth = 12;
  x.strokeStyle = resist;
  x.beginPath();
  x.arc(cx, cy, 150, 0, Math.PI * 2);
  x.stroke();
  x.save();
  x.translate(cx, cy);
  x.scale(2.1, 2.1);
  const S0 = 240;
  x.translate(-S0 / 2, -0.38 * S0);
  drawMotif(x, p.motif, resist, S0, S0);
  x.restore();

  // The journal's name across all three panels, split by the slits
  const name = p.title.toUpperCase();
  x.font = `600 160px ${p.serif}`;
  (x as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "18px";
  const width = x.measureText(name).width;
  const size = Math.min(170, (160 * TW * 0.82) / Math.max(1, width));
  x.font = `600 ${Math.round(size)}px ${p.serif}`;
  (x as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.round(size * 0.11)}px`;
  x.fillText(name, TW / 2, TH * 0.68);
  (x as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";

  // Vermilion seal at the foot of the centre panel, with the volume's numeral
  const S = 96;
  const sx = panelW * 1.5 - S / 2;
  const sy = TH * 0.8;
  x.fillStyle = VERMILION;
  x.fillRect(sx, sy, S, S);
  x.strokeStyle = resist;
  x.lineWidth = 4;
  x.strokeRect(sx + 11, sy + 11, S - 22, S - 22);
  x.fillStyle = resist;
  x.font = `600 ${p.numeral.length > 2 ? 34 : 46}px ${p.serif}`;
  x.fillText(p.numeral, sx + S / 2, sy + S / 2 + 2);

  return s.canvas;
}

function makeWoodTexture() {
  const W = 512;
  const H = 96;
  const s = surface(W, H);
  const x = s.ctx;
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#a1764a");
  g.addColorStop(0.45, "#7d5533");
  g.addColorStop(1, "#563820");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  const grain = rng(3312);
  for (let i = 0; i < 160; i++) {
    const y = grain() * H;
    x.strokeStyle = `rgba(28,17,8,${0.05 + grain() * 0.16})`;
    x.lineWidth = 0.6 + grain() * 1.8;
    x.beginPath();
    x.moveTo(0, y);
    for (let px = 0; px <= W; px += 32) x.lineTo(px, y + Math.sin(px * 0.02 + i) * 2.4);
    x.stroke();
  }
  const tex = new CanvasTexture(s.canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

/** The shoji: the room's own paper, lit warm behind the cloth and unlit at the edges */
function makeShojiTexture(paper: RGB, ink: RGB) {
  const W = 768;
  const H = 512;
  const s = surface(W, H);
  const x = s.ctx;
  x.fillStyle = css(paper);
  x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.46, W * 0.5);
  glow.addColorStop(0, css(mixRGB(paper, [1, 0.94, 0.8], 0.75)));
  glow.addColorStop(0.42, css(mixRGB(paper, [1, 0.9, 0.72], 0.35)));
  glow.addColorStop(0.8, css(paper));
  glow.addColorStop(1, css(paper));
  x.fillStyle = glow;
  x.fillRect(0, 0, W, H);
  // Kumiko lattice, softened so it stays a suggestion behind the cloth, and gone well before the
  // edges (the stage meets the page there): drawn on its own sheet, then cut to a soft oval
  const lattice = surface(W, H);
  const l = lattice.ctx;
  if ("filter" in l) l.filter = "blur(5px)";
  l.strokeStyle = css(ink, 0.16);
  l.lineWidth = 3;
  for (let px = 54; px < W; px += 128) {
    l.beginPath();
    l.moveTo(px, 0);
    l.lineTo(px, H);
    l.stroke();
  }
  for (let py = 46; py < H; py += 118) {
    l.beginPath();
    l.moveTo(0, py);
    l.lineTo(W, py);
    l.stroke();
  }
  l.filter = "none";
  l.globalCompositeOperation = "destination-in";
  const oval = l.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.46, W * 0.36);
  oval.addColorStop(0, "rgba(0,0,0,1)");
  oval.addColorStop(0.6, "rgba(0,0,0,0.55)");
  oval.addColorStop(1, "rgba(0,0,0,0)");
  l.fillStyle = oval;
  l.fillRect(0, 0, W, H);
  x.drawImage(lattice.canvas, 0, 0);
  const tex = new CanvasTexture(s.canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function create(ctx: FxContext, initial: WovenClothOptions): FxInstance<WovenClothOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  let reduced = ctx.reducedMotion;
  let disposed = false;
  let built = false;

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22 * opts.exposure;
  renderer.setClearColor(0x000000, 0);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);

  const shojiMat = new MeshBasicMaterial({ toneMapped: false });
  const shoji = new Mesh(new PlaneGeometry(1, 1), shojiMat);
  shoji.position.set(0, 0, -2.4);
  scene.add(shoji);

  const geo = new PlaneGeometry(BW, BH, GX, GY);
  const alphaMap = new CanvasTexture(makeAlphaMask());
  alphaMap.anisotropy = maxAniso;
  const mat = new MeshPhysicalMaterial({
    alphaMap,
    alphaTest: 0.5,
    transparent: false,
    side: DoubleSide,
    roughness: 0.92,
    metalness: 0,
    transmission: 0.82,
    thickness: 0.1,
    ior: 1.36,
    attenuationDistance: 3,
    sheen: 0.9,
    sheenRoughness: 0.85,
  });
  const noren = new Mesh(geo, mat);
  scene.add(noren);

  const woodTex = makeWoodTexture();
  const wood = new MeshStandardMaterial({ map: woodTex, roughness: 0.66, metalness: 0 });
  const cordMat = new MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 });
  const fittings: Mesh[] = [];
  const rod = new Mesh(new CylinderGeometry(0.062, 0.062, BW + 0.9, 20), wood);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, BH / 2 + 0.045, 0.02);
  fittings.push(rod);
  for (const side of [-1, 1]) {
    const cap = new Mesh(new SphereGeometry(0.082, 18, 12), wood);
    cap.position.set((side * (BW + 0.9)) / 2, BH / 2 + 0.045, 0.02);
    const cord = new Mesh(new CylinderGeometry(0.011, 0.011, 3.4, 8), cordMat);
    cord.position.set((side * (BW + 0.72)) / 2, BH / 2 + 1.75, 0.02);
    fittings.push(cap, cord);
  }
  fittings.forEach((m) => scene.add(m));

  const ambient = new AmbientLight(0x4a3a28, 0.8);
  const lantern = new DirectionalLight(0xffd9a0, 3.6);
  lantern.position.set(-0.4, 0.9, -3.2);
  const key = new DirectionalLight(0xffe9cc, 2.1);
  key.position.set(-2.6, 2.4, 2.6);
  const fill = new DirectionalLight(0x94b6d8, 0.5);
  fill.position.set(3.0, -1.0, 2.0);
  scene.add(ambient, lantern, key, fill);

  // Physics: one sheet, the horizontal links cut below the sleeve at each slit
  const pos = geo.attributes.position;
  const N = (GX + 1) * (GY + 1);
  const cur = new Float32Array(N * 3);
  const prev = new Float32Array(N * 3);
  const rest = new Float32Array(N * 3);
  const pinned = new Uint8Array(N);
  const idx = (ix: number, iy: number) => ix + iy * (GX + 1);
  for (let i = 0; i < N; i++) {
    cur[i * 3] = prev[i * 3] = rest[i * 3] = pos.getX(i);
    cur[i * 3 + 1] = prev[i * 3 + 1] = rest[i * 3 + 1] = pos.getY(i);
    cur[i * 3 + 2] = prev[i * 3 + 2] = rest[i * 3 + 2] = 0;
  }
  for (let ix = 0; ix <= GX; ix++) pinned[ix] = 1;
  const BAND_ROWS = Math.round(GY * BAND);
  const SLIT_IX = SLIT_U.map((u) => Math.round(u * GX));
  const panelOf = (ix: number) => (ix < SLIT_IX[0] ? 0 : ix < SLIT_IX[1] ? 1 : 2);
  const linked = (ix: number, iy: number) => !(iy > BAND_ROWS && SLIT_IX.indexOf(ix + 1) !== -1);
  const restH = BW / GX;
  const restV = BH / GY;
  const restD = Math.sqrt(restH * restH + restV * restV);
  const force = [0, 0, 0];
  let gust = 0;

  /** An indoor draft: each panel catches it on its own beat */
  const wind = (ix: number, iy: number, t: number) => {
    const cx = ix / GX;
    const cy = iy / GY;
    const ph = panelOf(ix) * 2.1;
    const draft = (0.4 + 0.28 * Math.sin(t * 0.37 + ph * 0.6) + 0.15 * Math.sin(t * 0.93 + ph)) * (opts.breeze + gust);
    const travel = t * 1.2 - cy * 2.2 + ph;
    const amp = 1.5 * cy;
    force[0] = Math.sin(t * 0.44 + ph) * 0.2 * cy * opts.breeze;
    force[1] = -0.18 * cy;
    force[2] = (Math.sin(travel) + 0.35 * Math.sin(travel * 1.8 + cx * 3.4)) * amp * draft;
    return force;
  };

  const solve = (a: number, b: number, rl: number) => {
    const ax = cur[a * 3];
    const ay = cur[a * 3 + 1];
    const az = cur[a * 3 + 2];
    let dx = cur[b * 3] - ax;
    let dy = cur[b * 3 + 1] - ay;
    let dz = cur[b * 3 + 2] - az;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    const diff = ((d - rl) / d) * 0.5;
    dx *= diff;
    dy *= diff;
    dz *= diff;
    const pa = pinned[a];
    const pb = pinned[b];
    if (!pa && !pb) {
      cur[a * 3] += dx;
      cur[a * 3 + 1] += dy;
      cur[a * 3 + 2] += dz;
      cur[b * 3] -= dx;
      cur[b * 3 + 1] -= dy;
      cur[b * 3 + 2] -= dz;
    } else if (pa && !pb) {
      cur[b * 3] -= dx * 2;
      cur[b * 3 + 1] -= dy * 2;
      cur[b * 3 + 2] -= dz * 2;
    } else if (!pa && pb) {
      cur[a * 3] += dx * 2;
      cur[a * 3 + 1] += dy * 2;
      cur[a * 3 + 2] += dz * 2;
    }
  };

  const step = (t: number) => {
    for (let iy = 0; iy <= GY; iy++) {
      for (let ix = 0; ix <= GX; ix++) {
        const i = idx(ix, iy);
        if (pinned[i]) continue;
        const f = wind(ix, iy, t);
        for (let k = 0; k < 3; k++) {
          const j = i * 3 + k;
          const a = k === 1 ? f[1] + GRAV : f[k];
          const v = (cur[j] - prev[j]) * DAMP;
          prev[j] = cur[j];
          cur[j] = cur[j] + v + a * DT * DT;
        }
      }
    }
    for (let it = 0; it < 3; it++) {
      for (let iy = 0; iy <= GY; iy++) for (let ix = 0; ix < GX; ix++) if (linked(ix, iy)) solve(idx(ix, iy), idx(ix + 1, iy), restH);
      for (let iy = 0; iy < GY; iy++) for (let ix = 0; ix <= GX; ix++) solve(idx(ix, iy), idx(ix, iy + 1), restV);
      for (let iy = 0; iy < GY; iy++) {
        for (let ix = 0; ix < GX; ix++) {
          if (!linked(ix, iy) || !linked(ix, iy + 1)) continue;
          solve(idx(ix, iy), idx(ix + 1, iy + 1), restD);
          solve(idx(ix + 1, iy), idx(ix, iy + 1), restD);
        }
      }
    }
    for (let ix = 0; ix <= GX; ix++) {
      for (let k = 0; k < 3; k++) {
        cur[ix * 3 + k] = rest[ix * 3 + k];
        prev[ix * 3 + k] = rest[ix * 3 + k];
      }
    }
  };

  const commit = () => {
    for (let i = 0; i < N; i++) pos.setXYZ(i, cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]);
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };

  // A passing pointer parts the panels: the cloth near it is pushed back and aside
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  const hit = new Vector3();
  const last = new Vector3(Number.NaN, 0, 0);
  const part = () => {
    const p = ctx.pointer();
    if (!p.inside || width < 2) {
      last.x = Number.NaN;
      return;
    }
    ndc.set((p.x / width) * 2 - 1, -(p.y / height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(plane, hit)) return;
    const speed = Number.isNaN(last.x) ? 0 : Math.min(0.25, hit.distanceTo(last));
    last.copy(hit);
    if (speed < 0.002) return;
    const R = 0.55;
    for (let iy = 1; iy <= GY; iy++) {
      for (let ix = 0; ix <= GX; ix++) {
        const i = idx(ix, iy);
        const dx = cur[i * 3] - hit.x;
        const dy = cur[i * 3 + 1] - hit.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > R) continue;
        const k = (1 - d / R) ** 2 * speed;
        cur[i * 3 + 2] -= k * 0.9;
        cur[i * 3] += Math.sign(dx || 1) * k * 0.35;
      }
    }
  };

  let width = 1;
  let height = 1;
  let t = 180 * DT;
  let acc = 0;
  let sway = 0;

  const fit = () => {
    const aspect = width / height;
    camera.aspect = aspect;
    const tanHalf = Math.tan((FOV * Math.PI) / 360);
    const vFit = (BH * 1.12) / 2 / tanHalf;
    const hFit = (BW + 1.2) / 2 / tanHalf / aspect;
    camera.position.set(0, 0.06, Math.max(vFit, hFit) * 1.02 + 0.3);
    camera.updateProjectionMatrix();
    // The shoji fills the view whatever the stage's shape
    const dist = camera.position.z - shoji.position.z;
    const viewH = 2 * tanHalf * dist * 1.2;
    shoji.scale.set(viewH * aspect, viewH, 1);
  };

  const draw = () => {
    camera.position.x = Math.sin(sway * 0.1) * 0.2;
    camera.position.y = 0.06 + Math.sin(sway * 0.14 + 1.1) * 0.07;
    camera.lookAt(0, -0.02, 0);
    renderer.render(scene, camera);
  };

  const textures: Texture[] = [alphaMap, woodTex];
  const paint = async () => {
    const serif = resolveFontFamily("--font-serif");
    await loadFont(600, 160, serif);
    if (disposed) return;
    const dye = resolveToken(opts.dye || "notebook-text");
    const resist = mixRGB(palette.base, [1, 1, 1], 0.5);
    const albedo = new CanvasTexture(makeClothCanvas({ dye, resist, title: opts.title, numeral: opts.numeral, motif: opts.motif, serif }));
    albedo.colorSpace = SRGBColorSpace;
    albedo.anisotropy = maxAniso;
    mat.map?.dispose();
    mat.map = albedo;
    mat.attenuationColor = new Color().setRGB(...mixRGB(dye, [1, 1, 1], 0.55), SRGBColorSpace);
    mat.sheenColor = new Color().setRGB(...mixRGB(dye, [1, 1, 1], 0.8), SRGBColorSpace);
    mat.needsUpdate = true;
    const shojiTex = makeShojiTexture(palette.base, palette.text);
    shojiMat.map?.dispose();
    shojiMat.map = shojiTex;
    shojiMat.needsUpdate = true;
  };

  const ready = (async () => {
    // The sheet hangs and settles before the first frame, as the original does
    for (let s = 0; s < 180; s++) step(s * DT);
    commit();
    await paint();
    if (disposed) return;
    try {
      await renderer.compileAsync(scene, camera);
    } catch {
      // the first frame compiles whatever is left
    }
    built = true;
    draw();
  })();

  return {
    ready,

    resize(cssW, cssH, pr) {
      width = Math.max(1, cssW);
      height = Math.max(1, cssH);
      renderer.setPixelRatio(pr);
      renderer.setSize(width, height, false);
      fit();
      if (built) draw();
    },

    render(_now, dt) {
      if (!built || reduced) return;
      acc += Math.min(dt / 1000, 0.1);
      let steps = 0;
      part();
      while (acc >= DT && steps < 3) {
        t += DT;
        sway += DT;
        step(t);
        acc -= DT;
        steps++;
      }
      if (steps === 3) acc = 0;
      gust = Math.max(0, gust - (dt / 1000) * 0.6);
      if (steps) commit();
      draw();
    },

    update(next) {
      const repaint = ["title", "numeral", "motif", "dye"].some((k) => k in next && next[k as keyof WovenClothOptions] !== opts[k as keyof WovenClothOptions]);
      opts = { ...opts, ...next };
      renderer.toneMappingExposure = 1.22 * opts.exposure;
      if (repaint) void paint().then(() => built && draw());
      else if (built) draw();
    },

    setPalette(p: RoomPalette) {
      palette = p;
      void paint().then(() => built && draw());
    },

    still() {
      reduced = true;
      void ready.then(() => !disposed && draw());
    },

    command(name) {
      if (name === "gust") gust = 1.6;
    },

    dispose() {
      disposed = true;
      textures.forEach((tex) => tex.dispose());
      mat.map?.dispose();
      shojiMat.map?.dispose();
      const materials = new Set<Material>([mat, shojiMat, wood, cordMat]);
      scene.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose();
      });
      materials.forEach((m) => m.dispose());
      renderer.dispose();
    },
  };
}
