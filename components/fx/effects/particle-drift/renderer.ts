import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { resolveToken, rgbToCss } from "@/components/fx/runtime/palette";
import { loadFont, resolveFontFamily } from "@/components/fx/runtime/fonts";
import { seeded } from "@/components/fx/runtime/random";
import { DRIFT_DEFAULT_GLYPHS, type ParticleDriftOptions } from "./meta";

/**
 * Port of ThreeUI's Particle Drift (MIT, Meng To): ninety characters falling slowly, twenty-
 * five beams rising fast, a faint line between any two characters closer than 120 px, and the
 * pointer catching every character within 180 px (it lights, changes, and reaches a line to
 * the pointer). Characters away from the pointer change now and then on their own.
 *
 * Changed for the notebook: it draws dark on the room's paper instead of light on black, the
 * beams and caught characters take the journal's colour, the characters come from the page
 * (an entry's own letters, or a code set for the build log) in the room's mono or serif, the
 * counts scale with the plate's area, and motion runs on frame time instead of per frame.
 */

const NEAR = 120;
const CATCH = 180;
const BASE_AREA = 900 * 650;

type Node = { x: number; y: number; vy: number; ch: string };
type Beam = { x: number; y: number; length: number; speed: number; opacity: number };

export function create(ctx: FxContext, initial: ParticleDriftOptions): FxInstance<ParticleDriftOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");

  let w = 1;
  let h = 1;
  let ratio = 1;
  let reduced = ctx.reducedMotion;
  let nodes: Node[] = [];
  let beams: Beam[] = [];
  let chars: string[] = [];
  let accent: RGB = [0.3, 0.42, 0.3];
  let family = "monospace";
  const rand = seeded(20261012);

  const pick = () => chars[Math.floor(rand() * chars.length)] ?? "·";

  const setChars = () => {
    const set = Array.from(new Set(Array.from(opts.glyphs || DRIFT_DEFAULT_GLYPHS).filter((c) => c.trim())));
    chars = set.length ? set : Array.from(DRIFT_DEFAULT_GLYPHS);
  };

  const populate = () => {
    const scale = ((w * h) / BASE_AREA) * opts.density;
    const nCount = Math.max(16, Math.min(140, Math.round(90 * scale)));
    const bCount = Math.max(4, Math.min(40, Math.round(25 * scale)));
    nodes = Array.from({ length: nCount }, () => ({ x: rand() * w, y: rand() * h, vy: rand() * 0.4 + 0.1, ch: pick() }));
    beams = Array.from({ length: bCount }, () => ({
      x: rand() * w,
      y: rand() * h,
      length: rand() * 100 + 50,
      speed: rand() * 6 + 3,
      opacity: rand() * 0.5 + 0.3,
    }));
  };

  const draw = (step: number) => {
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, h);
    const ink = palette.text;
    const pointer = ctx.pointer();
    const px = pointer.inside ? pointer.x : -1e4;
    const py = pointer.inside ? pointer.y : -1e4;
    const move = step * opts.speed;

    // Beams rising fast, in the journal's colour
    if (opts.beams) {
      g.lineWidth = 1.5;
      for (const b of beams) {
        b.y -= b.speed * move;
        if (b.y + b.length < 0) {
          b.y = h + 100;
          b.x = rand() * w;
        }
        const gr = g.createLinearGradient(b.x, b.y, b.x, b.y + b.length);
        gr.addColorStop(0, rgbToCss(accent, b.opacity * 0.55));
        gr.addColorStop(1, rgbToCss(accent, 0));
        g.strokeStyle = gr;
        g.beginPath();
        g.moveTo(b.x, b.y);
        g.lineTo(b.x, b.y + b.length);
        g.stroke();
      }
    }

    // Faint lines between characters passing close
    g.lineWidth = 0.5;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const c = nodes[j];
        const d = Math.hypot(a.x - c.x, a.y - c.y);
        if (d < NEAR) {
          g.strokeStyle = rgbToCss(ink, 0.12 * (1 - d / NEAR));
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.lineTo(c.x, c.y);
          g.stroke();
        }
      }
    }

    g.font = `13px ${family}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    // The original changed a stray character 2% of frames at 60 fps; scaled to this frame's length
    const stray = 0.02 * step;
    for (const n of nodes) {
      n.y += n.vy * move;
      if (n.y > h + 20) {
        n.y = -20;
        n.x = rand() * w;
      }
      const dist = Math.hypot(px - n.x, py - n.y);
      const caught = dist < CATCH;
      if ((caught && move > 0) || rand() < stray) n.ch = pick();
      if (caught) {
        g.strokeStyle = rgbToCss(accent, 0.5 * (1 - dist / CATCH));
        g.beginPath();
        g.moveTo(n.x, n.y);
        g.lineTo(px, py);
        g.stroke();
      }
      g.fillStyle = caught ? rgbToCss(accent, 0.95) : rgbToCss(ink, 0.32);
      g.fillText(n.ch, n.x, n.y);
    }
  };

  const recolour = () => {
    accent = resolveToken(opts.ink || "notebook-text");
  };

  const ready = (async () => {
    const cssVar = opts.face === "serif" ? "--font-serif" : "--font-mono";
    family = resolveFontFamily(cssVar);
    await loadFont(400, 13, family);
  })();

  setChars();
  recolour();

  return {
    ready,

    resize(cssW, cssH, pr) {
      const repopulate = Math.abs(cssW - w) > 1 || Math.abs(cssH - h) > 1;
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      ratio = pr;
      canvas.width = Math.max(1, Math.round(w * pr));
      canvas.height = Math.max(1, Math.round(h * pr));
      if (repopulate || !nodes.length) populate();
      draw(0);
    },

    render(_now, dt) {
      if (reduced) return;
      draw(Math.min(dt, 64) / (1000 / 60));
    },

    update(next) {
      const before = `${opts.glyphs}|${opts.density}|${opts.face}`;
      opts = { ...opts, ...next };
      recolour();
      if (`${opts.glyphs}|${opts.density}|${opts.face}` !== before) {
        family = resolveFontFamily(opts.face === "serif" ? "--font-serif" : "--font-mono");
        setChars();
        populate();
      }
      if (reduced) draw(0);
    },

    setPalette(p: RoomPalette) {
      palette = p;
      recolour();
      if (reduced) draw(0);
    },

    still() {
      reduced = true;
      draw(0);
    },

    dispose() {
      nodes = [];
      beams = [];
    },
  };
}
