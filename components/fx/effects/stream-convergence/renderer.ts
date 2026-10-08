import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { bindFullscreenTriangle, createProgram, FULLSCREEN_VERTEX, getGL } from "@/components/fx/runtime/gl";
import { mixRGB } from "@/components/fx/runtime/palette";
import type { StreamConvergenceOptions } from "./meta";

/**
 * Port of ThreeUI's Stream Convergence (MIT, Meng To). The strands, their wave and the
 * vignette are the original's; it summed each strand into one colour channel for its
 * violet-indigo, so here each strand carries a room colour instead. It draws light only,
 * premultiplied, so the room's backdrop shows through everywhere it is dark.
 */

const FRAGMENT = `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform float uFidelity;
uniform float uIntensity;
uniform vec3 uStrand0;
uniform vec3 uStrand1;
uniform vec3 uStrand2;

mat2 rotate2d(float a){ return mat2(cos(a), -sin(a), sin(a), cos(a)); }

void main(){
  vec2 vUv = gl_FragCoord.xy / uRes;
  vec2 p = vUv * 2.0 - 1.0;
  p.x *= uRes.x / uRes.y;
  p = rotate2d(0.55) * p;

  vec3 color = vec3(0.0);
  float spread = 0.06 * (0.3 + uFidelity * 0.7);
  for (int i = 0; i < 3; i++) {
    float offset = float(1 - i) * spread;
    float y = p.y + offset + (sin(p.x * 2.5 - uTime * 1.5) * 0.12);
    float wave = smoothstep(0.85, 0.99, sin(y * 6.0 + uTime * 2.0) * 0.5 + 0.5);
    if (i == 0) color += uStrand0 * wave;
    if (i == 1) color += uStrand1 * wave;
    if (i == 2) color += uStrand2 * wave;
  }

  float vignette = exp(-length(vUv * 2.0 - 1.0) * 0.8);
  color *= vignette * uIntensity;
  // fade to nothing at the edges, so the band has no visible bounds
  vec2 e = min(vUv, 1.0 - vUv);
  color *= smoothstep(0.0, 0.18, min(e.x, e.y * 1.6));
  color = min(color, vec3(1.0));
  gl_FragColor = vec4(color, max(color.r, max(color.g, color.b)));
}`;

// The original's channel weights, as strands of pure red, green and blue
const SOURCE: [RGB, RGB, RGB] = [
  [1.2, 0, 0],
  [0, 0.5, 0],
  [0, 0, 1.8],
];

const scale = ([r, g, b]: RGB, k: number): RGB => [r * k, g * k, b * k];

export function create(ctx: FxContext, initial: StreamConvergenceOptions): FxInstance<StreamConvergenceOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  const gl = getGL(canvas, { alpha: true, premultipliedAlpha: true });
  if (!gl) throw new Error("WebGL unavailable");
  const program = createProgram(gl, FULLSCREEN_VERTEX, FRAGMENT);
  gl.useProgram(program.program);
  const disposeTriangle = bindFullscreenTriangle(gl, program.program);

  let time = 0;
  let still = false;

  const recolour = () => {
    const p = palette;
    const strands: [RGB, RGB, RGB] = opts.sourcePalette
      ? SOURCE
      : [scale(p.accent, 1.5), scale(mixRGB(p.glow, p.text, 0.25), 0.9), scale(mixRGB(p.warm, p.glow, 0.35), 1.2)];
    gl.uniform3fv(program.uniform("uStrand0"), strands[0]);
    gl.uniform3fv(program.uniform("uStrand1"), strands[1]);
    gl.uniform3fv(program.uniform("uStrand2"), strands[2]);
  };
  recolour();

  const draw = () => {
    gl.uniform1f(program.uniform("uTime"), time);
    gl.uniform1f(program.uniform("uFidelity"), opts.fidelity);
    gl.uniform1f(program.uniform("uIntensity"), opts.intensity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    resize(cssW, cssH, pr) {
      canvas.width = Math.max(1, Math.round(cssW * pr));
      canvas.height = Math.max(1, Math.round(cssH * pr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(program.uniform("uRes"), canvas.width, canvas.height);
      if (still) draw();
    },

    render(_now, dt) {
      // The original ran on page time at 0.3 per second
      time += (Math.min(64, dt) / 1000) * 0.3 * opts.speed;
      draw();
    },

    update(next) {
      const recolor = next.sourcePalette !== undefined && next.sourcePalette !== opts.sourcePalette;
      opts = { ...opts, ...next };
      if (recolor) recolour();
      if (still) draw();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      if (still) draw();
    },

    still() {
      still = true;
      time = 1.7;
      draw();
    },

    dispose() {
      disposeTriangle();
      program.dispose();
    },
  };
}
