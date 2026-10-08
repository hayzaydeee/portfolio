import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB, rgbToCss } from "@/components/fx/runtime/palette";
import type { IgnitionOptions } from "./meta";

/**
 * After ThreeUI's Ignition Button (MIT, Meng To). The original ran a fragment shader in its
 * own WebGL context inside the button: polar star cells scrolling outward, stretching into
 * streaks as a warp value rises, plus a flash on click. A context per button is too dear for
 * a site that already spends its WebGL budget on backdrops, so this is the same picture in
 * Canvas 2D: stars fly out from the centre, their trails lengthen with warp, and the press
 * washes the face in light. Colours come from the room.
 */

type Star = { a: number; r: number; v: number; hot: boolean; tw: number };

const SOURCE = { base: [0.012, 0.011, 0.014] as RGB, haze: [0.13, 0.06, 0.032] as RGB, star: [1, 0.94, 0.85] as RGB, hot: [1, 0.6, 0.33] as RGB, flash: [1, 0.97, 0.92] as RGB };

export function create(ctx: FxContext, initial: IgnitionOptions): FxInstance<IgnitionOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");

  let palette = ctx.palette;
  let w = 1;
  let h = 1;
  let ratio = 1;
  let warp = 0;
  let warpTarget = 0;
  let flash = 0;
  let still = false;
  let stars: Star[] = [];
  let fills = { base: "", haze: "", star: [] as string[], hot: [] as string[], flash: SOURCE.flash };

  const recolour = () => {
    const c = opts.sourcePalette
      ? SOURCE
      : { base: palette.base, haze: mixRGB(palette.base, palette.warm, 0.18), star: palette.text, hot: palette.warm, flash: mixRGB(palette.text, [1, 1, 1], 0.5) };
    const ramp = (rgb: RGB) => Array.from({ length: 16 }, (_, i) => rgbToCss(rgb, i / 15));
    fills = { base: rgbToCss(c.base), haze: rgbToCss(c.haze, 0.9), star: ramp(c.star), hot: ramp(c.hot), flash: c.flash };
  };

  const spawn = (anywhere: boolean): Star => ({
    a: Math.random() * Math.PI * 2,
    r: anywhere ? Math.random() : 0.02 + Math.random() * 0.08,
    v: 0.6 + Math.random() * 0.8,
    hot: Math.random() > 0.9,
    tw: Math.random() * Math.PI * 2,
  });

  const populate = () => {
    stars = Array.from({ length: Math.round(opts.stars) }, () => spawn(true));
  };

  const draw = (dt: number, t: number) => {
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = fills.base;
    g.fillRect(0, 0, w, h);

    // A warm haze that thickens as the core is primed
    const cx = w / 2;
    const cy = h / 2;
    const reach = Math.hypot(cx, cy);
    const haze = g.createRadialGradient(cx, cy, 0, cx, cy, reach);
    haze.addColorStop(0, fills.haze);
    haze.addColorStop(1, "transparent");
    g.globalAlpha = 0.35 + 0.45 * warp;
    g.fillStyle = haze;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;

    // Stars accelerate outward; their trails stretch with warp
    const step = (dt / 1000) * opts.speed;
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const rate = (0.05 + warp * 1.35) * s.v;
      const prev = s.r;
      if (!still) s.r += s.r * rate * step * 2.2 + rate * step * 0.08;
      if (s.r > 1.05) {
        stars[i] = spawn(false);
        continue;
      }
      const fade = Math.min(1, Math.max(0, (s.r - 0.04) / 0.2));
      const twinkle = warp > 0.5 ? 1 : 0.7 + 0.3 * Math.sin(s.tw + t * 0.009);
      const level = Math.min(15, Math.round(fade * twinkle * 15 * (0.7 + 0.5 * warp)));
      if (level <= 0) continue;
      const trail = Math.max(prev, s.r - (0.004 + warp * 0.12) * s.r * 4);
      const ca = Math.cos(s.a) * reach;
      const sa = Math.sin(s.a) * reach;
      g.strokeStyle = (s.hot ? fills.hot : fills.star)[level];
      g.lineWidth = 0.6 + s.r * (1.1 + warp * 0.6);
      g.beginPath();
      g.moveTo(cx + ca * trail, cy + sa * trail);
      g.lineTo(cx + ca * s.r + 0.01, cy + sa * s.r);
      g.stroke();
    }

    // The core glows while primed; the press washes everything out and fades back
    if (warp > 0.01) {
      const core = g.createRadialGradient(cx, cy, 0, cx, cy, reach * 0.5);
      core.addColorStop(0, fills.hot[Math.round(6 * warp)]);
      core.addColorStop(1, "transparent");
      g.fillStyle = core;
      g.fillRect(0, 0, w, h);
    }
    g.globalCompositeOperation = "source-over";
    if (flash > 0.01) {
      g.fillStyle = rgbToCss(fills.flash, Math.min(1, flash));
      g.fillRect(0, 0, w, h);
    }
  };

  recolour();
  populate();

  let clock = 0;
  return {
    resize(cssW, cssH, pr) {
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      ratio = pr;
      canvas.width = Math.max(1, Math.round(w * pr));
      canvas.height = Math.max(1, Math.round(h * pr));
      if (still) draw(0, 0);
    },

    render(_now, dt) {
      const step = Math.min(50, dt);
      clock += step;
      warp += (warpTarget - warp) * Math.min(1, (step / 1000) * 2.6);
      flash *= Math.exp((-4.5 * step) / 1000);
      draw(step, clock);
    },

    update(next) {
      const repopulate = next.stars !== undefined && Math.round(next.stars) !== Math.round(opts.stars);
      opts = { ...opts, ...next };
      recolour();
      if (repopulate) populate();
      if (still) draw(0, 0);
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      if (still) draw(0, 0);
    },

    still() {
      still = true;
      draw(0, 0);
    },

    command(name, arg) {
      if (name === "warp") warpTarget = arg ? 1 : 0;
      else if (name === "flash") {
        flash = 1;
        warp = 0;
      }
      canvas.dataset.warp = String(warpTarget);
      if (still) draw(0, 0);
    },

    dispose() {
      stars = [];
      g.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
