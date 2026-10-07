import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB, rgbToCss } from "@/components/fx/runtime/palette";
import { loadFont, resolveFontFamily } from "@/components/fx/runtime/fonts";
import type { GlyphBallOptions } from "./meta";

/**
 * Port of the "Ball" plate from ThreeUI's Text Path Studies (MIT, Meng To): glyphs scattered
 * uniformly over a sphere, spun and tilted, the far side shrunk away. A click knocks the
 * letters facing you loose under gravity and they grow back. Here the letters come from a
 * vocabulary instead of a random pool, regrown letters arrive in the room's glow before
 * settling into ink, and the clock is the shared ticker.
 */

const TILT = 0.17;
/** Sphere radius as a share of the short side */
const RADIUS = 0.42;
/** Glyph size as a share of the radius (the original's 0.0265 card width over 0.3065) */
const GLYPH = 0.0865;
const HIT = 0.18;
const FACING = 0.72;
const REGROW_MS = 1500;
const GROW_MS = 420;
const TINT_MS = 1800;
const PART_LIFE = 2100;
const MAX_PARTS = 420;
const SPIN_REST = 0.17;
const SPIN_HOVER = 0.62;

type Pt = { x: number; y: number; z: number; c: string; back: number };
type Part = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; c: string; t: number };

/** Tiny seeded xorshift, so the sphere's layout is the same on every visit */
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

function letters(text: string): string[] {
  const out = Array.from(text.toLowerCase()).filter((ch) => /[\p{L}\p{N}]/u.test(ch));
  return out.length ? out : ["·"];
}

const ramp = (rgb: RGB) => Array.from({ length: 64 }, (_, i) => rgbToCss(rgb, i / 63));
const pick = (r: string[], a: number) => r[a <= 0 ? 0 : a >= 1 ? 63 : (a * 63) | 0];

export function create(ctx: FxContext, initial: GlyphBallOptions): FxInstance<GlyphBallOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");

  const family = resolveFontFamily("--font-mono");
  let palette = ctx.palette;
  let w = 1;
  let h = 1;
  let ratio = 1;
  let still = false;
  let spin = 0;
  let vel = SPIN_REST;
  let pts: Pt[] = [];
  let proj = new Float32Array(0);
  const order: number[] = [];
  const parts: Part[] = [];
  let inkRamp: string[] = [];
  let glowRamp: string[] = [];
  let ink: RGB = [1, 1, 1];
  let glow: RGB = [1, 1, 1];
  let loose = -1;
  let regrowTimer: ReturnType<typeof setTimeout> | undefined;

  const build = () => {
    const r = rng(77712345);
    const chars = letters(opts.text);
    const n = Math.max(1, Math.round(opts.count));
    pts = [];
    for (let i = 0; i < n; i++) {
      // Uniform random on the sphere: a lattice would show its spiral arms
      const y = 1 - 2 * r();
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const th = r() * Math.PI * 2;
      pts.push({ x: Math.cos(th) * rad, y, z: Math.sin(th) * rad, c: chars[i % chars.length], back: 0 });
    }
    proj = new Float32Array(n * 4);
    parts.length = 0;
  };

  const recolour = () => {
    ink = opts.sourcePalette ? [20 / 255, 19 / 255, 16 / 255] : palette.text;
    glow = opts.sourcePalette ? ink : palette.glow;
    inkRamp = ramp(ink);
    glowRamp = ramp(glow);
  };

  const geometry = () => {
    const u = Math.min(w, h);
    const R = u * RADIUS;
    return { R, fs: R * GLYPH, cx: w / 2, cy: h / 2 };
  };

  const knock = (px: number, py: number) => {
    const { R, fs } = geometry();
    const now = performance.now();
    const hitR = R * HIT;
    const hit = hitR * hitR;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].back > now) continue;
      if (proj[i * 4 + 3] < FACING) continue;
      const dx = proj[i * 4] - px;
      const dy = proj[i * 4 + 1] - py;
      if (dx * dx + dy * dy > hit) continue;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      pts[i].back = now + REGROW_MS + Math.random() * 260;
      parts.push({
        x: proj[i * 4],
        y: proj[i * 4 + 1],
        vx: (dx / d) * R * (0.33 + Math.random() * 0.52) + (Math.random() - 0.5) * R * 0.16,
        vy: (dy / d) * R * 0.26 - R * (0.13 + Math.random() * 0.33),
        rot: 0,
        vr: (Math.random() - 0.5) * 5.5,
        size: fs * (0.85 + 0.15 * proj[i * 4 + 2]),
        c: pts[i].c,
        t: now,
      });
    }
    if (parts.length > MAX_PARTS) parts.splice(0, parts.length - MAX_PARTS);
  };

  const draw = (now: number, dt: number) => {
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, h);
    const { R, fs, cx, cy } = geometry();

    if (!still) {
      const target = (ctx.pointer().inside ? SPIN_HOVER : SPIN_REST) * opts.speed;
      vel += (target - vel) * Math.min(1, dt / 300);
      spin += (vel * dt) / 1000;
    }

    const cs = Math.cos(spin);
    const sn = Math.sin(spin);
    const ct = Math.cos(TILT);
    const st = Math.sin(TILT);
    order.length = 0;
    let down = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const x1 = p.x * cs - p.z * sn;
      const z1 = p.x * sn + p.z * cs;
      const y2 = p.y * ct - z1 * st;
      const z2 = p.y * st + z1 * ct;
      // 0 = far side, 1 = nearest point
      const d = (z2 + 1) * 0.5;
      proj[i * 4] = cx + x1 * R;
      proj[i * 4 + 1] = cy + y2 * R;
      proj[i * 4 + 2] = 0.1 + 0.9 * Math.pow(d, 1.8);
      proj[i * 4 + 3] = d;
      if (p.back > now) {
        down++;
        continue;
      }
      order.push(i);
    }
    order.sort((a, b) => proj[a * 4 + 3] - proj[b * 4 + 3]);

    // Marked for the verification suite: one attribute write when the count changes
    if (down !== loose) {
      loose = down;
      canvas.dataset.loose = String(down);
    }

    g.textAlign = "center";
    g.textBaseline = "middle";
    let lastFont = "";
    for (const j of order) {
      const depth = proj[j * 4 + 3];
      // Depth-sorted, so quantising the size keeps font churn low
      const font = `700 ${Math.round(fs * proj[j * 4 + 2] * 4) / 4}px ${family}`;
      if (font !== lastFont) {
        g.font = font;
        lastFont = font;
      }
      let a = 0.3 + 0.7 * Math.pow(depth, 1.1);
      const back = pts[j].back;
      const since = back ? now - back : Infinity;
      if (since < TINT_MS) {
        // Still growing: fades in, arriving in the glow and cooling into ink
        a *= Math.min(1, since / GROW_MS);
        g.fillStyle = rgbToCss(mixRGB(glow, ink, since / TINT_MS), a);
      } else {
        g.fillStyle = pick(inkRamp, a);
      }
      g.fillText(pts[j].c, proj[j * 4], proj[j * 4 + 1]);
    }

    // Knocked-loose letters fall under gravity, spinning, fading as they go
    const gravity = R * 2.6;
    const step = dt / 1000;
    for (let m = parts.length - 1; m >= 0; m--) {
      const q = parts[m];
      const age = now - q.t;
      if (age > PART_LIFE || q.y > h + 40) {
        parts.splice(m, 1);
        continue;
      }
      q.vy += gravity * step;
      q.x += q.vx * step;
      q.y += q.vy * step;
      q.rot += q.vr * step;
      g.save();
      g.translate(q.x, q.y);
      g.rotate(q.rot);
      g.font = `700 ${q.size.toFixed(2)}px ${family}`;
      g.fillStyle = pick(glowRamp, 0.95 * Math.sqrt(Math.max(0, 1 - age / PART_LIFE)));
      g.fillText(q.c, 0, 0);
      g.restore();
    }
  };

  build();
  recolour();

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
      const rebuild = (next.count !== undefined && next.count !== opts.count) || (next.text !== undefined && next.text !== opts.text);
      opts = { ...opts, ...next };
      if (rebuild) build();
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
      spin = 0.6;
      draw(performance.now(), 0);
    },

    command(name, arg) {
      if (name === "click") {
        const { x, y } = arg as { x: number; y: number };
        knock(x, y);
      } else if (name === "knock") {
        const { cx, cy } = geometry();
        knock(cx, cy);
      }
      if (still) {
        // No ticker under reduced motion: draw the gap now and the regrown sphere once it's back
        draw(performance.now(), 0);
        clearTimeout(regrowTimer);
        regrowTimer = setTimeout(() => draw(performance.now(), 0), REGROW_MS + 300 + TINT_MS);
      }
    },

    dispose() {
      clearTimeout(regrowTimer);
      parts.length = 0;
      g.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
