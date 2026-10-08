import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import type { CondensationOptions } from "./meta";

/**
 * Port of ThreeUI's Condensation background (MIT, Meng To). Same physics: beads seed at
 * random, grow to a random size, then run; a running drop merges every resting bead in its
 * path and leaves a ripple at the sill. The bead sprites take the room palette instead of
 * the original's fixed blue, and the clock is the ticker's dt.
 */

type Bead = { x: number; y: number; r: number; rMax: number; grow: number; running: boolean; vy: number };
type Splash = { x: number; y: number; r0: number; born: number };

const SOURCE = { fill: [96, 139, 196], edge: [70, 98, 148], ripple: [75, 108, 158] } as const;
const SPLASH_MS = 760;
const RUN_EVERY_MS = 6400;

const to255 = (c: RGB) => c.map((v) => Math.round(v * 255)) as [number, number, number];

export function create(ctx: FxContext, initial: CondensationOptions): FxInstance<CondensationOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");

  let palette = ctx.palette;
  let W = 1;
  let H = 1;
  let n = 1;
  let floor = 1;
  let capacity = 120;
  let clock = 0;
  let lastRun = 0;
  let beads: Bead[] = [];
  let splashes: Splash[] = [];
  let still = false;
  const sprites = new Map<number, HTMLCanvasElement>();

  const colours = () => {
    if (opts.sourcePalette) return SOURCE;
    return { fill: to255(palette.glow), edge: to255(palette.deep), ripple: to255(palette.glow) };
  };

  const sprite = (radius: number) => {
    const r = Math.max(0.5, Math.round(radius * 2) / 2);
    const hit = sprites.get(r);
    if (hit) return hit;
    const pad = Math.ceil(2 * n);
    const size = Math.ceil(r * 2 + pad * 2);
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const s = c.getContext("2d");
    if (!s) return c;
    const mid = size / 2;
    const k = r / (4.4 * n);
    const { fill, edge } = colours();
    s.fillStyle = `rgb(${fill.join(" ")} / ${0.18 + k * 0.22})`;
    s.beginPath();
    s.arc(mid, mid, r, 0, Math.PI * 2);
    s.fill();
    s.strokeStyle = `rgb(${edge.join(" ")} / ${0.35 + k * 0.35})`;
    s.lineWidth = 0.9 * n;
    s.stroke();
    s.fillStyle = `rgb(255 255 255 / ${0.22 + k * 0.24})`;
    s.beginPath();
    s.arc(mid - r * 0.32, mid - r * 0.36, Math.max(0.45 * n, r * 0.24), 0, Math.PI * 2);
    s.fill();
    sprites.set(r, c);
    return c;
  };

  const seed = (size = 0) => {
    const m = 8 * n;
    beads.push({
      x: m + Math.random() * Math.max(1, W - m * 2),
      y: m + Math.random() * Math.max(1, floor - m * 2),
      r: (0.5 + size * 0.7) * n,
      rMax: (2.1 + Math.random() * 2.3) * n,
      grow: (0.0022 + Math.random() * 0.0032) * n,
      running: false,
      vy: 0,
    });
  };

  const populate = () => {
    beads = [];
    splashes = [];
    sprites.clear();
    capacity = Math.max(80, Math.min(240, Math.round((W * H) / (n * n) / 5200)));
    const target = Math.round(capacity * opts.dropAmount * 0.62);
    for (let i = 0; i < target; i++) seed(Math.random() * 3);
  };

  const step = (k: number) => {
    const limit = Math.round(capacity * opts.dropAmount);
    if (beads.length < limit && Math.random() < 0.34 * k) seed();
    // Every few seconds the heaviest resting beads give way
    if (clock - lastRun > RUN_EVERY_MS) {
      lastRun = clock;
      beads
        .filter((b) => !b.running)
        .sort((a, b) => b.r - a.r)
        .slice(0, 3)
        .forEach((b) => {
          b.running = true;
          b.vy = 0.35 * n;
        });
    }
    for (let i = beads.length - 1; i >= 0; i--) {
      const t = beads[i];
      if (!t.running) {
        t.r += t.grow * k;
        if (t.r >= t.rMax) {
          t.running = true;
          t.vy = 0.3 * n;
        }
        continue;
      }
      t.vy = Math.min(t.vy + 0.075 * n * k, 5.4 * n);
      t.y += t.vy * k;
      // A running drop swallows the resting beads in its path
      for (let j = beads.length - 1; j >= 0; j--) {
        const o = beads[j];
        if (o === t || o.running) continue;
        const across = Math.abs(o.x - t.x) < t.r + o.r + 1.5 * n;
        const along = o.y > t.y - t.r && o.y < t.y + t.vy + t.r;
        if (across && along) {
          t.r = Math.sqrt(t.r * t.r + o.r * o.r);
          beads.splice(j, 1);
          if (j < i) i--;
        }
      }
      if (t.y >= floor) {
        splashes.push({ x: t.x, y: floor, r0: t.r, born: clock });
        beads.splice(i, 1);
      }
    }
    splashes = splashes.filter((s) => clock - s.born < SPLASH_MS);
  };

  const draw = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.globalAlpha = opts.opacity;
    for (const b of beads) {
      const s = sprite(b.r);
      g.drawImage(s, b.x - s.width / 2, b.y - s.height / 2);
    }
    const { ripple } = colours();
    for (const s of splashes) {
      const t = (clock - s.born) / SPLASH_MS;
      if (t < 0 || t > 1) continue;
      const r = s.r0 + t * 16 * n;
      g.strokeStyle = `rgb(${ripple.join(" ")} / ${(1 - t) * 0.52})`;
      g.lineWidth = 1.1 * n;
      g.beginPath();
      g.ellipse(s.x, s.y, r, r * 0.34, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
  };

  return {
    resize(cssW, cssH, pr) {
      n = pr;
      W = canvas.width = Math.max(1, Math.floor(cssW * pr));
      H = canvas.height = Math.max(1, Math.floor(cssH * pr));
      floor = Math.max(1, H - 2 * n);
      populate();
      draw();
    },

    render(_now, dt) {
      const ms = Math.min(50, dt) * opts.speed;
      clock += ms;
      // The original steps once per 60fps frame; k scales a step to the real frame time
      step(ms / 16.67);
      draw();
    },

    update(next) {
      const recolour = next.sourcePalette !== undefined && next.sourcePalette !== opts.sourcePalette;
      opts = { ...opts, ...next };
      if (recolour) sprites.clear();
      if (still) draw();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      sprites.clear();
      if (still) draw();
    },

    still() {
      // Reduced motion: a settled pane of beads, nothing running
      still = true;
      for (const b of beads) b.r = Math.min(b.rMax, b.r + b.rMax * 0.5);
      draw();
    },

    dispose() {
      beads = [];
      splashes = [];
      sprites.clear();
      g.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
