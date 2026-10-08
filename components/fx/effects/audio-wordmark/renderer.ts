import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { resolveToken, rgbToCss } from "@/components/fx/runtime/palette";
import type { AudioWordmarkOptions } from "./meta";

/**
 * Port of the bar mark from ThreeUI's Audio Wordmark (MIT, Meng To). Same geometry: two discs
 * a little closer than their diameter, the left one 22 rounded bars clipped to the circle,
 * the right one a solid disc with 16 slots cut through it, each bar spanning its chord. The
 * original only breathed the left bars on a loop; here both discs follow the spectrum while
 * music plays (22 and 16 log-spaced bands), and fall back to that loop when it's silent.
 * The canvas is transparent, so the room shows through the slots.
 */

const LEFT_BARS = 22;
const RIGHT_BARS = 16;
const SOURCE: RGB = [0xea / 255, 0x39 / 255, 0x27 / 255];
/** Analyser bin range the bands span (of 1024), roughly 40 Hz to 12 kHz at 44.1-48 kHz */
const BIN_LO = 2;
const BIN_HI = 520;

function logBands(count: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const a = Math.round(BIN_LO * Math.pow(BIN_HI / BIN_LO, i / count));
    const b = Math.max(a + 1, Math.round(BIN_LO * Math.pow(BIN_HI / BIN_LO, (i + 1) / count)));
    out.push([a, b]);
  }
  return out;
}

export function create(ctx: FxContext, initial: AudioWordmarkOptions): FxInstance<AudioWordmarkOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");

  const leftBands = logBands(LEFT_BARS);
  const rightBands = logBands(RIGHT_BARS);
  const left = new Float32Array(LEFT_BARS);
  const right = new Float32Array(RIGHT_BARS);
  let w = 1;
  let h = 1;
  let dpr = 1;
  let t = 0;
  let live = false;
  let still = false;
  let colour = "";

  const recolour = () => {
    const rgb = opts.sourcePalette ? SOURCE : opts.accent ? resolveToken(opts.accent) : palette.glow;
    colour = rgbToCss(rgb);
  };
  recolour();

  const roundRect = (x: number, y: number, rw: number, rh: number, r: number) => {
    const rr = Math.min(r, rw / 2, rh / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + rw, y, x + rw, y + rh, rr);
    g.arcTo(x + rw, y + rh, x, y + rh, rr);
    g.arcTo(x, y + rh, x, y, rr);
    g.arcTo(x, y, x + rw, y, rr);
    g.closePath();
  };

  /** One disc: `levels` in 0..1 set each bar's width, between the original's rest and full widths */
  const disc = (cx: number, cy: number, r: number, levels: Float32Array, inverse: boolean) => {
    const n = levels.length;
    const pitch = (r * 2) / n;
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = colour;
    if (inverse) {
      g.fill();
      g.globalCompositeOperation = "destination-out";
    }
    for (let i = 0; i < n; i++) {
      const x = -r + (i + 0.5) * pitch;
      const chord = Math.sqrt(Math.max(0, r * r - x * x)) * 2;
      if (chord < 6 * dpr) continue;
      // left: the original's 0.62 * pulse (pulse 0.56..1); right: slots around its fixed 0.38
      const bw = inverse ? pitch * (0.22 + 0.36 * levels[i]) : pitch * 0.62 * (0.56 + 0.44 * levels[i]);
      roundRect(cx + x - bw / 2, cy - chord / 2, Math.max(2 * dpr, bw), chord, Math.min(bw, chord) * 0.45);
      g.fill();
    }
    g.restore();
  };

  const draw = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    // The original: r 156 and centres 296 apart on a 1080 stage; keep that ratio, fit to the box
    const r = Math.min((h * dpr) / 2.1, (w * dpr) / (2 * (1 + 296 / 312) + 0.2));
    const gap = r * (296 / 312);
    const cx = (w * dpr) / 2;
    const cy = (h * dpr) / 2;
    disc(cx - gap, cy, r, left, false);
    disc(cx + gap, cy, r, right, true);
  };

  const idle = (time: number) => {
    for (let i = 0; i < LEFT_BARS; i++) {
      // the original's pulse, 0.78 + 0.22 * sin * sin, mapped onto 0..1
      left[i] = (Math.sin(time * 6.4 + i * 0.62) * Math.sin(time * 2.4 + i * 0.17) + 1) / 2;
    }
    right.fill(0.5);
  };

  const follow = (bins: Uint8Array, bands: [number, number][], out: Float32Array, dt: number) => {
    for (let i = 0; i < out.length; i++) {
      const [a, b] = bands[i];
      let sum = 0;
      for (let k = a; k < b; k++) sum += bins[k] ?? 0;
      const level = Math.min(1, (sum / (b - a) / 255) * 1.35 * opts.audioGain);
      // fast attack, slower release, frame-rate independent
      const k = level > out[i] ? 1 - Math.pow(0.0005, dt / 1000) : 1 - Math.pow(0.05, dt / 1000);
      out[i] += (level - out[i]) * k;
    }
  };

  idle(0);

  return {
    resize(cssW, cssH, pr) {
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      dpr = pr;
      canvas.width = Math.max(1, Math.round(w * pr));
      canvas.height = Math.max(1, Math.round(h * pr));
      draw();
    },

    render(now, dt) {
      const frame = ctx.audio?.(now) ?? null;
      const playing = !!frame?.playing;
      if (playing && frame) {
        follow(frame.bins, leftBands, left, dt);
        follow(frame.bins, rightBands, right, dt);
      } else {
        t += (Math.min(50, dt) / 1000) * opts.speed;
        idle(t);
      }
      if (playing !== live) {
        live = playing;
        if (live) canvas.dataset.audio = "1";
        else delete canvas.dataset.audio;
      }
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
      still = true;
      // Through t, so the render that follows a still (with dt 0) keeps this pose
      t = 16.2 * opts.speed;
      idle(t);
      draw();
    },

    dispose() {
      delete canvas.dataset.audio;
    },
  };
}
