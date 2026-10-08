import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB, rgbToCss } from "@/components/fx/runtime/palette";
import type { PlayerGlowOptions } from "./meta";

/**
 * The player bar's RMS glow. Five additive lobes stand on the canvas's bottom edge (the
 * bar's top), one per analyser band, sub on the left to highs on the right: each grows
 * with its band, all of them brighten with the loudness, and an onset flares them. The
 * bands keep the wordmark's fast attack and slow release, so the light jumps on a hit and
 * sinks back after it.
 */

const LOBES = 5;

export function create(ctx: FxContext, initial: PlayerGlowOptions): FxInstance<PlayerGlowOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");

  const levels = new Float32Array(LOBES);
  let loud = 0;
  let flare = 0;
  let colours: RGB[] = [];
  let sounding = false;
  let mark = -1;

  // Lows in the room's accent, highs toward its glow and warmth
  const recolour = () => {
    const p = palette;
    colours = Array.from({ length: LOBES }, (_, i) => {
      const t = i / (LOBES - 1);
      return t < 0.5 ? mixRGB(p.accent, p.glow, t * 2) : mixRGB(p.glow, p.warm, (t - 0.5) * 2 * 0.6);
    });
  };
  recolour();

  const draw = () => {
    const w = canvas.width;
    const h = canvas.height;
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";
    const rx = (w / LOBES) * 1.25;
    for (let i = 0; i < LOBES; i++) {
      const level = Math.max(opts.rest, levels[i]);
      const ry = h * Math.min(1, 0.3 + level * 0.85);
      const alpha = Math.min(0.85, (0.18 + loud * 0.9 + flare * 0.35) * level);
      if (alpha < 0.004) continue;
      g.save();
      g.translate(((i + 0.5) / LOBES) * w, h);
      g.scale(rx / ry, 1);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, ry);
      grad.addColorStop(0, rgbToCss(colours[i], alpha));
      grad.addColorStop(0.45, rgbToCss(colours[i], alpha * 0.35));
      grad.addColorStop(1, rgbToCss(colours[i], 0));
      g.fillStyle = grad;
      g.fillRect(-ry, -ry, ry * 2, ry);
      g.restore();
    }
    g.globalCompositeOperation = "source-over";
  };

  return {
    resize(cssW, cssH, pr) {
      canvas.width = Math.max(1, Math.round(cssW * pr));
      canvas.height = Math.max(1, Math.round(cssH * pr));
      draw();
    },

    render(now, dt) {
      const s = dt / 1000;
      const frame = ctx.audio?.(now) ?? null;
      const playing = !!frame?.playing;
      if (playing !== sounding) {
        sounding = playing;
        if (playing) canvas.dataset.audio = "1";
        else delete canvas.dataset.audio;
      }
      for (let i = 0; i < LOBES; i++) {
        const target = playing && frame ? Math.min(1, frame.bands[i] * 1.5 * opts.audioGain) : 0;
        const k = target > levels[i] ? 1 - Math.pow(0.0005, s) : 1 - Math.pow(0.05, s);
        levels[i] += (target - levels[i]) * k;
      }
      const wantLoud = playing && frame ? Math.min(1, frame.rms * 3 * opts.audioGain) : 0;
      loud += (wantLoud - loud) * (1 - Math.pow(wantLoud > loud ? 0.001 : 0.08, s));
      if (playing && frame && frame.onset > 0) flare = 1;
      flare *= Math.pow(0.02, s);
      // Loudness in twentieths, for the suite to see the music reach the light
      const rounded = Math.round(loud * 20) / 20;
      if (rounded !== mark) {
        mark = rounded;
        canvas.dataset.loud = String(rounded);
      }
      draw();
    },

    update(next) {
      opts = { ...opts, ...next };
      draw();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      draw();
    },

    still() {
      draw();
    },

    dispose() {
      delete canvas.dataset.audio;
      delete canvas.dataset.loud;
    },
  };
}
