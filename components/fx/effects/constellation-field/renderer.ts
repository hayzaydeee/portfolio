import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { resolveToken, rgbToCss } from "@/components/fx/runtime/palette";
import type { ConstellationFieldOptions } from "./meta";

/**
 * Port of ThreeUI's Constellation Field (MIT, Meng To): nodes drift and bounce, links fade
 * with distance, and the pointer pulls nearby nodes in. The original drew pale gold on a
 * fixed page; this draws in the project's accent token (or the room glow) on a clear canvas,
 * and moves by dt.
 */

type Node = { x: number; y: number; vx: number; vy: number; r: number; phase: number };

const SOURCE: RGB = [230 / 255, 200 / 255, 121 / 255];
const PULL_RADIUS = 220;

export function create(ctx: FxContext, initial: ConstellationFieldOptions): FxInstance<ConstellationFieldOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");

  let palette = ctx.palette;
  let w = 1;
  let h = 1;
  let ratio = 1;
  let clock = 0;
  let still = false;
  let nodes: Node[] = [];
  let ink = "";
  let halo: string[] = [];
  let links: string[] = [];

  const recolour = () => {
    const rgb = opts.sourcePalette ? SOURCE : opts.accent ? resolveToken(opts.accent) : palette.glow;
    ink = rgbToCss(rgb);
    halo = Array.from({ length: 11 }, (_, i) => rgbToCss(rgb, (i / 10) * 0.28));
    links = Array.from({ length: 21 }, (_, i) => rgbToCss(rgb, 0.22 + (i / 20) * 0.55));
  };

  const populate = () => {
    const base = w < 768 ? 40 : 85;
    const count = Math.max(6, Math.round(base * opts.density * Math.min(1, (w * h) / (1280 * 720) + 0.35)));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2.4 + 1.8,
      phase: Math.random() * Math.PI * 2,
    }));
  };

  const draw = (k: number) => {
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, h);
    const L = opts.link;

    // Links first, so the nodes sit crisp on top
    g.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (d >= L) continue;
        g.strokeStyle = links[Math.round((1 - d / L) * 20)];
        g.beginPath();
        g.moveTo(nodes[i].x, nodes[i].y);
        g.lineTo(nodes[j].x, nodes[j].y);
        g.stroke();
      }
    }

    const p = ctx.pointer();
    for (const n of nodes) {
      if (!still) {
        n.x += n.vx * k * opts.speed;
        n.y += n.vy * k * opts.speed;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        // Gentle pointer gravity
        if (p.inside && Math.hypot(n.x - p.x, n.y - p.y) < PULL_RADIUS) {
          n.x -= (n.x - p.x) * 0.005 * k;
          n.y -= (n.y - p.y) * 0.005 * k;
        }
      }
      const pulse = 0.78 + Math.sin(clock * 0.001 + n.phase) * 0.22;
      g.fillStyle = halo[Math.round(pulse * 10)];
      g.beginPath();
      g.arc(n.x, n.y, n.r * 2.4, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = pulse;
      g.fillStyle = ink;
      g.beginPath();
      g.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
  };

  recolour();

  return {
    resize(cssW, cssH, pr) {
      const first = w === 1 && h === 1;
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      ratio = pr;
      canvas.width = Math.max(1, Math.round(w * pr));
      canvas.height = Math.max(1, Math.round(h * pr));
      if (first || !nodes.length) populate();
      draw(0);
    },

    render(_now, dt) {
      const step = Math.min(50, dt);
      clock += step;
      draw(step / 16.67);
    },

    update(next) {
      const repopulate = next.density !== undefined && next.density !== opts.density;
      opts = { ...opts, ...next };
      recolour();
      if (repopulate) populate();
      if (still) draw(0);
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      if (still) draw(0);
    },

    still() {
      still = true;
      draw(0);
    },

    dispose() {
      nodes = [];
      g.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
