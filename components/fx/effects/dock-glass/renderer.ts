import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { bindFullscreenTriangle, createProgram, FULLSCREEN_VERTEX, getGL } from "@/components/fx/runtime/gl";
import { mixRGB } from "@/components/fx/runtime/palette";
import { DOCK_GLASS_FRAGMENT } from "./shaders";
import type { DockGlassOptions } from "./meta";

type Blooms = { base: RGB; a: RGB; b: RGB; c: RGB; d: RGB; p: RGB };

const SOURCE: Blooms = {
  base: [0.085, 0.095, 0.125],
  a: [0.24, 0.42, 0.96],
  b: [0.66, 0.3, 0.88],
  c: [0.14, 0.68, 0.7],
  d: [0.98, 0.6, 0.4],
  p: [0.74, 0.78, 0.96],
};

const scale = ([r, g, b]: RGB, k: number): RGB => [r * k, g * k, b * k];

/**
 * Room blooms sit well below the original's: its plate is a showcase backdrop, ours sits
 * behind nav labels. The base is still lifted off the room's near-black, since the original
 * warns that refraction turns black regions into dark holes.
 */
function roomBlooms(p: RoomPalette): Blooms {
  return {
    base: mixRGB(mixRGB(p.base, p.deep, 0.7), p.glow, 0.06),
    a: scale(p.accent, 0.9),
    b: scale(p.glow, 0.5),
    c: scale(p.warm, 0.32),
    d: scale(mixRGB(p.text, p.glow, 0.5), 0.22),
    p: scale(p.text, 0.28),
  };
}

const MAX_BEADS = 12;
const LARGE = 3;

type Bead = { x: number; y: number; r: number; haze: number; bob: number; phase: number };

/** The original's LCG and seed, so the arrangement matches across visits */
function lcg(seed: number) {
  let h = seed;
  return () => {
    h = (h * 1664525 + 1013904223) % 4294967296;
    return h / 4294967296;
  };
}

function layout(): Bead[] {
  const rand = lcg(20260826);
  const beads: Bead[] = [];
  for (let i = 0; i < MAX_BEADS; i++) {
    const large = i < LARGE;
    const r = large ? 0.2 + rand() * 0.14 : 0.06 + rand() * 0.07;
    let x = 0;
    let y = 0;
    // Large beads keep clear of each other; small ones may tuck behind
    for (let tries = 0; tries < 48; tries++) {
      x = 0.1 + rand() * 0.8;
      y = 0.08 + rand() * 0.84;
      if (!large || beads.every((b) => Math.hypot(b.x - x, b.y - y) > (b.r + r) * 0.9)) break;
    }
    beads.push({ x, y, r, haze: large ? 0 : 0.55 + rand() * 0.4, bob: 0.02 + rand() * 0.05, phase: rand() * 6.28 });
  }
  return beads;
}

export function create(ctx: FxContext, initial: DockGlassOptions): FxInstance<DockGlassOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const gl = getGL(canvas);
  if (!gl) throw new Error("WebGL unavailable");

  const program = createProgram(gl, FULLSCREEN_VERTEX, DOCK_GLASS_FRAGMENT);
  gl.useProgram(program.program);
  const disposeTriangle = bindFullscreenTriangle(gl, program.program);

  const beads = layout();
  const packed = new Float32Array(MAX_BEADS * 4);
  let palette = ctx.palette;
  let elapsed = 0;
  let still = false;
  let size = { w: 1, h: 1, pr: 1 };
  const pointer = { x: 0, y: 0 };

  const uploadColors = () => {
    const c = opts.sourcePalette ? SOURCE : roomBlooms(palette);
    gl.uniform3fv(program.uniform("uBase"), c.base);
    gl.uniform3fv(program.uniform("uBloomA"), c.a);
    gl.uniform3fv(program.uniform("uBloomB"), c.b);
    gl.uniform3fv(program.uniform("uBloomC"), c.c);
    gl.uniform3fv(program.uniform("uBloomD"), c.d);
    gl.uniform3fv(program.uniform("uBloomP"), c.p);
  };

  const draw = () => {
    const { w, h, pr } = size;
    const unit = Math.min(w, h);
    const count = Math.max(LARGE, Math.min(MAX_BEADS, Math.round(opts.count)));
    const t = elapsed * opts.drift;
    const chosen = beads.slice(0, count).sort((a, b) => a.r - b.r);
    chosen.forEach((b, i) => {
      // Nearer (larger) beads swing further with the pointer, as the original's group tilt does
      const depth = b.r * 2.4;
      const x = b.x * w + (Math.sin(t * 0.21 + b.phase) * b.bob * 0.9 + pointer.x * 0.04 * depth) * unit;
      const y = b.y * h + (Math.cos(t * 0.27 + b.phase * 1.3) * b.bob - pointer.y * 0.04 * depth) * unit;
      packed[i * 4] = x * pr;
      packed[i * 4 + 1] = (h - y) * pr;
      packed[i * 4 + 2] = b.r * unit * pr;
      packed[i * 4 + 3] = b.haze;
    });
    gl.uniform4fv(program.uniform("uBeads"), packed);
    gl.uniform1f(program.uniform("uCount"), count);
    gl.uniform1f(program.uniform("uTime"), elapsed);
    gl.uniform2f(program.uniform("uPointer"), pointer.x, pointer.y);
    gl.uniform1f(program.uniform("uThickness"), opts.thickness);
    gl.uniform1f(program.uniform("uDispersion"), opts.dispersion);
    gl.uniform1f(program.uniform("uSpecular"), opts.specular);
    gl.uniform1f(program.uniform("uRim"), opts.rim);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  uploadColors();

  return {
    resize(w, h, pr) {
      size = { w: Math.max(1, w), h: Math.max(1, h), pr };
      canvas.width = Math.max(1, Math.round(size.w * pr));
      canvas.height = Math.max(1, Math.round(size.h * pr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(program.uniform("uRes"), canvas.width, canvas.height);
      if (still) draw();
    },

    render(_now, dt) {
      elapsed += Math.min(96, dt) / 1000;
      const ptr = ctx.pointer();
      const tx = ptr.seen && ptr.inside ? (ptr.x / size.w) * 2 - 1 : 0;
      const ty = ptr.seen && ptr.inside ? 1 - (ptr.y / size.h) * 2 : 0;
      const k = 1 - Math.pow(1 - 0.045, dt / 16.67);
      pointer.x += (tx - pointer.x) * k;
      pointer.y += (ty - pointer.y) * k;
      draw();
    },

    update(next) {
      const recolor = next.sourcePalette !== undefined && next.sourcePalette !== opts.sourcePalette;
      opts = { ...opts, ...next };
      if (recolor) uploadColors();
      if (still) draw();
    },

    setPalette(next) {
      palette = next;
      uploadColors();
    },

    still() {
      still = true;
      elapsed = 5;
      draw();
    },

    dispose() {
      disposeTriangle();
      program.dispose();
    },
  };
}
