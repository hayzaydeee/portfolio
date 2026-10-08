import { AdditiveBlending, Color, LinearSRGBColorSpace, ShaderMaterial, WebGLRenderer } from "three";
import type { FxContext, RGB } from "./types";

/**
 * Shared setup for the effects written in three. Only their renderer modules import this, so
 * three loads with them and never ships in a route's first bundle.
 *
 * Context: three draws through WebGL2 (its only backend since r163), so these effects declare
 * kind "webgl2" and the stage's teardown loses that same context after `dispose()`.
 *
 * Colour: the ThreeUI sources target three r128, which did no colour management: hex values
 * went through lighting and blending and onto the screen untouched. A linear output colour
 * space with colours set as linear reproduces that exactly, and keeps palette RGB untouched
 * the way the raw-WebGL effects pass it.
 */
export function createRenderer(ctx: FxContext, { alpha = false } = {}): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas: ctx.canvas,
    alpha,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  return renderer;
}

/** Palette RGB as a three colour, untouched (see the note above) */
export const raw = ([r, g, b]: RGB, out = new Color()): Color => out.setRGB(r, g, b, LinearSRGBColorSpace);

export function sizeRenderer(renderer: WebGLRenderer, cssW: number, cssH: number, pixelRatio: number) {
  renderer.setPixelRatio(pixelRatio);
  // The stage sizes the canvas element with classes; three only owns the drawing buffer
  renderer.setSize(Math.max(1, cssW), Math.max(1, cssH), false);
}

export type PointsUniforms = {
  uSize: { value: number };
  uScale: { value: number };
  uOpacity: { value: number };
  uColor: { value: RGB };
  uMask: { value: [number, number] };
  uHeight: { value: number };
};

/**
 * Additive square points sized like three's PointsMaterial (world size over depth), with two
 * things it lacks: a sub-pixel point draws one pixel at proportionally lower alpha (the GPU
 * would otherwise round it up to a full-strength pixel, so a small frame turns into a glowing
 * smear), and an optional vertical fade (0 at the top edge of `uMask.x`, full by
 * `uMask.y`, as fractions of the canvas height from the top). Colours are raw sRGB: per
 * vertex when `vertexColors`, else `uColor`.
 */
export function createPointsMaterial({ vertexColors = false } = {}): ShaderMaterial & { uniforms: PointsUniforms } {
  const uniforms: PointsUniforms = {
    uSize: { value: 0.08 },
    uScale: { value: 450 },
    uOpacity: { value: 0.4 },
    uColor: { value: [1, 1, 1] },
    uMask: { value: [0, 0] },
    uHeight: { value: 1 },
  };
  return new ShaderMaterial({
    uniforms,
    vertexColors,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uSize;
      uniform float uScale;
      varying float vLight;
      varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float px = uSize * uScale / -mv.z;
        vLight = clamp(px, 0.0, 1.0);
        gl_PointSize = max(px, 1.0);
        gl_Position = projectionMatrix * mv;
        #ifdef USE_COLOR
          vColor = color;
        #else
          vColor = vec3(1.0);
        #endif
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform vec2 uMask;
      uniform float uHeight;
      varying float vLight;
      varying vec3 vColor;
      void main() {
        float fromTop = 1.0 - gl_FragCoord.y / uHeight;
        float mask = uMask.y > uMask.x ? clamp((fromTop - uMask.x) / (uMask.y - uMask.x), 0.0, 1.0) : 1.0;
        #ifdef USE_COLOR
          vec3 c = vColor;
        #else
          vec3 c = uColor;
        #endif
        gl_FragColor = vec4(c, uOpacity * vLight * mask);
      }`,
  }) as ShaderMaterial & { uniforms: PointsUniforms };
}
