import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB } from "@/components/fx/runtime/palette";
import type { GenerativeTreeOptions } from "./meta";

/**
 * Port of ThreeUI's Generative Tree (MIT, Meng To). The original grows a random tree frame by
 * frame, spawning children as each branch passes 65%. Here the whole tree is grown up front
 * from a seed with the same rules, and every branch gets a start time and a duration from
 * that schedule. Growth is then a pure function of one clock, so a section's progress can
 * grow the tree forwards and backwards. Colours come from the room palette, the background
 * is left clear for the horizon underneath, and gradients become pre-tinted sprites.
 */

const TAU = Math.PI * 2;
const SPAWN_AT = 0.65;
/** Growth speed of the original, per 60fps frame */
const GROWTH = 0.006;
const HOLD_S = 6;
const FADE_S = 3;
const WAIT_S = 1.3;
const SEED = 20260806;

type Tip = { ox: number; oy: number; size: number; alpha: number };

type Branch = {
  parent: number;
  depth: number;
  angle: number;
  length: number;
  thickness: number;
  start: number;
  dur: number;
  swayPhase: number;
  swayAmp: number;
  curvature: number;
  colorShift: number;
  hueShift: number;
  seeds: number[];
  tips: Tip[];
  /** Rest-pose end, in tree units, for fitting and anchor choice */
  restX: number;
  restY: number;
  strokes: string[];
  baseAlpha: number;
  // Per frame
  growth: number;
  chain: number;
  x0: number;
  y0: number;
  x2: number;
  y2: number;
};

type Particle = { x: number; y: number; vx: number; vy: number; size: number; alpha: number; phase: number; freq: number; life: number; lifeSpeed: number };

export type TreeAnchors = {
  /** Per label: which side of the trunk, and the height (0 top, 1 bottom) its tip should sit near */
  targets: readonly { side: "left" | "right"; y: number }[];
  /** Receives [x, y, growth] per anchor, in CSS px, after every frame */
  onFrame: (points: Float32Array) => void;
};

const SOURCE_PALETTE: RGB[] = [
  [78, 45, 14],
  [125, 76, 28],
  [172, 118, 50],
  [205, 158, 82],
  [218, 182, 108],
  [215, 195, 135],
].map(([r, g, b]) => [r / 255, g / 255, b / 255] as RGB);

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, t: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};

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

/** A soft round dot, tinted once, so glows cost a drawImage instead of a gradient */
function sprite(rgb: RGB, size = 32): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) return c;
  const [r, gg, b] = rgb.map((v) => Math.round(v * 255));
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgb(${r} ${gg} ${b} / 1)`);
  grad.addColorStop(0.3, `rgb(${r} ${gg} ${b} / 0.5)`);
  grad.addColorStop(1, `rgb(${r} ${gg} ${b} / 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export function create(ctx: FxContext, initial: GenerativeTreeOptions): FxInstance<GenerativeTreeOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");

  let palette = ctx.palette;
  let w = 1;
  let h = 1;
  let ratio = 1;
  let still = false;
  let seed = SEED;
  let branches: Branch[] = [];
  let total = 1;
  let maxDepth = 9;
  let bounds = { minX: -1, maxX: 1, minY: -3 };

  // Clocks: `clock` (ms) drives sway; `grow` (s) is the growth clock the schedule is read at
  let clock = 0;
  let grow = 0;
  let driven = false;
  let target = 0;
  let cycle: "growing" | "holding" | "fading" | "waiting" = "growing";
  let cycleT = 0;
  let treeAlpha = 1;

  let wind = 0;
  let shake = 0;
  let particles: Particle[] = [];
  let stops: RGB[] = SOURCE_PALETTE;
  let glowSprite: HTMLCanvasElement | null = null;
  let tipSprite: HTMLCanvasElement | null = null;
  let pollenSprite: HTMLCanvasElement | null = null;
  let halo: RGB = [0, 0, 0];

  let anchors: TreeAnchors | null = null;
  let anchorIdx: number[] = [];
  let anchorOut = new Float32Array(0);
  let shownGrowth = -1;

  const colorFor = (depth: number, hueShift: number): RGB => {
    const t = depth / maxDepth;
    const idx = t * (stops.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(stops.length - 1, i0 + 1);
    const [r, gg, b] = mixRGB(stops[i0], stops[i1], idx - i0);
    // Per-branch drift, stronger toward the canopy
    const k = (t * t * 22) / 255;
    return [r + hueShift * k, gg - hueShift * k * 0.5, b - hueShift * k * 0.15];
  };

  const recolour = () => {
    if (opts.sourcePalette) {
      stops = SOURCE_PALETTE;
      halo = [60 / 255, 36 / 255, 12 / 255];
    } else {
      const { deep, warm, accent, glow, text } = palette;
      stops = [
        mixRGB(deep, warm, 0.3),
        mixRGB(deep, warm, 0.6),
        mixRGB(accent, warm, 0.3),
        mixRGB(accent, glow, 0.5),
        glow,
        mixRGB(glow, text, 0.45),
      ];
      halo = accent;
    }
    glowSprite = sprite(stops[4]);
    tipSprite = sprite(stops[5]);
    pollenSprite = sprite(opts.sourcePalette ? [230 / 255, 200 / 255, 155 / 255] : mixRGB(palette.warm, palette.glow, 0.5));

    for (const b of branches) {
      const col = colorFor(b.depth, b.hueShift);
      const count = b.depth < 3 ? 5 : b.depth < 6 ? 3 : 2;
      b.strokes = [];
      for (let s = 0; s < count; s++) {
        const norm = count > 1 ? s / (count - 1) - 0.5 : 0;
        const shift = (norm * 22 + b.colorShift * 0.3) / 255;
        const core = s === Math.floor(count / 2);
        const a = b.baseAlpha * (core ? 1 : 0.5);
        const [r, gg, bb] = [col[0] + shift, col[1] + shift * 0.65, col[2] + shift * 0.4].map((v) => Math.round(clamp01(v) * 255));
        b.strokes.push(`rgb(${r} ${gg} ${bb} / ${a.toFixed(3)})`);
      }
    }
  };

  const build = () => {
    const r = rng(seed);
    const rand = (lo: number, hi: number) => lo + (hi - lo) * r();
    maxDepth = Math.round(opts.depth);
    const out: Branch[] = [];
    const seeds = () => [rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(-1, 1)];
    const make = (p: Partial<Branch> & Pick<Branch, "parent" | "depth" | "angle" | "length" | "thickness" | "start" | "dur">): Branch => ({
      swayPhase: rand(0, TAU),
      swayAmp: 0.0008,
      curvature: 0,
      colorShift: 0,
      hueShift: 0,
      seeds: seeds(),
      tips: [],
      restX: 0,
      restY: 0,
      strokes: [],
      baseAlpha: 1,
      growth: 0,
      chain: 0,
      x0: 0,
      y0: 0,
      x2: 0,
      y2: 0,
      ...p,
    });

    out.push(
      make({
        parent: -1,
        depth: 0,
        angle: -Math.PI / 2 + rand(-0.05, 0.05),
        length: 1,
        thickness: 0.075,
        start: 0,
        dur: 1 / (GROWTH * 60 * rand(0.9, 1.1)),
        curvature: rand(-0.015, 0.015),
        colorShift: rand(-8, 8),
      })
    );

    // Breadth-first, so parents always precede children (the per-frame pass relies on it)
    for (let i = 0; i < out.length; i++) {
      const parent = out[i];
      if (parent.depth >= maxDepth) continue;
      let n: number;
      if (parent.depth < 1) n = 2 + (r() < 0.35 ? 1 : 0);
      else if (parent.depth < 3) n = 2 + (r() < 0.4 ? 1 : 0);
      else n = r() < 0.25 ? 3 : 2;
      // Progressive pruning keeps the canopy airy
      const prune = parent.depth <= 3 ? 0 : parent.depth <= 5 ? 0.1 : parent.depth <= 7 ? 0.22 : 0.35;
      if (r() < prune) n = Math.max(1, n - 1);
      const spread = parent.depth < 2 ? rand(0.32, 0.48) : rand(0.38, 0.6);

      for (let c = 0; c < n; c++) {
        const offset = n === 1 ? rand(-0.25, 0.25) : n === 2 ? (c === 0 ? -1 : 1) * rand(0.18, spread) : (c - 1) * spread + rand(-0.1, 0.1);
        const depth = parent.depth + 1;
        const tips: Tip[] = [];
        if (depth >= maxDepth) {
          const count = r() < 0.4 ? 2 : 1;
          for (let d = 0; d < count; d++) tips.push({ ox: rand(-2, 2), oy: rand(-2, 2), size: rand(0.8, 1.6), alpha: rand(0.08, 0.2) });
        }
        const t = depth / maxDepth;
        out.push(
          make({
            parent: i,
            depth,
            angle: parent.angle + offset,
            length: parent.length * rand(0.58, 0.76),
            thickness: Math.max(0.004, parent.thickness * rand(0.48, 0.67)),
            start: parent.start + parent.dur * SPAWN_AT,
            dur: 1 / (GROWTH * 60 * rand(1, 1.5) * (1 + parent.depth * 0.1)),
            swayAmp: 0.0018 * depth * rand(0.7, 1.3),
            curvature: rand(-0.04, 0.04) * (1 + parent.depth * 0.12),
            colorShift: rand(-12, 12),
            hueShift: Math.max(-1, Math.min(1, parent.hueShift + rand(-0.35, 0.35))),
            tips,
            baseAlpha: depth <= 1 ? 0.95 : depth <= 5 ? lerp(0.92, 0.7, t) : lerp(0.7, 0.35, (t - 0.5) * 2),
          })
        );
      }
    }

    // Rest pose and bounds, in tree units with the base at the origin
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    total = 0;
    for (const b of out) {
      const x0 = b.parent < 0 ? 0 : out[b.parent].restX;
      const y0 = b.parent < 0 ? 0 : out[b.parent].restY;
      const off = b.curvature * b.length * 0.98;
      b.restX = x0 + Math.cos(b.angle) * b.length - Math.sin(b.angle) * off;
      b.restY = y0 + Math.sin(b.angle) * b.length + Math.cos(b.angle) * off;
      minX = Math.min(minX, b.restX);
      maxX = Math.max(maxX, b.restX);
      minY = Math.min(minY, b.restY);
      total = Math.max(total, b.start + b.dur);
    }
    bounds = { minX, maxX, minY };
    branches = out;
    pickAnchors();
    recolour();
    particles = Array.from({ length: Math.round(opts.particles) }, () => particle(true));
  };

  /**
   * Label i hangs off a tip one generation further up than label i - 1 (so labels arrive in
   * order as the tree grows), on its side of the trunk, as near its target height as the
   * tree allows. Depends on the fit, so it reruns on resize.
   */
  const pickAnchors = () => {
    if (!anchors) return;
    const { k, baseY } = fit();
    const n = anchors.targets.length;
    const used = new Set<number>();
    anchorIdx = anchors.targets.map(({ side, y }, i) => {
      const depth = Math.min(maxDepth - 1, 1 + Math.round((i * (maxDepth - 3)) / Math.max(1, n - 1)));
      const want = y * h;
      let best = -1;
      let bestScore = Infinity;
      for (let j = 0; j < branches.length; j++) {
        const b = branches[j];
        if (b.depth !== depth || used.has(j)) continue;
        const wrongSide = side === "left" ? b.restX > 0 : b.restX < 0;
        // Off-side tips only if the side has none; outer tips win ties so leaders stay short
        const score = Math.abs(baseY + b.restY * k - want) + (wrongSide ? 1e6 : 0) - Math.abs(b.restX) * k * 0.25;
        if (score < bestScore) {
          bestScore = score;
          best = j;
        }
      }
      if (best >= 0) used.add(best);
      return best;
    });
    anchorOut = new Float32Array(n * 3);
  };

  const particle = (anywhere: boolean): Particle => ({
    x: w * (0.15 + Math.random() * 0.7),
    y: anywhere ? h * (0.1 + Math.random() * 0.8) : h * (0.5 + Math.random() * 0.5),
    vx: (Math.random() - 0.5) * 0.24,
    vy: -0.06 - Math.random() * 0.29,
    size: 0.6 + Math.random() * 1.6,
    alpha: 0.04 + Math.random() * 0.16,
    phase: Math.random() * TAU,
    freq: 0.0004 + Math.random() * 0.0011,
    life: anywhere ? Math.random() : 0,
    lifeSpeed: 0.0006 + Math.random() * 0.0019,
  });

  const fit = () => {
    const treeW = Math.max(0.5, bounds.maxX - bounds.minX);
    const treeH = Math.max(0.5, -bounds.minY);
    // Narrow enough to leave a label column either side
    const k = Math.min((h * 0.9) / treeH, (w * 0.46) / treeW);
    return { k, baseX: w / 2 - ((bounds.minX + bounds.maxX) / 2) * k, baseY: h - 2 };
  };

  const draw = (dt: number) => {
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, h);
    const { k, baseX, baseY } = fit();
    const t = clock;
    const sway = opts.sway;

    // Wind from the pointer, eased; deeper branches bend more
    const p = ctx.pointer();
    const windTarget = !still && p.inside ? Math.max(-1, Math.min(1, (p.x - w / 2) / (w / 2))) : 0;
    wind += (windTarget - wind) * Math.min(1, dt / 400);
    shake = shake > 0.01 ? shake * Math.pow(0.95, dt / 16.7) : 0;

    // Canopy halo behind the crown
    if (treeAlpha > 0.05) {
      const cx = baseX + ((bounds.minX + bounds.maxX) / 2) * k;
      const cy = baseY + bounds.minY * k * 0.62;
      const r = -bounds.minY * k * 0.62;
      const [hr, hg, hb] = halo.map((v) => Math.round(v * 255));
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgb(${hr} ${hg} ${hb} / ${0.16 * treeAlpha * smoothstep(0.3, 1, grow / total)})`);
      grad.addColorStop(1, `rgb(${hr} ${hg} ${hb} / 0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }

    g.globalAlpha = treeAlpha;
    g.lineCap = "round";
    let shown = 0;
    for (const b of branches) {
      const parent = b.parent < 0 ? null : branches[b.parent];
      const own =
        Math.sin(t * 0.0005 + b.swayPhase) * b.swayAmp +
        Math.sin(t * 0.0003 + b.swayPhase * 1.7) * b.swayAmp * 0.6 +
        Math.sin(t * 0.00012 + b.swayPhase * 0.4) * b.swayAmp * 0.35;
      b.chain = (parent ? parent.chain : 0) + own * sway;
      b.growth = clamp01((grow - b.start) / b.dur);
      b.x0 = parent ? parent.x2 : baseX;
      b.y0 = parent ? parent.y2 : baseY;
      const chainLen = b.depth + 1;
      let angle = b.angle + b.chain + wind * 0.04 * chainLen * sway;
      if (shake > 0.01) angle += Math.sin(t * 0.015 + b.swayPhase * 3) * shake * 0.06 * chainLen;

      const prog = easeOutCubic(b.growth);
      const len = b.length * k * prog;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const px = -sin;
      const py = cos;
      const curve = b.curvature * len * 1.4;
      b.x2 = b.x0 + cos * len + px * curve * 0.7;
      b.y2 = b.y0 + sin * len + py * curve * 0.7;
      if (b.growth <= 0) continue;
      shown++;

      const c1x = b.x0 + cos * len * 0.33 + px * curve * 0.4;
      const c1y = b.y0 + sin * len * 0.33 + py * curve * 0.4;
      const c2x = b.x0 + cos * len * 0.66 + px * curve * 0.85;
      const c2y = b.y0 + sin * len * 0.66 + py * curve * 0.85;
      const thick = b.thickness * k;
      const taper = lerp(thick, thick * 0.3, prog);
      const count = b.strokes.length;
      for (let s = 0; s < count; s++) {
        const norm = count > 1 ? s / (count - 1) - 0.5 : 0;
        const off = norm * thick * 0.35 + (b.seeds[s] ?? 0) * thick * 0.08;
        const ox = px * off;
        const oy = py * off;
        const core = s === Math.floor(count / 2);
        g.beginPath();
        g.moveTo(b.x0 + ox, b.y0 + oy);
        g.bezierCurveTo(c1x + ox, c1y + oy, c2x + ox, c2y + oy, b.x2 + ox, b.y2 + oy);
        g.strokeStyle = b.strokes[s];
        g.lineWidth = Math.max(0.4, taper * (core ? 1 : lerp(0.65, 0.45, Math.abs(norm))));
        g.stroke();
      }

      // Soft light on the mid canopy, then luminous tips
      if (glowSprite && b.depth >= 4 && b.depth < maxDepth - 1 && b.growth > 0.8) {
        const a = smoothstep(0.8, 1, b.growth) * 0.1 * (b.depth / maxDepth);
        const r = Math.max(4, thick * 2);
        g.globalAlpha = treeAlpha * a;
        g.drawImage(glowSprite, b.x2 - r, b.y2 - r, r * 2, r * 2);
        g.globalAlpha = treeAlpha;
      }
      if (tipSprite && b.tips.length && b.growth > 0.92) {
        const fade = smoothstep(0.92, 1, b.growth);
        for (const d of b.tips) {
          const r = d.size * 2.4;
          g.globalAlpha = treeAlpha * Math.min(1, fade * d.alpha * 3);
          g.drawImage(tipSprite, b.x2 + d.ox - r, b.y2 + d.oy - r, r * 2, r * 2);
        }
        g.globalAlpha = treeAlpha;
      }
    }

    // Pollen
    if (pollenSprite && particles.length) {
      for (let i = 0; i < particles.length; i++) {
        const q = particles[i];
        if (!still) {
          q.x += (q.vx + Math.sin(t * q.freq + q.phase) * 0.25) * (dt / 16.7);
          q.y += q.vy * (dt / 16.7);
          q.life += q.lifeSpeed * (dt / 16.7);
          if (q.life > 1 || q.y < -10 || q.x < -10 || q.x > w + 10) particles[i] = particle(false);
        }
        const fade = q.life < 0.15 ? q.life / 0.15 : q.life > 0.8 ? (1 - q.life) / 0.2 : 1;
        const a = q.alpha * fade * treeAlpha * smoothstep(0, 0.4, grow / total);
        if (a < 0.004) continue;
        const s = q.size * 3;
        g.globalAlpha = a;
        g.drawImage(pollenSprite, q.x - s, q.y - s, s * 2, s * 2);
      }
    }
    g.globalAlpha = 1;

    // Marked for the verification suite, in twentieths so it writes rarely
    const step = Math.round((grow / total) * 20) / 20;
    if (step !== shownGrowth) {
      shownGrowth = step;
      canvas.dataset.growth = step.toFixed(2);
      canvas.dataset.branches = String(shown);
    }

    if (anchors && anchorIdx.length) {
      anchorIdx.forEach((j, i) => {
        const b = branches[j];
        anchorOut[i * 3] = b ? b.x2 : 0;
        anchorOut[i * 3 + 1] = b ? b.y2 : 0;
        anchorOut[i * 3 + 2] = b ? b.growth * treeAlpha : 0;
      });
      anchors.onFrame(anchorOut);
    }
  };

  const advance = (dt: number) => {
    const s = dt / 1000;
    if (driven) {
      // Ease toward the commanded clock so a scroll jump grows rather than snaps
      grow += (target - grow) * Math.min(1, dt / 220);
      treeAlpha = 1;
      return;
    }
    cycleT += s;
    if (cycle === "growing") {
      grow = Math.min(total, grow + s * opts.speed);
      if (grow >= total) {
        cycle = "holding";
        cycleT = 0;
      }
    } else if (cycle === "holding" && cycleT >= HOLD_S) {
      cycle = "fading";
      cycleT = 0;
    } else if (cycle === "fading") {
      treeAlpha = Math.max(0, 1 - cycleT / FADE_S);
      if (cycleT >= FADE_S) {
        cycle = "waiting";
        cycleT = 0;
      }
    } else if (cycle === "waiting" && cycleT >= WAIT_S) {
      seed = (seed * 16807) % 2147483647;
      build();
      grow = 0;
      treeAlpha = 1;
      cycle = "growing";
      cycleT = 0;
    }
  };

  build();

  return {
    resize(cssW, cssH, pixelRatio) {
      const first = w === 1 && h === 1;
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      ratio = pixelRatio;
      canvas.width = Math.max(1, Math.round(w * ratio));
      canvas.height = Math.max(1, Math.round(h * ratio));
      if (first) particles = particles.map(() => particle(true));
      pickAnchors();
      if (still) draw(0);
    },

    render(_now, dt) {
      const step = Math.min(64, dt);
      // Sway runs on accumulated time, so a pause resumes where it left off instead of jumping
      clock += step;
      advance(step);
      draw(step);
    },

    update(next) {
      const rebuild =
        (next.depth !== undefined && Math.round(next.depth) !== Math.round(opts.depth)) ||
        (next.particles !== undefined && Math.round(next.particles) !== Math.round(opts.particles));
      opts = { ...opts, ...next };
      if (rebuild) build();
      else recolour();
      if (still) draw(0);
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      if (still) draw(0);
    },

    still() {
      // Reduced motion: the grown tree, standing still
      still = true;
      clock = 0;
      grow = total;
      target = total;
      treeAlpha = 1;
      draw(0);
    },

    command(name, arg) {
      if (name === "progress") {
        driven = true;
        target = clamp01(Number(arg) || 0) * total;
        if (still) return;
      } else if (name === "anchors") {
        anchors = (arg as TreeAnchors | null) ?? null;
        pickAnchors();
      } else if (name === "shake" || name === "click") {
        shake = 1;
      }
      if (still) draw(0);
    },

    dispose() {
      anchors = null;
      branches = [];
      particles = [];
      g.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
