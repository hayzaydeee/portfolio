// Ported from ThreeUI Emerald Horizon (MIT). Changes: raw WebGL instead of three r128,
// resolution in drawing-buffer pixels (the original divided device-pixel gl_FragCoord by
// CSS-pixel resolution, so hi-DPI screens rendered the wrong region), palette uniforms
// instead of a hue-rotate filter, rise / lift terms for scripted entrances, and a soft
// saturation curve for room palettes.
export const EMERALD_HORIZON_FRAGMENT = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_wave_scale;
uniform float u_variation;
uniform float u_glow;
uniform float u_vignette;
uniform float u_brightness;
uniform float u_rise;
uniform float u_lift;
uniform vec3 u_base;
uniform vec3 u_glow_a;
uniform vec3 u_glow_b;
uniform float u_tonemap; // 0: authored additive (clips), 1: hue-preserving soft saturation

float hash(float n) { return fract(sin(n) * 1e4); }
float noise(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), u);
}

void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  // rise 0 pushes the horizon below the frame; lift raises it for section framing
  float yPos = st.y + (1.0 - u_rise) * 0.65 - u_lift;
  float wave1 = sin(st.x * 3.0 + u_time * 0.5) * 0.1 * u_wave_scale;
  float wave2 = sin(st.x * 5.0 - u_time * 0.3) * 0.05 * u_wave_scale;
  float intensity = smoothstep(0.4, -0.1, yPos + wave1 + wave2);
  float variation = noise(st.x * 2.0 + u_time * 0.1) * 0.5 + 0.5;
  intensity *= variation * 1.5 * u_variation;

  vec3 color = u_base;
  vec3 glow = mix(u_glow_a, u_glow_b, clamp(st.x + sin(u_time * 0.2) * 0.5, 0.0, 1.0));
  float energy = pow(max(intensity, 0.0), 1.5) * 1.2 * u_glow;
  // Room palettes are lighter than the authored neon, so plain addition clips to white;
  // the soft curve approaches 1.3x the glow colour instead
  color += mix(glow * energy, glow * 1.3 * (1.0 - exp(-energy)), u_tonemap);

  float vignette = mix(1.0, smoothstep(1.2, 0.5, length(st - vec2(0.5, 0.0))), u_vignette);
  color = mix(u_base, color, vignette);
  gl_FragColor = vec4(color * u_brightness, 1.0);
}
`;
