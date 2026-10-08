import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { bindFullscreenTriangle, createProgram, FULLSCREEN_VERTEX, getGL } from "@/components/fx/runtime/gl";
import type { DotMatrixOptions } from "./meta";

/**
 * Port of ThreeUI's Dot Matrix background (MIT, Meng To) from a three r128 ShaderMaterial to
 * raw WebGL. The original drew cyan dots on a transparent canvas; here the room base is
 * painted underneath (an opaque canvas is cheaper to composite) and the dots take the
 * room's syntax glow.
 */

const FRAGMENT = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_grid;
uniform float u_mouse_amount;
uniform float u_pulse_speed;
uniform float u_radius;
uniform float u_opacity;
uniform vec3 u_base;
uniform vec3 u_dot;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float aspect = u_resolution.x / u_resolution.y;
  uv.x *= aspect;
  uv += u_mouse * u_mouse_amount;
  vec2 grid = fract(uv * u_grid);
  vec2 id = floor(uv * u_grid);
  float dist = length(grid - vec2(0.5));
  float pulse = sin(u_time * u_pulse_speed + id.x * 0.05 + id.y * 0.05) * 0.5 + 0.5;
  float radius = 0.08 + pulse * u_radius;
  float alpha = smoothstep(radius, radius - 0.05, dist);
  vec2 center = vec2(0.5 * aspect, 0.5);
  float depthFade = smoothstep(1.2, 0.1, length(uv - center));
  float a = clamp(alpha * depthFade * u_opacity, 0.0, 1.0);
  gl_FragColor = vec4(mix(u_base, u_dot * pulse, a), 1.0);
}
`;

const SOURCE: { base: RGB; dot: RGB } = { base: [0, 0, 0], dot: [0, 0.9, 1] };
const STILL_TIME_S = 4;

export function create(ctx: FxContext, initial: DotMatrixOptions): FxInstance<DotMatrixOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const gl = getGL(canvas);
  if (!gl) throw new Error("WebGL unavailable");

  const program = createProgram(gl, FULLSCREEN_VERTEX, FRAGMENT);
  gl.useProgram(program.program);
  const disposeTriangle = bindFullscreenTriangle(gl, program.program);

  let palette = ctx.palette;
  let elapsed = 0;
  let still = false;
  let w = 1;
  let h = 1;
  // The grid leans toward the pointer, eased the way the original lerps it
  const mouse = { x: 0, y: 0 };

  const colours = () => (opts.sourcePalette ? SOURCE : { base: palette.base, dot: palette.glow });

  const draw = () => {
    const { base, dot } = colours();
    gl.uniform1f(program.uniform("u_time"), elapsed);
    gl.uniform2f(program.uniform("u_mouse"), mouse.x, mouse.y);
    gl.uniform1f(program.uniform("u_grid"), opts.gridScale);
    gl.uniform1f(program.uniform("u_mouse_amount"), opts.mouseAmount);
    gl.uniform1f(program.uniform("u_pulse_speed"), opts.pulseSpeed);
    gl.uniform1f(program.uniform("u_radius"), opts.radius);
    gl.uniform1f(program.uniform("u_opacity"), opts.opacity);
    gl.uniform3fv(program.uniform("u_base"), base);
    gl.uniform3fv(program.uniform("u_dot"), dot);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    resize(cssW, cssH, pr) {
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      canvas.width = Math.max(1, Math.round(w * pr));
      canvas.height = Math.max(1, Math.round(h * pr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(program.uniform("u_resolution"), canvas.width, canvas.height);
      if (still) draw();
    },

    render(_now, dt) {
      elapsed += (dt / 1000) * opts.speed;
      const p = ctx.pointer();
      const tx = p.seen ? (p.x / w) * 2 - 1 : 0;
      const ty = p.seen ? -((p.y / h) * 2 - 1) : 0;
      // The original lerps 5% a frame at 60fps; scaled to the real frame time
      const k = 1 - Math.pow(0.95, dt / 16.7);
      mouse.x += (tx - mouse.x) * k;
      mouse.y += (ty - mouse.y) * k;
      draw();
    },

    update(next) {
      opts = { ...opts, ...next };
      if (still) draw();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      if (still) draw();
    },

    still() {
      still = true;
      elapsed = STILL_TIME_S;
      draw();
    },

    dispose() {
      disposeTriangle();
      program.dispose();
    },
  };
}
