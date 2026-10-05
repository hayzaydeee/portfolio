/**
 * Every glyph of every ring is one quad in a static buffer; per-ring radius, size, turn and
 * alpha live in a uniform array, so a whole vortex is one draw call however many glyphs it
 * holds. (The canvas-2D version spent ~3000 drawImage calls a frame.)
 */
export const MAX_RINGS = 32;

export const GLYPH_VERTEX = `
attribute vec2 aCorner;
attribute float aAngle;
attribute float aRing;
attribute vec2 aCell;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uScale;
uniform float uSizeScale;
uniform vec2 uCellSize;
/* radius, font size, turn, alpha */
uniform vec4 uRing[${MAX_RINGS}];
varying vec2 vUV;
varying float vAlpha;

void main() {
  vec4 ring = uRing[int(aRing + 0.5)];
  float a = aAngle + ring.z;
  vec2 outward = vec2(cos(a), sin(a));
  vec2 tangent = vec2(-outward.y, outward.x);
  /* the original rotates each glyph by angle + 90deg: x runs along the ring, glyph tops face out */
  vec2 local = aCorner * ring.y * uSizeScale * 1.3;
  vec2 pos = uCenter + outward * ring.x * uScale + tangent * local.x - outward * local.y;
  vec2 clip = pos / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUV = aCell + (aCorner + 0.5) * uCellSize;
  vAlpha = ring.w;
}
`;

export const GLYPH_FRAGMENT = `
precision mediump float;
uniform sampler2D uAtlas;
uniform vec3 uColor;
varying vec2 vUV;
varying float vAlpha;

void main() {
  float a = texture2D(uAtlas, vUV).a * vAlpha;
  gl_FragColor = vec4(uColor * a, a);
}
`;

/** Void fill (mode 0) or the reveal hole (mode 1, drawn with a destination-out blend) */
export const FILL_FRAGMENT = `
precision mediump float;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform vec3 uVoid;
uniform float uVoidAlpha;
uniform float uHole;
uniform float uMode;

void main() {
  if (uMode < 0.5) {
    gl_FragColor = vec4(uVoid * uVoidAlpha, uVoidAlpha);
    return;
  }
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float d = length(p - uCenter);
  float mask = 1.0 - smoothstep(uHole * 0.7, uHole, d);
  gl_FragColor = vec4(0.0, 0.0, 0.0, mask);
}
`;
