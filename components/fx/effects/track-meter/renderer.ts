import type { FxContext, FxInstance, RoomPalette } from "@/components/fx/runtime/types";
import { resolveToken, rgbToCss } from "@/components/fx/runtime/palette";
import type { TrackMeterOptions } from "./meta";

/**
 * A row-sized meter for the playing track: five rounded bars, one per analyser band (sub,
 * bass, low-mid, mid, high), with the wordmark's fast attack and slow release. Replaces the
 * looped "waveform" the track rows used to fake. Paused or silent, the bars rest low.
 */

const BARS = 5;
const REST = 0.18;

export function create(ctx: FxContext, initial: TrackMeterOptions): FxInstance<TrackMeterOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");

  const levels = new Float32Array(BARS).fill(REST);
  let colour = "";
  let peak = 0;

  const recolour = () => {
    colour = rgbToCss(opts.accent ? resolveToken(opts.accent) : palette.glow);
  };
  recolour();

  const draw = () => {
    const w = canvas.width;
    const h = canvas.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = colour;
    const pitch = w / BARS;
    const bw = Math.max(1, pitch * 0.5);
    for (let i = 0; i < BARS; i++) {
      const bh = Math.max(bw, h * levels[i]);
      const x = i * pitch + (pitch - bw) / 2;
      const y = (h - bh) / 2;
      g.beginPath();
      g.roundRect(x, y, bw, bh, bw / 2);
      g.fill();
    }
  };

  return {
    resize(cssW, cssH, pr) {
      canvas.width = Math.max(1, Math.round(cssW * pr));
      canvas.height = Math.max(1, Math.round(cssH * pr));
      draw();
    },

    render(now, dt) {
      const frame = ctx.audio?.(now) ?? null;
      const playing = !!frame?.playing;
      let top = 0;
      for (let i = 0; i < BARS; i++) {
        const target = playing && frame ? Math.min(1, REST + frame.bands[i] * 1.6 * opts.audioGain) : REST;
        const k = target > levels[i] ? 1 - Math.pow(0.0005, dt / 1000) : 1 - Math.pow(0.02, dt / 1000);
        levels[i] += (target - levels[i]) * k;
        top = Math.max(top, levels[i]);
      }
      // A rounded peak for the suite: it rises above rest only while the music drives it
      const rounded = Math.round(top * 20) / 20;
      if (rounded !== peak) {
        peak = rounded;
        canvas.dataset.peak = String(peak);
      }
      draw();
    },

    update(next) {
      opts = { ...opts, ...next };
      recolour();
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
      delete canvas.dataset.peak;
    },
  };
}
