// Ported from ThreeUI Bell Field (MIT). Changes: palette uniforms instead of a CSS
// hue-rotate filter, four positioned strike slots instead of one, audio energy term, and
// angular modes blended between integers (the original cos(n·a) with fractional n tore a
// seam along atan's branch cut, left of centre).
export const BELL_FIELD_FRAGMENT = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec4 u_strikes[4]; // xy origin (field space), z age 0..1, w strength
uniform vec3 u_deep;
uniform vec3 u_patina;
uniform vec3 u_bronze;
uniform vec3 u_ash;
uniform float u_brightness;
uniform float u_energy;

#define PI 3.14159265359

float hash(vec2 p) { return fract(sin(dot(p, vec2(23.71, 91.37))) * 41537.1234); }

// damped-cosine stand-in for the Bessel envelope of a circular mode
float bess(float x) { return cos(x - 0.785398) / sqrt(1.0 + abs(x)); }

// cos(n·a + ph) for fractional n, continuous across a = ±PI: crossfade neighbouring integer modes
float mode(float n, float a, float ph) {
  float lo = floor(n);
  return mix(cos(lo * a + ph), cos((lo + 1.0) * a + ph), n - lo);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  p.y += 0.08;

  vec2 m = u_mouse / u_resolution.xy * 2.0 - 1.0;
  m.y = -m.y;
  m.x *= u_resolution.x / u_resolution.y;
  p -= m * 0.11;

  float t = u_time * 0.09;
  float r = length(p);
  float a = atan(p.y, p.x);

  // the bell drifts between partials the way a struck bell does
  float ang = 3.0 + 1.6 * sin(t * 0.37) + sin(t * 0.19 + 1.7);
  float k   = 3.1 + 1.0 * sin(t * 0.23 + 0.6);

  float excite = 0.0;
  float ring = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 s = u_strikes[i];
    float live = (1.0 - s.z) * s.w;
    excite = max(excite, live);
    float d = length(p - s.xy);
    ring += smoothstep(0.06, 0.0, abs(d - s.z * 2.3)) * live;
  }

  float amp = (1.0 + excite * 0.55) * u_energy;
  float f1 = bess(r * k * PI - t * 2.2) * mode(ang, a, t * 0.5);
  float f2 = bess(r * k * 1.6 * PI + t * 1.4) * mode(ang * 2.0 + 1.0, a, -t * 0.31);
  float f = (f1 + f2 * 0.30) * amp;

  // nodal lines, where the metal stands still
  float node = 1.0 - smoothstep(0.0, 0.075 + 0.075 * r, abs(f));
  // antinodes, where it moves and glows hot
  float anti = smoothstep(0.40, 0.95, abs(f));

  // the crown stays quiet, clearing a reading zone under the type
  float open = smoothstep(0.14, 0.92, r);
  node *= open;
  anti *= open;

  vec3 col = u_deep;
  col = mix(col, u_patina, node * 0.50);
  col = mix(col, u_bronze, anti * 0.22);
  col += u_ash * pow(node, 3.0) * 0.13;
  col += mix(u_bronze, u_ash, 0.4) * min(ring, 1.5) * 0.7;

  col *= mix(0.10, 1.0, smoothstep(2.0, 0.28, r));
  col *= u_brightness;
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.022;

  gl_FragColor = vec4(col, 1.0);
}
`;
