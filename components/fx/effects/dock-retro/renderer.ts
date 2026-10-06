import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { bindFullscreenTriangle, createProgram, FULLSCREEN_VERTEX, getGL } from "@/components/fx/runtime/gl";
import { mixRGB } from "@/components/fx/runtime/palette";
import { DOCK_RETRO_FRAGMENT } from "./shaders";
import type { DockRetroOptions } from "./meta";

/** The original's dusk ramp, kept for the "original colours" fidelity check */
const SOURCE_STOPS: RGB[] = [
  [0.043, 0.035, 0.109],
  [0.106, 0.063, 0.22],
  [0.212, 0.09, 0.325],
  [0.396, 0.129, 0.376],
  [0.612, 0.18, 0.376],
  [0.827, 0.298, 0.325],
  [0.945, 0.502, 0.286],
  [0.988, 0.784, 0.494],
];

const luma = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Eight room colours ordered dark to light, so quantised steps read as one ramp */
function roomStops(p: RoomPalette): RGB[] {
  return [
    p.base,
    p.surface,
    p.deep,
    p.accent,
    p.glow,
    mixRGB(p.glow, p.warm, 0.5),
    p.warm,
    mixRGB(p.warm, p.text, 0.5),
  ].sort((a, b) => luma(a) - luma(b));
}

export function create(ctx: FxContext, initial: DockRetroOptions): FxInstance<DockRetroOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const gl = getGL(canvas);
  if (!gl) throw new Error("WebGL unavailable");

  // Upscaled with nearest-neighbour so each buffer pixel stays a crisp block
  canvas.style.imageRendering = "pixelated";

  const program = createProgram(gl, FULLSCREEN_VERTEX, DOCK_RETRO_FRAGMENT);
  gl.useProgram(program.program);
  const disposeTriangle = bindFullscreenTriangle(gl, program.program);

  let palette = ctx.palette;
  let elapsed = 0;
  let still = false;
  let size = { w: 1, h: 1 };

  const uploadStops = () => {
    const stops = opts.sourcePalette ? SOURCE_STOPS : roomStops(palette);
    gl.uniform3fv(program.uniform("uStops"), new Float32Array(stops.flat()));
  };

  const fit = () => {
    const px = Math.max(1, Math.round(opts.pixelSize));
    const bw = Math.max(2, Math.round(size.w / px));
    const bh = Math.max(2, Math.round(size.h / px));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    gl.viewport(0, 0, bw, bh);
    gl.uniform2f(program.uniform("uRes"), bw, bh);
  };

  const draw = () => {
    gl.uniform1f(program.uniform("uTime"), elapsed);
    gl.uniform1f(program.uniform("uNoise"), opts.noise);
    gl.uniform1f(program.uniform("uLevels"), opts.levels);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  uploadStops();

  return {
    // Pixel ratio is ignored on purpose: the buffer is sized in blocks, not device pixels
    resize(w, h) {
      size = { w, h };
      fit();
      if (still) draw();
    },

    render(_now, dt) {
      elapsed += Math.min(96, dt) * 0.001 * opts.speed;
      draw();
    },

    update(next) {
      const restop = next.sourcePalette !== undefined && next.sourcePalette !== opts.sourcePalette;
      const refit = next.pixelSize !== undefined && next.pixelSize !== opts.pixelSize;
      opts = { ...opts, ...next };
      if (restop) uploadStops();
      if (refit) fit();
      if (still) draw();
    },

    setPalette(next) {
      palette = next;
      uploadStops();
    },

    still() {
      still = true;
      elapsed = 8;
      draw();
    },

    dispose() {
      disposeTriangle();
      program.dispose();
    },
  };
}
