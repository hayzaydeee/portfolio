/**
 * ThreeUI Liquid Metal Button's dispersion shaders (MIT, Meng To), GLSL ES 3.00. The field,
 * rim, softening blur and bloom chain are the original's. Changed here: each ripple slot's
 * fourth component is its amplitude (the original only used it as an on flag), so a kick can
 * throw a softer ring than a press; and the composite tints the light toward the room and
 * fades it out before the canvas edge, since this key sits in a bar with far less room for
 * its halo than the original's showcase stage.
 */

export const VERT = `#version 300 es
in vec2 position; void main(){ gl_Position = vec4(position,0.,1.); }`;

const HEAD = `#version 300 es
precision highp float;
out vec4 o;

uniform vec2  uC;        // key centre, device px
uniform vec2  uHalf;     // key half-extent, device px
uniform float uT;        // seconds
uniform float uHover;    // 0..1
uniform float uPress;    // 0..1, eased
uniform vec4  uRip[3];   // xy centre (key heights, +y down), z start, w amplitude (0 = off)
uniform vec4  uRipK;     // speed, ring width, decay, amplitude
uniform vec4  uRipK2;    // facet depth, facet count, crest sharpness, emission
uniform vec4  uPtr;      // xy trailing cursor, z strength, w normalised speed
uniform vec4  uPtrK;     // radius, base amplitude, speed amplitude, rim lift

#define PI 3.14159265

float sdPill(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return min(max(q.x,q.y),0.) + length(max(q,0.)) - r;
}

// Faceted, cusped rings from each press: a crease in sheet metal, not a water ripple
float ripple(vec2 p, float t){
  float sum = 0.;
  for(int i = 0; i < 3; i++){
    if(uRip[i].w < 0.02) continue;
    float age = t - uRip[i].z;
    if(age < 0. || age > 4.) continue;
    vec2  rp = p - uRip[i].xy;
    float facet = 1. + uRipK2.x * cos(uRipK2.y * atan(rp.y, rp.x) + age * 2.1 + float(i) * 2.4);
    float x = (length(rp) - age * uRipK.x * facet) / uRipK.y;
    sum += exp(-pow(abs(x) + 1e-4, uRipK2.z)) * exp(-age * uRipK.z) * uRip[i].w;
  }
  return sum;
}

// A soft well that trails the cursor and swells with its speed
float pointerW(vec2 p){
  if(uPtr.z < 0.001) return 0.;
  float d = length(p - uPtr.xy) / uPtrK.x;
  return exp(-d*d) * uPtr.z;
}
vec2 pointerWarp(vec2 p){
  float w = pointerW(p);
  if(w <= 0.) return vec2(0.);
  return normalize(p - uPtr.xy + vec2(1e-5)) * w * (uPtrK.y + uPtrK.z * uPtr.w);
}
`;

/** The travelling rim, in its own pass so the softening blur never touches it */
export const FRAG_RIM =
  HEAD +
  `
uniform float uBw;       // stroke half-width, device px
uniform float uE[8];     // base, hot, chroma-across, chroma-along, speed, topBias, press lift, ripple lift

float perim(vec2 d, float a, float r){
  float P = 4.*a + 2.*PI*r;
  float s;
  if(d.x >= a){
    float th = atan(d.y, d.x - a); if(th < 0.) th += 2.*PI;
    s = (th <= PI*0.5) ? r*th : P - r*(2.*PI - th);
  } else if(d.x <= -a){
    float th = atan(d.y, d.x + a); if(th < 0.) th += 2.*PI;
    s = r*PI*0.5 + 2.*a + r*(th - PI*0.5);
  } else if(d.y >= 0.){
    s = r*PI*0.5 + (a - d.x);
  } else {
    s = r*PI*1.5 + 2.*a + (d.x + a);
  }
  return s / P;
}
float pb(float u, float w){ u = fract(u); float x = min(u, 1.-u); return exp(-(x*x)/(w*w)); }

float rimHot(float s, float t){
  float v = uE[0];
  v += 0.62 * pb(s - t*uE[4],             0.075);
  v += 0.44 * pb(s + t*uE[4]*0.63 + 0.41, 0.135);
  v += 0.30 * pb(s - t*uE[4]*0.34 + 0.73, 0.200);
  return v;
}
float rimBand(float sd, float off){ return 1. - smoothstep(0., uBw*1.05, abs(sd + uBw*0.55 + off)); }

void main(){
  vec2  d  = gl_FragCoord.xy - uC;
  float sd = sdPill(d, uHalf, uHalf.y);
  if(sd > uBw*2.5 || sd < -uBw*3.5){ o = vec4(0.); return; }

  float a = max(uHalf.x - uHalf.y, 0.);
  float s = perim(d, a, uHalf.y);
  float top = mix(1., 0.5 + 0.5 * (d.y / uHalf.y), uE[5]);

  vec2  p   = vec2(d.x, -d.y) / (uHalf.y * 2.);
  float lift = 1. + uPress * uE[6] + ripple(p, uT) * uE[7] + pointerW(p) * uPtrK.w;

  o = vec4(vec3(
    rimBand(sd,  uE[2]) * rimHot(s + uE[3], uT),
    rimBand(sd,  0.   ) * rimHot(s,         uT),
    rimBand(sd, -uE[2]) * rimHot(s - uE[3], uT)
  ) * uE[1] * top * lift, 1.);
}`;

export const FRAG_SCENE =
  HEAD +
  `
uniform float uP[21];

float h21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.-2.*f);
  float a = h21(i), b = h21(i+vec2(1,0)), c = h21(i+vec2(0,1)), d = h21(i+vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y) * 2. - 1.;
}
float fbm(vec2 p, float g){
  float s = 0., a = 1., n = 0.;
  for(int i=0;i<4;i++){ s += a*vn(p); n += a; p = p*2.03 + 11.7; a *= g; }
  return s / n;
}
float fbm(vec2 p){ return fbm(p, 0.5); }

// The bands are a family of parallel curves: one swooping valley repeated up the key,
// dense where the light is pinched and pulled wide open where it is not
float wig(float x, float t, float seed){
  return vn(vec2(x,          t*0.150 + seed)) * 0.60
       + vn(vec2(x*2.07 + 4., t*0.105 + seed)) * 0.27
       + vn(vec2(x*4.30 - 7., t*0.080 + seed)) * 0.13;
}
float valleyAt(vec2 p, float t){ return wig(p.x*uP[0], t, 0.0) * uP[1]; }
float densAt  (vec2 p, float t){ return uP[2] * exp(uP[3] * wig(p.x*uP[4] + 9.0, t, 2.7)); }

float surface(vec2 p, float t){
  float V = (p.y - valleyAt(p,t)) * densAt(p,t);
  V += uP[5] * fbm(p*vec2(0.8, 1.7)*uP[6] + vec2(t*0.05, -t*0.03), uP[17]);
  return V - uP[7];
}
float tone(float v){
  float u = fract(v);
  float e = uP[9], W = uP[10] * 0.5;
  return smoothstep(0.5-W-e, 0.5-W, u) * (1. - smoothstep(0.5+W, 0.5+W+e, u));
}
vec3 spec(float t){ return clamp(vec3(1.5) - abs(4.*t - vec3(3.,2.,1.)), 0., 1.); }

void main(){
  vec2  d  = gl_FragCoord.xy - uC;
  float sd = sdPill(d, uHalf, uHalf.y);
  float pill = 1. - smoothstep(-1., 1., sd);
  float S = uHalf.y * 2.;
  float t = uT;

  if(uHover <= 0.0015 || pill <= 0.0015){ o = vec4(0., 0., 0., pill); return; }

  vec2  p = vec2(d.x, -d.y) / S;
  vec2  q = p + pointerWarp(p);

  float h0 = surface(q, t);
  vec2  gp = vec2(dFdx(h0), -dFdy(h0)) * S;
  float V  = surface(q - gp * uP[8] / max(uP[2], .001), t);

  vec2  gd = normalize(gp + vec2(1e-5));
  V += uP[13] * fbm(vec2(dot(q,gd)*uP[14], dot(q, vec2(-gd.y,gd.x))*uP[14]*0.04) + vec2(0., t*0.06));

  float rip  = ripple(p, t);
  float well = pointerW(p);
  V += rip * uRipK.w;

  // Cauchy-skewed dispersion: a broad cool wash against a tight warm edge
  const int N = 21;
  float mid = 1. - pow(0.5, uP[12]);
  vec3 col = vec3(0.), wsum = vec3(0.);
  for(int i=0;i<N;i++){
    float k = float(i)/float(N-1);
    vec3  w = spec(k);
    col  += w * tone(V + ((1. - pow(1. - k, uP[12])) - mid) * uP[11]);
    wsum += w;
  }
  col /= wsum;
  col = pow(col, vec3(uP[15]));

  float lit = smoothstep(uP[18], uP[19], q.y - valleyAt(q, t));
  lit *= mix(1., lit, 0.55);
  col *= uP[16] * lit;
  col = col * (1. + rip * 1.15 + well * 0.60);

  o = vec4(col * pill * uHover, pill);
}`;

export const FRAG_DOWN = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uTex, uTex2;
uniform vec2 uDstTexel;
uniform float uAdd;
void main(){
  vec2 uv = gl_FragCoord.xy * uDstTexel;
  // Taps a quarter of a destination texel out land on the four source texel centres
  vec2 e = uDstTexel * 0.25;
  vec4 s = texture(uTex, uv + vec2(-e.x,-e.y)) + texture(uTex, uv + vec2( e.x,-e.y))
         + texture(uTex, uv + vec2(-e.x, e.y)) + texture(uTex, uv + vec2( e.x, e.y));
  s *= 0.25;
  if(uAdd > 0.5){
    vec4 r = texture(uTex2, uv + vec2(-e.x,-e.y)) + texture(uTex2, uv + vec2( e.x,-e.y))
           + texture(uTex2, uv + vec2(-e.x, e.y)) + texture(uTex2, uv + vec2( e.x, e.y));
    s.rgb += r.rgb * 0.25;
  }
  o = s;
}`;

export const FRAG_BLUR = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform vec2 uDir; uniform float uR;
void main(){
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec2 st = uTexel * uDir * uR;
  vec4 s = texture(uTex, uv) * 0.1964;
  s += (texture(uTex, uv + st*1.4118) + texture(uTex, uv - st*1.4118)) * 0.2969;
  s += (texture(uTex, uv + st*3.2941) + texture(uTex, uv - st*3.2941)) * 0.0944;
  s += (texture(uTex, uv + st*5.1765) + texture(uTex, uv - st*5.1765)) * 0.0104;
  o = s;
}`;

export const FRAG_COMP =
  HEAD +
  `
uniform sampler2D uSoft, uRim, uGlow;
uniform vec2  uRes;
uniform float uGlowGain, uGlowIn, uOccl, uDim, uPunch, uFade;
uniform vec3  uTint;

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 glow = texture(uGlow, uv).rgb;

  vec2  d    = gl_FragCoord.xy - uC;
  float sd   = sdPill(d, uHalf, uHalf.y);
  float pill = 1. - smoothstep(-1., 1., sd);

  vec4 m = texture(uSoft, uv);
  // knock the metal back through the middle, where the glyph sits
  float veil = 1. - smoothstep(0.46, 0.88, abs(d.y) / uHalf.y);
  vec3 metal = pow(max(m.rgb / max(m.a, 1e-3), 0.), vec3(uPunch));
  vec3 core = metal * pill * mix(1., uDim, veil) + texture(uRim, uv).rgb;

  float rip = ripple(vec2(d.x, -d.y) / (uHalf.y * 2.), uT);
  core += vec3(rip * rip) * uRipK2.w * pill * mix(1., 0.42, veil);

  // the key occludes its own bloom where its shadow falls
  float sdSh = sdPill(d + vec2(0., uHalf.y * 0.62), uHalf * 0.94, uHalf.y * 0.94);
  float occl = uOccl * exp(-max(sdSh, 0.) / (uHalf.y * 0.75));

  vec3 rgb = core + glow * uGlowGain * mix(1., uGlowIn, pill) * (1. - occl * (1. - pill));
  rgb *= uTint;

  // the bar gives the halo little room: it thins out before the canvas edge
  vec2 edge = min(gl_FragCoord.xy, uRes - gl_FragCoord.xy);
  rgb *= smoothstep(0., uFade, min(edge.x, edge.y));

  float a = clamp(max(rgb.r, max(rgb.g, rgb.b)), 0., 1.);
  o = vec4(min(rgb, vec3(1.)), a);
}`;
