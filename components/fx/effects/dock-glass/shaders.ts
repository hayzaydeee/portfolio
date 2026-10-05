/**
 * From ThreeUI Animated Top Dock's glass particle field (MIT, Meng To). The bloom backdrop
 * and the bead shading (per-channel refraction, two specular keys, fresnel rim, distance
 * haze) are the original's. The three.js scene and its render target are gone: the
 * backdrop is analytic, so each bead is an analytic sphere that refracts by re-evaluating
 * it at offset coordinates, all in one fullscreen pass without three.
 */
export const DOCK_GLASS_FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform vec3 uBase;
uniform vec3 uBloomA;
uniform vec3 uBloomB;
uniform vec3 uBloomC;
uniform vec3 uBloomD;
uniform vec3 uBloomP;
uniform vec4 uBeads[12];
uniform float uCount;
uniform float uThickness;
uniform float uDispersion;
uniform float uSpecular;
uniform float uRim;

vec3 bloom(vec2 uv, vec2 centre, float radius, vec3 tint){
  float aspect = uRes.x / max(uRes.y, 1.0);
  float d = length((uv - centre) * vec2(aspect, 1.0));
  float falloff = smoothstep(radius, 0.0, d);
  return tint * falloff * falloff;
}

vec3 backdrop(vec2 uv){
  float t = uTime * 0.17;
  vec3 col = uBase;
  col += mix(vec3(0.0), uBase * 0.6, uv.y);
  col += bloom(uv, vec2(0.23 + 0.055 * sin(t * 0.9), 0.76 + 0.045 * cos(t * 0.7)), 0.86, uBloomA) * 0.92;
  col += bloom(uv, vec2(0.82 + 0.05 * cos(t * 0.8), 0.34 + 0.055 * sin(t * 1.1)), 0.80, uBloomB) * 0.80;
  col += bloom(uv, vec2(0.50 + 0.07 * sin(t * 0.6 + 1.7), 0.10 + 0.04 * cos(t * 0.9)), 0.74, uBloomC) * 0.60;
  col += bloom(uv, vec2(0.10 + 0.04 * cos(t * 1.2), 0.16 + 0.05 * sin(t * 0.8)), 0.58, uBloomD) * 0.34;
  col += bloom(uv, vec2(0.5 + uPointer.x * 0.20, 0.56 + uPointer.y * 0.16), 0.46, uBloomP) * 0.30;
  float vignette = smoothstep(1.34, 0.30, length((uv - 0.5) * vec2(1.05, 1.0)));
  return col * mix(0.62, 1.0, vignette);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 col = backdrop(uv);
  float minRes = min(uRes.x, uRes.y);
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(-0.45, 0.86, 0.62));
  vec3 H = normalize(L + V);
  vec3 H2 = normalize(normalize(vec3(0.55, -0.7, 0.45)) + V);

  for (int i = 0; i < 12; i++){
    if (float(i) >= uCount) break;
    vec4 bead = uBeads[i];
    vec2 d = (gl_FragCoord.xy - bead.xy) / bead.z;
    float r2 = dot(d, d);
    if (r2 >= 1.0) continue;

    vec3 N = vec3(d, sqrt(1.0 - r2));
    float fresnel = pow(1.0 - N.z, 3.4);
    float thickness = uThickness * (0.55 + bead.z / minRes * 2.4);
    vec2 offR = refract(-V, N, 1.0 / (1.44 - uDispersion)).xy * thickness;
    vec2 offG = refract(-V, N, 1.0 / 1.44).xy * thickness;
    vec2 offB = refract(-V, N, 1.0 / (1.44 + uDispersion)).xy * thickness;

    vec3 c;
    c.r = backdrop(clamp(uv + offR, 0.002, 0.998)).r;
    c.g = backdrop(clamp(uv + offG, 0.002, 0.998)).g;
    c.b = backdrop(clamp(uv + offB, 0.002, 0.998)).b;

    float ndoth = max(dot(N, H), 0.0);
    c += pow(ndoth, 150.0) * uSpecular;
    c += pow(ndoth, 16.0) * uSpecular * 0.11;
    c += pow(max(dot(N, H2), 0.0), 44.0) * uSpecular * 0.22;
    c += fresnel * uRim * vec3(0.86, 0.90, 1.0);

    // bead.w is depth haze: far beads dissolve into the plate behind them
    c = mix(c, col, bead.w * 0.7);
    float edge = 1.0 - smoothstep(1.0 - 2.0 / bead.z, 1.0, sqrt(r2));
    col = mix(col, c, edge);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;
