import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB, rgbToCss } from "@/components/fx/runtime/palette";
import { seeded } from "@/components/fx/runtime/random";
import type { DustMotesOptions } from "./meta";

/**
 * After ThreeUI's Particle Drift (MIT, Meng To): where the drift lets characters fall through
 * rising beams, this lets dust hang in one wide beam of afternoon light. A four-pane window
 * off the top left throws a beam across the room to a bright patch on the wall, the mullions
 * showing as darker seams in both; the rest of the wall sits a shade dimmer. Dust drifts
 * everywhere on slow, independent currents, rising a little as warm air does, but only shows
 * where the beam catches it, glinting as it turns. A passing pointer stirs what's near it.
 *
 * The beam and the patch are painted once per size into a layer (they're blurred, and a blur
 * per frame is the expensive part); a frame is that layer, breathing very slightly, and the
 * dust on top.
 */

const BASE_AREA = 1440 * 900;
const STIR = 150;

type Mote = { x: number; y: number; z: number; ex: number; ey: number; p: [number, number, number, number]; r: number };

export function create(ctx: FxContext, initial: DustMotesOptions): FxInstance<DustMotesOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");

  let w = 1;
  let h = 1;
  let ratio = 1;
  let reduced = ctx.reducedMotion;
  let time = 0;
  let motes: Mote[] = [];
  let layer: HTMLCanvasElement | null = null;
  const rand = seeded(1012);
  const last = { x: 0, y: 0, seen: false };

  // The beam: from a window off the top left to the patch, as a band that widens on the way
  let S = { x: 0, y: 0 };
  let P = { x: 0, y: 0 };
  let hw0 = 1;
  let hw1 = 1;
  let patch = { w: 1, h: 1 };

  const warm = (): RGB => mixRGB(palette.glow, [1, 0.94, 0.8], 0.45);
  /** Dust catching the light is brighter than the beam it hangs in */
  const speck = (): RGB => mixRGB([1, 1, 1], warm(), 0.25);

  const place = () => {
    const narrow = w < h;
    P = narrow ? { x: w * 0.62, y: h * 0.3 } : { x: w * 0.66, y: h * 0.42 };
    S = { x: -w * 0.18, y: -h * 0.32 };
    patch = { w: Math.min(w * (narrow ? 0.58 : 0.32), 560), h: 0 };
    patch.h = patch.w * 0.92;
    hw0 = patch.w * 0.32;
    hw1 = patch.w * 0.58;
  };

  /** How lit a point is: 1 in the beam's core, fading to 0 off its edges and near the window */
  const beamAt = (x: number, y: number) => {
    const ax = P.x - S.x;
    const ay = P.y - S.y;
    const len2 = ax * ax + ay * ay;
    const t = ((x - S.x) * ax + (y - S.y) * ay) / len2;
    if (t < 0 || t > 1.12) return 0;
    const len = Math.sqrt(len2);
    const across = Math.abs((x - S.x) * ay - (y - S.y) * ax) / len;
    const half = hw0 + (hw1 - hw0) * Math.min(1, t);
    const edge = 1 - Math.min(1, Math.max(0, (across / half - 0.55) / 0.45));
    const along = Math.min(1, t / 0.18) * (t > 1 ? Math.max(0, 1 - (t - 1) / 0.12) : 1);
    return edge * edge * (3 - 2 * edge) * along;
  };

  /** The patch the window throws on the wall: a sheared quad in four panes */
  const patchPath = (x: CanvasRenderingContext2D, inset: number) => {
    const shear = -0.32;
    const pw = patch.w / 2;
    const ph = patch.h / 2;
    const gap = patch.w * 0.035;
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const x0 = sx < 0 ? -pw : gap / 2;
      const x1 = sx < 0 ? -gap / 2 : pw;
      const y0 = sy < 0 ? -ph : gap / 2;
      const y1 = sy < 0 ? -gap / 2 : ph;
      const pt = (px: number, py: number) => [P.x + px + py * shear, P.y + py] as const;
      const a = pt(x0 + inset, y0 + inset);
      const b = pt(x1 - inset, y0 + inset);
      const c = pt(x1 - inset, y1 - inset);
      const d = pt(x0 + inset, y1 - inset);
      x.moveTo(a[0], a[1]);
      x.lineTo(b[0], b[1]);
      x.lineTo(c[0], c[1]);
      x.lineTo(d[0], d[1]);
      x.closePath();
    }
  };

  const paintLayer = () => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * ratio));
    c.height = Math.max(1, Math.round(h * ratio));
    const x = c.getContext("2d", { willReadFrequently: true })!;
    x.scale(ratio, ratio);
    const light = warm();
    const k = opts.light;

    // The room a shade dimmer, so the light has something to be brighter than
    x.fillStyle = rgbToCss(palette.text, 0.12 * k);
    x.fillRect(0, 0, w, h);

    // The beam: the four panes' light as one band, the mullions as darker seams along it
    const blur = Math.max(8, patch.w * 0.05);
    x.save();
    x.filter = `blur(${blur.toFixed(1)}px)`;
    const ax = P.x - S.x;
    const ay = P.y - S.y;
    const len = Math.hypot(ax, ay);
    const nx = -ay / len;
    const ny = ax / len;
    const beam = x.createLinearGradient(S.x, S.y, P.x, P.y);
    beam.addColorStop(0, rgbToCss(light, 0));
    beam.addColorStop(0.25, rgbToCss(light, 0.34 * k));
    beam.addColorStop(1, rgbToCss(light, 0.22 * k));
    x.fillStyle = beam;
    x.beginPath();
    x.moveTo(S.x + nx * hw0, S.y + ny * hw0);
    x.lineTo(P.x + nx * hw1, P.y + ny * hw1);
    x.lineTo(P.x - nx * hw1, P.y - ny * hw1);
    x.lineTo(S.x - nx * hw0, S.y - ny * hw0);
    x.closePath();
    x.fill();
    x.globalCompositeOperation = "destination-out";
    x.strokeStyle = "rgba(0,0,0,0.35)";
    for (const f of [0, -0.5, 0.5]) {
      x.lineWidth = f === 0 ? patch.w * 0.03 : patch.w * 0.012;
      x.beginPath();
      x.moveTo(S.x + nx * hw0 * f, S.y + ny * hw0 * f);
      x.lineTo(P.x + nx * hw1 * f, P.y + ny * hw1 * f);
      x.stroke();
    }
    x.restore();

    // The patch on the wall, cut out of the dimming first so it reads as light, not paint
    x.save();
    x.filter = `blur(${(blur * 0.6).toFixed(1)}px)`;
    x.globalCompositeOperation = "destination-out";
    x.beginPath();
    patchPath(x, 0);
    x.fillStyle = "rgba(0,0,0,0.9)";
    x.fill();
    x.globalCompositeOperation = "source-over";
    x.beginPath();
    patchPath(x, 0);
    x.fillStyle = rgbToCss(light, 0.72 * k);
    x.fill();
    x.restore();
    layer = c;
  };

  const populate = () => {
    const n = Math.round(Math.max(40, Math.min(420, 170 * ((w * h) / BASE_AREA) * opts.density)));
    motes = Array.from({ length: n }, () => {
      const z = rand();
      return {
        x: rand() * w,
        y: rand() * h,
        z,
        ex: 0,
        ey: 0,
        p: [rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28],
        r: (0.7 + rand() * 1.3) * (0.6 + z * 0.9),
      };
    });
    canvas.dataset.motes = String(n);
  };

  const draw = (dt: number) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    if (layer) {
      g.globalAlpha = reduced ? 1 : 0.94 + 0.06 * Math.sin(time * 0.11);
      g.drawImage(layer, 0, 0);
      g.globalAlpha = 1;
    }
    g.setTransform(ratio, 0, 0, ratio, 0, 0);

    // A pointer moving through stirs the dust near it along its path
    const pointer = ctx.pointer();
    let pvx = 0;
    let pvy = 0;
    if (pointer.inside && last.seen && dt > 0) {
      pvx = (pointer.x - last.x) / dt;
      pvy = (pointer.y - last.y) / dt;
    }
    last.x = pointer.x;
    last.y = pointer.y;
    last.seen = pointer.inside;

    const light = speck();
    const k = opts.light;
    const d = opts.drift;
    const damp = Math.exp(-dt * 1.6);
    for (const m of motes) {
      if (dt > 0) {
        const s = 0.5 + m.z * 0.8;
        const vx = (6 * Math.sin(time * 0.13 + m.p[0]) + 2.5 * Math.sin(time * 0.31 + m.p[1])) * s * d;
        const vy = (-2.2 + 4 * Math.sin(time * 0.17 + m.p[2])) * s * d;
        if (pvx || pvy) {
          const dist = Math.hypot(m.x - pointer.x, m.y - pointer.y);
          if (dist < STIR) {
            const f = (1 - dist / STIR) ** 2 * 0.35;
            m.ex += pvx * f * dt * 3;
            m.ey += pvy * f * dt * 3;
          }
        }
        m.ex *= damp;
        m.ey *= damp;
        m.x += (vx + m.ex) * dt;
        m.y += (vy + m.ey) * dt;
        if (m.x < -10) m.x += w + 20;
        if (m.x > w + 10) m.x -= w + 20;
        if (m.y < -10) m.y += h + 20;
        if (m.y > h + 10) m.y -= h + 20;
      }
      const lit = beamAt(m.x, m.y);
      const glint = 0.55 + 0.45 * Math.sin(time * (0.7 + m.z) + m.p[3]);
      const a = Math.min(1, (0.035 + lit * 0.85 * glint) * k);
      if (a < 0.02) continue;
      g.fillStyle = rgbToCss(lit > 0.05 ? light : palette.text, lit > 0.05 ? a : a * 0.6);
      g.beginPath();
      g.arc(m.x, m.y, m.r * (0.85 + lit * 0.3), 0, Math.PI * 2);
      g.fill();
    }
  };

  return {
    resize(cssW, cssH, pr) {
      const repopulate = Math.abs(cssW - w) > 40 || Math.abs(cssH - h) > 40 || !motes.length;
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      ratio = pr;
      canvas.width = Math.max(1, Math.round(w * pr));
      canvas.height = Math.max(1, Math.round(h * pr));
      place();
      paintLayer();
      if (repopulate) populate();
      draw(0);
    },

    render(_now, dt) {
      if (reduced) return;
      const step = Math.min(dt, 64) / 1000;
      time += step;
      draw(step);
    },

    update(next) {
      const before = `${opts.density}|${opts.light}`;
      opts = { ...opts, ...next };
      if (`${opts.density}|${opts.light}` !== before) {
        paintLayer();
        populate();
      }
      if (reduced) draw(0);
    },

    setPalette(p: RoomPalette) {
      palette = p;
      paintLayer();
      if (reduced) draw(0);
    },

    still() {
      reduced = true;
      draw(0);
    },

    dispose() {
      motes = [];
      layer = null;
    },
  };
}
