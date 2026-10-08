import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { createProgram, getGL } from "@/components/fx/runtime/gl";
import { mixRGB } from "@/components/fx/runtime/palette";
import type { ShaderToggleOptions } from "./meta";

/**
 * Port of ThreeUI's Skeuomorphic Toggle, "shader" style, dark mode (MIT, Meng To). Same
 * fragment shader: a capsule trough of domain-warped plasma, ridged threads, brushed
 * striations, interference bands and 64 drifting sparks, a three-lamp metal thumb whose key
 * light leans toward the pointer, contact shadow, bloom, grain. Its blues and violets become
 * room roles (uniforms), the stage paints in the room's base so it sits flush in a bar, and
 * the control fills the canvas instead of a fraction of a large stage. The thumb runs the
 * original's critically damped spring toward `on`.
 */

const VERT = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;

const FRAG = (derivatives: boolean) => `${derivatives ? "#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIVATIVES\n" : ""}
precision highp float;
uniform vec2 uRes;
uniform float uUnit;
uniform float uTime;
uniform float uOn;
uniform float uProgress;
uniform vec2 uPointer;
uniform vec3 uAccent;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform vec3 uSpark;
uniform vec3 uDormant;
uniform vec3 uStageTop;
uniform vec3 uStageBottom;
uniform vec3 uThumb;

const float R = 1.0;
const float L = 1.35;
const float TH = 0.78;
const float PI = 3.14159265359;

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453123); }
vec2 hash21(float n) { return fract(sin(vec2(n * 127.1, n * 311.7)) * 43758.5453123); }
float hash22(vec2 co) { return fract(sin(dot(mod(co, 512.0), vec2(12.9898, 78.233))) * 43758.5453123); }

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash11(i.x + i.y * 57.0);
  float b = hash11(i.x + 1.0 + i.y * 57.0);
  float c = hash11(i.x + (i.y + 1.0) * 57.0);
  float d = hash11(i.x + 1.0 + (i.y + 1.0) * 57.0);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) { value += amplitude * valueNoise(p); p = p * 2.03 + 11.3; amplitude *= 0.5; }
  return value;
}
float ridged(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(valueNoise(p) * 2.0 - 1.0);
    value += amplitude * n * n;
    p = p * 2.11 + 7.7;
    amplitude *= 0.5;
  }
  return value;
}
vec2 warp(vec2 p, float t) {
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.12)), fbm(p + vec2(5.2, 1.3) - t * 0.09));
  vec2 r = vec2(fbm(p + 3.4 * q + vec2(1.7, 9.2)), fbm(p + 3.4 * q + vec2(8.3, 2.8)));
  return p + 0.42 * r;
}
float sdCapsule(vec2 p, float halfLength, float radius) {
  p.x -= clamp(p.x, -halfLength, halfLength);
  return length(p) - radius;
}
float fw(float d) {
#ifdef HAS_DERIVATIVES
  return max(fwidth(d), 1e-5);
#else
  return 1.6 / uUnit;
#endif
}
float fill(float d) { float w = fw(d) * 0.72; return smoothstep(w, -w, d); }
float stroke(float d, float halfWidth) { float w = fw(d) * 0.8; return smoothstep(halfWidth + w, halfWidth - w, abs(d)); }
float capsuleHalo(vec2 p, float spread) { return exp(-max(0.0, sdCapsule(p, L, R)) * spread); }

void main() {
  vec2 frag = gl_FragCoord.xy - 0.5 * uRes;
  vec2 p = frag / uUnit;
  vec2 screen = frag / max(uRes.x, uRes.y);
  float energy = mix(0.16, 1.0, uOn);

  vec3 accent = uAccent;
  vec3 accentWarm = uWarm;
  vec3 accentCool = uCool;
  vec3 sparkColor = uSpark;
  vec3 dormant = uDormant;

  vec3 color = mix(uStageBottom, uStageTop, smoothstep(-0.55, 0.55, screen.y));
  vec2 lattice = fract(p * 1.8) - 0.5;
  float dots = smoothstep(0.09, 0.02, length(lattice));
  color += dots * 0.05 * accent;

  float haloR = capsuleHalo(p * 0.985, 1.35);
  float haloG = capsuleHalo(p, 1.5);
  float haloB = capsuleHalo(p * 1.015, 1.65);
  vec3 halo = vec3(haloR, haloG, haloB) * mix(accent, accentWarm, 0.35);
  color += halo * energy * 0.3;

  float d = sdCapsule(p, L, R);
  float inside = fill(d);

  vec2 flowP = vec2(p.x * 0.72 - uTime * 0.3, p.y * 1.25);
  vec2 w = warp(flowP, uTime);
  float plasma = fbm(w * 1.5);
  float threads = ridged(vec2(w.x * 2.2, w.y * 3.4 + uTime * 0.16));
  float brushed = 0.5 + 0.5 * sin(p.y * 74.0 + fbm(w * 3.0) * 9.0);
  brushed *= 0.5 + 0.5 * valueNoise(vec2(p.x * 26.0, p.y * 4.0));
  float caustic = pow(abs(sin(w.x * 3.6 - uTime * 1.5 + threads * 2.4)), 9.0);
  vec2 cell = fract(p * vec2(22.0, 19.0)) - 0.5;
  float micro = stroke(length(cell) - 0.2, 0.035);
  float streak = pow(max(0.0, sin(p.x * 2.1 - uTime * 2.6 + plasma * 3.4)), 7.0);

  vec3 interior = mix(dormant, mix(accent, accentWarm, plasma * 0.42), uOn);
  interior *= mix(0.24, 0.86, plasma) * energy;
  interior += mix(accentCool, vec3(1.0), 0.25) * threads * threads * uOn * 0.15;
  interior += mix(accent, vec3(1.0), 0.35) * caustic * uOn * 0.2;
  interior += accentCool * micro * 0.05 * energy;
  interior *= 0.82 + 0.18 * brushed;
  interior += mix(accent, vec3(1.0), 0.35) * streak * uOn * 0.34;

  vec3 restColor = dormant * 0.2 * (0.72 + 0.4 * plasma);
  restColor += accentCool * micro * 0.045;
  restColor *= 0.88 + 0.12 * brushed;
  interior = mix(restColor, interior, uOn);
  float trough = smoothstep(-R, R * 0.35, p.y);
  interior *= mix(0.42, 1.2, trough);
  color = mix(color, interior, inside);

  color *= 1.0 - stroke(d - 0.028, 0.026) * 0.3;
  vec3 rimColor = mix(accent, vec3(1.0), 0.28);
  color += rimColor * stroke(d, 0.013) * 0.66 * energy;
  float bevel = stroke(d + 0.062, 0.02) * smoothstep(-0.35, 0.85, p.y / R);
  color += mix(accentCool, vec3(1.0), 0.5) * bevel * 0.34 * energy;
  color += rimColor * exp(-abs(d) * 18.0) * 0.13 * energy * inside;

  vec3 sparks = vec3(0.0);
  for (int i = 0; i < 64; i++) {
    float fi = float(i);
    vec2 h = hash21(fi + 3.7);
    float phase = hash11(fi * 7.13 + 1.7);
    float weight = hash11(fi * 3.31 + 5.9);
    float life = fract(uTime * (0.2 + h.x * 0.42) * mix(0.35, 1.0, uOn) + phase);
    float x = mix(-L - R * 0.55, L + R * 0.55, life);
    float y = (h.y - 0.5) * 1.52 * (0.32 + 0.68 * sin(life * PI)) + sin(life * 6.4 + fi) * 0.06;
    vec2 sp = p - vec2(x, y);
    sp.x *= 0.45;
    float fade = sin(life * PI);
    float grain = 1500.0 + 5200.0 * weight;
    float core = exp(-dot(sp, sp) * grain * 3.0);
    float tail = exp(-dot(sp, sp) * grain);
    float brightness = 0.35 + 0.65 * weight;
    sparks += mix(sparkColor, vec3(1.0), 0.6 * fade) * (tail * 0.55 + core) * fade * brightness;
  }
  color += sparks * mix(0.3, 1.15, uOn) * 1.15 * inside;

  float thumbX = mix(-L, L, uProgress);
  vec2 tp = p - vec2(thumbX, 0.0);
  float td = length(tp) - TH;
  float thumbIn = fill(td);
  vec2 disc = tp / TH;
  float discLength = min(1.0, length(disc));
  vec3 normal = normalize(vec3(disc, sqrt(max(1e-4, 1.0 - discLength * discLength))));
  vec2 shellUv = vec2(atan(normal.y, normal.x) * 1.6, normal.z * 2.4);
  float relief = valueNoise(shellUv * 15.0) * 0.6 + valueNoise(shellUv * 41.0) * 0.4;
  vec3 bumped = normalize(normal + vec3((relief - 0.5) * 0.035, (relief - 0.5) * 0.035, 0.0));
  vec3 light = normalize(vec3(-0.42 + uPointer.x * 0.35, 0.58 + uPointer.y * 0.35, 0.8));
  vec3 fillDir = normalize(vec3(0.62, -0.28, 0.55));
  vec3 rimDir = normalize(vec3(0.34, 0.5, -0.72));
  float diffuse = max(0.0, dot(bumped, light));
  float specular = pow(max(0.0, dot(reflect(-light, bumped), vec3(0.0, 0.0, 1.0))), 120.0);
  vec3 stretched = normalize(vec3(bumped.x * 0.28, bumped.y, bumped.z));
  float sheen = pow(max(0.0, dot(reflect(-light, stretched), vec3(0.0, 0.0, 1.0))), 16.0);
  float fillTerm = max(0.0, dot(bumped, fillDir));
  float rimTerm = pow(max(0.0, dot(bumped, rimDir)), 2.2) * pow(1.0 - max(0.0, normal.z), 1.6);
  float fresnel = pow(1.0 - max(0.0, normal.z), 2.6);

  vec3 thumbColor = uThumb * (0.17 + 0.86 * diffuse * diffuse);
  thumbColor += uThumb * mix(accentCool, vec3(1.0), 0.35) * fillTerm * 0.3;
  thumbColor += mix(accentCool, vec3(1.0), 0.5) * rimTerm * 0.55;
  thumbColor *= 0.975 + 0.05 * relief;
  thumbColor += mix(accent, accentWarm, 0.4) * fresnel * 0.6 * energy;
  thumbColor += vec3(1.0) * specular * 1.6;
  thumbColor += mix(vec3(1.0), accentCool, 0.35) * sheen * 0.13;
  thumbColor += mix(accent, accentWarm, 0.6) * uOn * 0.1;
  thumbColor += accentCool * smoothstep(0.2, -0.9, disc.y) * uOn * 0.16;
  thumbColor = thumbColor / (1.0 + thumbColor * 0.22);

  float contact = exp(-dot(tp * vec2(0.8, 1.6), tp * vec2(0.8, 1.6)) * 1.9);
  color *= 1.0 - contact * 0.42 * inside;
  color = mix(color, thumbColor, thumbIn);
  color += mix(vec3(1.0), accentCool, 0.4) * stroke(td, 0.01) * 0.26;
  color += mix(accent, accentWarm, 0.35) * exp(-max(0.0, td) * 7.0) * uOn * 0.22 * inside;

  color *= mix(0.86, 1.0, smoothstep(1.0, 0.2, length(screen * vec2(1.0, 1.25))));
  float grain = hash22(gl_FragCoord.xy + vec2(mod(uTime * 61.0, 512.0), mod(uTime * 37.0, 512.0)));
  color += (grain - 0.5) * 0.03;
  gl_FragColor = vec4(max(color, 0.0), 1.0);
}`;

type Roles = { accent: RGB; warm: RGB; cool: RGB; spark: RGB; dormant: RGB; top: RGB; bottom: RGB; thumb: RGB };

// The original's dark-mode constants
const SOURCE: Roles = {
  accent: [0.24, 0.55, 1.0],
  warm: [0.62, 0.32, 1.0],
  cool: [0.36, 0.86, 1.0],
  spark: [0.55, 0.86, 1.0],
  dormant: [0.16, 0.19, 0.25],
  top: [0.055, 0.062, 0.086],
  bottom: [0.016, 0.019, 0.031],
  thumb: [0.78, 0.82, 0.9],
};

const R = 1;
const L = 1.35;

export function create(ctx: FxContext, initial: ShaderToggleOptions): FxInstance<ShaderToggleOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  const gl = getGL(canvas, { antialias: true });
  if (!gl) throw new Error("WebGL unavailable");
  const derivatives = !!gl.getExtension("OES_standard_derivatives");
  const program = createProgram(gl, VERT, FRAG(derivatives));
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPosition = gl.getAttribLocation(program.program, "aPosition");

  let roles: Roles = SOURCE;
  let unit = 1;
  let time = 0;
  let still = false;
  // Spring state: progress chases the target, `on` (the glow) eases after it
  let target = opts.on ? 1 : 0;
  let progress = target;
  let velocity = 0;
  let glow = target;
  let px = 0;
  let py = 0;

  const recolour = () => {
    if (opts.sourcePalette) {
      roles = SOURCE;
      return;
    }
    const p = palette;
    roles = {
      accent: p.glow,
      warm: mixRGB(p.glow, p.warm, 0.5),
      cool: mixRGB(p.glow, p.text, 0.4),
      spark: mixRGB(p.glow, p.text, 0.55),
      dormant: mixRGB(p.surface, p.muted, 0.5),
      top: p.base,
      bottom: mixRGB(p.base, [0, 0, 0], 0.35),
      thumb: mixRGB(p.text, [1, 1, 1], 0.2),
    };
  };
  recolour();
  canvas.dataset.on = target ? "1" : "0";

  const draw = () => {
    gl.useProgram(program.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(program.uniform("uRes"), canvas.width, canvas.height);
    gl.uniform1f(program.uniform("uUnit"), unit);
    gl.uniform1f(program.uniform("uTime"), time);
    gl.uniform1f(program.uniform("uOn"), glow);
    gl.uniform1f(program.uniform("uProgress"), progress);
    gl.uniform2f(program.uniform("uPointer"), px, py);
    gl.uniform3fv(program.uniform("uAccent"), roles.accent);
    gl.uniform3fv(program.uniform("uWarm"), roles.warm);
    gl.uniform3fv(program.uniform("uCool"), roles.cool);
    gl.uniform3fv(program.uniform("uSpark"), roles.spark);
    gl.uniform3fv(program.uniform("uDormant"), roles.dormant);
    gl.uniform3fv(program.uniform("uStageTop"), roles.top);
    gl.uniform3fv(program.uniform("uStageBottom"), roles.bottom);
    gl.uniform3fv(program.uniform("uThumb"), roles.thumb);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    resize(cssW, cssH, pr) {
      canvas.width = Math.max(1, Math.round(cssW * pr));
      canvas.height = Math.max(1, Math.round(cssH * pr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      // The capsule (and its halo) fills the canvas, whichever side binds first
      unit = Math.min(canvas.height / (2 * R * 1.3), canvas.width / (2 * (L + R) * 1.12));
      if (still) draw();
    },

    render(_now, dt) {
      const n = Math.min(0.05, dt / 1000);
      time += n * opts.speed;
      // The original's spring: stiffness 165, critically damped
      const k = 165;
      const c = 2 * Math.sqrt(k);
      velocity += (target - progress) * k * n - velocity * c * n;
      progress += velocity * n;
      glow += (target - glow) * Math.min(1, n * 5.5);
      const p = ctx.pointer();
      const tx = p.inside ? (p.x / Math.max(1, canvas.clientWidth)) * 2 - 1 : 0;
      const ty = p.inside ? -((p.y / Math.max(1, canvas.clientHeight)) * 2 - 1) : 0;
      px += (tx - px) * Math.min(1, n * 3.4);
      py += (ty - py) * Math.min(1, n * 3.4);
      draw();
    },

    update(next) {
      opts = { ...opts, ...next };
      target = opts.on ? 1 : 0;
      canvas.dataset.on = target ? "1" : "0";
      recolour();
      if (still) {
        progress = glow = target;
        draw();
      }
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      if (still) draw();
    },

    still() {
      still = true;
      progress = glow = target;
      time = 2.4;
      draw();
    },

    dispose() {
      delete canvas.dataset.on;
      gl.deleteBuffer(buffer);
      program.dispose();
    },
  };
}
