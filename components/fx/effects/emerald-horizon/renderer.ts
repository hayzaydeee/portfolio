import type { FxContext, FxInstance, RGB, RoomKey, RoomPalette } from "@/components/fx/runtime/types";
import { bindFullscreenTriangle, createProgram, FULLSCREEN_VERTEX, getGL } from "@/components/fx/runtime/gl";
import { getRoomPalette, mixRGB } from "@/components/fx/runtime/palette";
import { EMERALD_HORIZON_FRAGMENT } from "./shaders";
import type { EmeraldHorizonOptions } from "./meta";

type Colors = { base: RGB; glowA: RGB; glowB: RGB };

const SOURCE_COLORS: Colors = { base: [0, 0.02, 0], glowA: [0.05, 0.8, 0.2], glowB: [0, 1, 0.5] };

function roomColors(p: RoomPalette): Colors {
  return { base: p.base, glowA: p.glow, glowB: mixRGB(p.glow, p.text, 0.4) };
}

/** Exponential approach: frame-rate independent, interruptible, no allocation */
type Smooth = { value: number; target: number; tau: number };
const approach = (s: Smooth, dt: number) => {
  s.value += (s.target - s.value) * (1 - Math.exp(-dt / s.tau));
};

const STILL_TIME_S = 6;
const COLOR_TAU_MS = 180;

export function create(ctx: FxContext, initial: EmeraldHorizonOptions): FxInstance<EmeraldHorizonOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const gl = getGL(canvas);
  if (!gl) throw new Error("WebGL unavailable");

  const program = createProgram(gl, FULLSCREEN_VERTEX, EMERALD_HORIZON_FRAGMENT);
  gl.useProgram(program.program);
  const disposeTriangle = bindFullscreenTriangle(gl, program.program);

  let palette = ctx.palette;
  const baseColors = () => (opts.sourcePalette ? SOURCE_COLORS : roomColors(palette));
  let target = baseColors();
  const current: Colors = { base: [...target.base], glowA: [...target.glowA], glowB: [...target.glowB] };

  const rise: Smooth = { value: opts.rise, target: opts.rise, tau: 260 };
  const lift: Smooth = { value: 0, target: 0, tau: 220 };
  const glowMul: Smooth = { value: 1, target: 1, tau: 220 };
  const waveMul: Smooth = { value: 1, target: 1, tau: 260 };

  let elapsed = 0;
  let still = false;

  const draw = () => {
    gl.uniform1f(program.uniform("u_time"), elapsed);
    gl.uniform1f(program.uniform("u_wave_scale"), opts.waveScale * waveMul.value);
    gl.uniform1f(program.uniform("u_variation"), opts.variation);
    gl.uniform1f(program.uniform("u_glow"), opts.glow * glowMul.value);
    gl.uniform1f(program.uniform("u_vignette"), opts.vignette);
    gl.uniform1f(program.uniform("u_brightness"), opts.brightness);
    gl.uniform1f(program.uniform("u_rise"), rise.value);
    gl.uniform1f(program.uniform("u_lift"), lift.value);
    gl.uniform3fv(program.uniform("u_base"), current.base);
    gl.uniform3fv(program.uniform("u_glow_a"), current.glowA);
    gl.uniform3fv(program.uniform("u_glow_b"), current.glowB);
    gl.uniform1f(program.uniform("u_tonemap"), opts.sourcePalette ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const stepColors = (dt: number) => {
    const k = 1 - Math.exp(-dt / COLOR_TAU_MS);
    for (const key of ["base", "glowA", "glowB"] as const) {
      const c = current[key];
      const t = target[key];
      for (let i = 0; i < 3; i++) c[i] += (t[i] - c[i]) * k;
    }
  };

  const settleAll = () => {
    for (const s of [rise, lift, glowMul, waveMul]) s.value = s.target;
    for (const key of ["base", "glowA", "glowB"] as const) current[key] = [...target[key]];
  };

  const instance: FxInstance<EmeraldHorizonOptions> = {
    resize(w, h, pr) {
      canvas.width = Math.max(1, Math.round(w * pr));
      canvas.height = Math.max(1, Math.round(h * pr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(program.uniform("u_resolution"), canvas.width, canvas.height);
      if (still) draw();
    },

    render(_now, dt) {
      elapsed += (dt / 1000) * opts.speed;
      for (const s of [rise, lift, glowMul, waveMul]) approach(s, dt);
      stepColors(dt);
      draw();
    },

    update(next) {
      const paletteModeChanged = next.sourcePalette !== undefined && next.sourcePalette !== opts.sourcePalette;
      const riseChanged = next.rise !== undefined && next.rise !== opts.rise;
      opts = { ...opts, ...next };
      if (riseChanged) rise.target = opts.rise;
      if (paletteModeChanged) target = baseColors();
      if (still) {
        settleAll();
        draw();
      }
    },

    setPalette(nextPalette) {
      palette = nextPalette;
      target = baseColors();
    },

    still() {
      still = true;
      elapsed = STILL_TIME_S;
      settleAll();
      draw();
    },

    command(name, arg) {
      if (name === "rise") {
        const { to = 1, from } = (arg ?? {}) as { to?: number; from?: number };
        if (from !== undefined) rise.value = from;
        rise.target = to;
      } else if (name === "tint") {
        // arg: a room to lean toward, or null to return home
        const room = arg as RoomKey | null;
        target = room && !opts.sourcePalette ? roomColors(getRoomPalette(room)) : baseColors();
      } else if (name === "slide") {
        const { lift: l, glow, wave } = (arg ?? {}) as { lift?: number; glow?: number; wave?: number };
        if (l !== undefined) lift.target = l;
        if (glow !== undefined) glowMul.target = glow;
        if (wave !== undefined) waveMul.target = wave;
      }
      if (still) {
        settleAll();
        draw();
      }
    },

    dispose() {
      disposeTriangle();
      program.dispose();
    },
  };

  return instance;
}
