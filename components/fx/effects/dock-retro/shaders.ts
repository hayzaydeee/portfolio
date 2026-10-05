/**
 * From ThreeUI Animated Top Dock's retro pixel field (MIT, Meng To). The composition, fbm
 * weather and recursive Bayer dither are the original's; the eight palette stops are now
 * uniforms so the field quantises to room colours instead of the hardcoded sunset.
 */
export const DOCK_RETRO_FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uNoise;
uniform float uLevels;
uniform vec3 uStops[8];

float hash(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.23); return fract(p.x * p.y); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p){
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 5; i++){ sum += amp * vnoise(p); p = p * 2.03 + 11.7; amp *= 0.5; }
  return sum;
}

float bayer2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float bayer4(vec2 a){ return bayer2(a * 0.5) * 0.25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(a * 0.5) * 0.25 + bayer2(a); }

vec3 stop(float index){
  if (index < 0.5) return uStops[0];
  if (index < 1.5) return uStops[1];
  if (index < 2.5) return uStops[2];
  if (index < 3.5) return uStops[3];
  if (index < 4.5) return uStops[4];
  if (index < 5.5) return uStops[5];
  if (index < 6.5) return uStops[6];
  return uStops[7];
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float t = uTime;

  vec2 cloud = vec2(uv.x * 3.4, uv.y * 2.1);
  float weather = fbm(cloud + vec2(t * 0.055, t * -0.021));
  weather = mix(weather, fbm(cloud * 1.9 + vec2(-t * 0.032, t * 0.044)), 0.42);

  float sky = smoothstep(0.98, 0.20, uv.y) * 0.36;
  float heat = smoothstep(0.60, 0.16, uv.y) * 0.32;
  float ground = smoothstep(0.26, 0.08, uv.y);
  float sun = smoothstep(0.38, 0.0, length((uv - vec2(0.5, 0.29)) * vec2(0.70, 1.5))) * 0.20;
  float field = 0.11 + sky + heat + sun - ground * 0.80 + (weather - 0.5) * 0.82 * uNoise;

  float grain = hash(floor(gl_FragCoord.xy) + floor(t * 12.0)) - 0.5;
  field += grain * 0.055 * uNoise;
  field *= 1.0 - 0.34 * smoothstep(0.45, 1.05, length((uv - vec2(0.5, 0.46)) * vec2(1.06, 1.0)));

  float levels = max(uLevels, 2.0);
  float dither = bayer8(gl_FragCoord.xy) - 0.5;
  float quantised = clamp(field + dither / levels, 0.0, 0.9999);
  gl_FragColor = vec4(stop(floor(quantised * levels) * (7.0 / (levels - 1.0))), 1.0);
}
`;
