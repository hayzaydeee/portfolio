/**
 * Adapted from ThreeUI Portal Field (MIT, Meng To): the warped arc SDF and its core/fringe
 * glow are the original's. New here: the arc is an iris whose outside is the destination
 * room's base colour, so one ring both covers and reveals; output is premultiplied alpha.
 */
export const PORTAL_FIELD_FRAGMENT = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_radius;
uniform float u_ring;
uniform float u_warp;
uniform float u_fringe;
uniform float u_void_alpha;
uniform vec3 u_void;
uniform vec3 u_core;
uniform vec3 u_fringe_color;

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(in vec2 p) {
  const float K1 = 0.366025404;
  const float K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash(i + 0.0)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
  return dot(n, vec3(70.0));
}

void main() {
  vec2 st = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  st += u_mouse * 0.03;

  // The original's warp, scaled down as the ring shrinks so the closed portal stays round
  vec2 p = st;
  float warp = u_warp * (0.02 + 0.13 * clamp(u_radius * 1.6, 0.0, 1.0));
  p.y += sin(p.x * 2.0 + u_time * 0.3) * warp;
  p.x += noise(p * 1.5 + u_time * 0.1) * warp * 0.8;
  float dist = length(p);

  float d1 = abs(dist - u_radius) - 0.012;
  float d2 = abs(dist - (u_radius + 0.03)) - 0.05;
  float core = exp(-max(d1, 0.0) * 30.0);
  float fringe = exp(-max(d2, 0.0) * 10.0) * u_fringe;
  float wash = smoothstep(1.2, -0.4, abs(dist - u_radius)) * 0.12 * u_fringe;

  vec3 glow = u_core * core + u_fringe_color * (fringe + wash);
  glow = vec3(1.0) - exp(-glow * 1.5);
  float glowAlpha = clamp(core + fringe * 0.7 + wash, 0.0, 1.0) * u_ring;

  // Outside the iris: the room we're heading to. Inside: whatever is on the page.
  float outside = smoothstep(u_radius - 0.006, u_radius + 0.018, dist) * u_void_alpha;

  vec3 premul = u_void * outside * (1.0 - glowAlpha) + glow * glowAlpha;
  float alpha = outside + glowAlpha * (1.0 - outside);
  gl_FragColor = vec4(premul, alpha);
}
`;
