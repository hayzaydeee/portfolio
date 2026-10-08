/**
 * ThreeUI Animated Top Dock's glass particle field (MIT, Meng To), back in three as the
 * original wrote it: a bloom backdrop rendered once to a target and once to the screen, then
 * glass shapes that sample that target through their own refraction. The blooms take room
 * colours as uniforms instead of the original's constants.
 */

export const BACKDROP_VERTEX = `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export const BACKDROP_FRAGMENT = `
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform vec3 uBase;
uniform vec3 uBloomA;
uniform vec3 uBloomB;
uniform vec3 uBloomC;
uniform vec3 uBloomD;
uniform vec3 uBloomP;

vec3 bloom(vec2 uv, vec2 centre, float radius, vec3 tint){
  float aspect = uRes.x / max(uRes.y, 1.0);
  float d = length((uv - centre) * vec2(aspect, 1.0));
  float falloff = smoothstep(radius, 0.0, d);
  return tint * falloff * falloff;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float t = uTime * 0.17;
  // the base tone matters more than the blooms: refraction samples the whole frame, so a
  // backdrop with black regions makes the shapes read as dark holes
  vec3 col = uBase;
  col += mix(vec3(0.0), uBase * 0.6, uv.y);
  col += bloom(uv, vec2(0.23 + 0.055 * sin(t * 0.9), 0.76 + 0.045 * cos(t * 0.7)), 0.86, uBloomA) * 0.92;
  col += bloom(uv, vec2(0.82 + 0.05 * cos(t * 0.8), 0.34 + 0.055 * sin(t * 1.1)), 0.80, uBloomB) * 0.80;
  col += bloom(uv, vec2(0.50 + 0.07 * sin(t * 0.6 + 1.7), 0.10 + 0.04 * cos(t * 0.9)), 0.74, uBloomC) * 0.60;
  col += bloom(uv, vec2(0.10 + 0.04 * cos(t * 1.2), 0.16 + 0.05 * sin(t * 0.8)), 0.58, uBloomD) * 0.34;
  col += bloom(uv, vec2(0.5 + uPointer.x * 0.20, 0.56 + uPointer.y * 0.16), 0.46, uBloomP) * 0.30;
  float vignette = smoothstep(1.34, 0.30, length((uv - 0.5) * vec2(1.05, 1.0)));
  col *= mix(0.62, 1.0, vignette);
  gl_FragColor = vec4(col, 1.0);
}`;

export const GLASS_VERTEX = `
varying vec3 vNormalView;
varying vec3 vViewPos;
varying vec4 vScreen;

void main(){
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vViewPos = mvPosition.xyz;
  vScreen = projectionMatrix * mvPosition;
  gl_Position = vScreen;
}`;

export const GLASS_FRAGMENT = `
uniform sampler2D uBackdrop;
uniform float uThickness;
uniform float uDispersion;
uniform float uSpecular;
uniform float uRim;
uniform float uHazeNear;
uniform float uHazeFar;
uniform vec3 uTint;
uniform vec3 uLight;
varying vec3 vNormalView;
varying vec3 vViewPos;
varying vec4 vScreen;

void main(){
  vec2 screenUV = (vScreen.xy / vScreen.w) * 0.5 + 0.5;
  vec3 N = normalize(vNormalView);
  vec3 V = normalize(-vViewPos);
  vec3 I = -V;
  float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.4);

  vec2 offsetR = refract(I, N, 1.0 / (1.44 - uDispersion)).xy * uThickness;
  vec2 offsetG = refract(I, N, 1.0 / 1.44).xy * uThickness;
  vec2 offsetB = refract(I, N, 1.0 / (1.44 + uDispersion)).xy * uThickness;

  vec3 col;
  col.r = texture2D(uBackdrop, clamp(screenUV + offsetR, 0.002, 0.998)).r;
  col.g = texture2D(uBackdrop, clamp(screenUV + offsetG, 0.002, 0.998)).g;
  col.b = texture2D(uBackdrop, clamp(screenUV + offsetB, 0.002, 0.998)).b;
  col *= uTint;

  vec3 L = normalize(uLight);
  vec3 H = normalize(L + V);
  float ndoth = max(dot(N, H), 0.0);
  col += pow(ndoth, 150.0) * uSpecular;
  col += pow(ndoth, 16.0) * uSpecular * 0.11;
  // a second, dimmer key from below keeps the underside of every shape alive
  vec3 H2 = normalize(normalize(vec3(0.55, -0.7, 0.45)) + V);
  col += pow(max(dot(N, H2), 0.0), 44.0) * uSpecular * 0.22;
  col += fresnel * uRim * vec3(0.86, 0.90, 1.0);

  // aerial perspective: the small far shapes dissolve into the plate they float over
  float haze = smoothstep(uHazeNear, uHazeFar, -vViewPos.z);
  col = mix(col, texture2D(uBackdrop, screenUV).rgb, haze * 0.7);
  gl_FragColor = vec4(col, 1.0);
}`;
