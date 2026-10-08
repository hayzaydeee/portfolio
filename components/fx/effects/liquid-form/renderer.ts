import { IcosahedronGeometry, Mesh, PerspectiveCamera, Scene, ShaderMaterial, Vector2, Vector3 } from "three";
import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB } from "@/components/fx/runtime/palette";
import { createRenderer, raw, sizeRenderer } from "@/components/fx/runtime/three";
import { FORM_FRAGMENT, FORM_VERTEX } from "./shaders";
import type { LiquidFormOptions } from "./meta";

/**
 * Port of ThreeUI's Liquid Form (Velox, MIT, Meng To) to a mesh in three: the original's
 * camera, noise and studio lighting, with the form drawn as a displaced icosphere instead of
 * ray-marched per pixel. The canvas is transparent, so the form floats over the room.
 *
 * Added: the music swells the morph with its loudness, and a kick pushes it a little further
 * for a moment.
 */

type Lights = { ambient: RGB; key: RGB; rim: RGB; fill: RGB; panel: RGB; spec: RGB };

// The original's studio, as published
const SOURCE: Lights = {
  ambient: [0.03, 0.03, 0.03],
  key: [0.95, 0.93, 0.9],
  rim: [0.4, 0.42, 0.45],
  fill: [0.2, 0.2, 0.2],
  panel: [0.15, 0.15, 0.15],
  spec: [1, 1, 1],
};

const lean = (from: RGB, to: RGB, t: number): RGB => mixRGB(from, to, t);
const scale = ([r, g, b]: RGB, k: number): RGB => [r * k, g * k, b * k];

/** The original's lights, each leaned toward a room colour by `t` */
function roomLights(p: RoomPalette, t: number): Lights {
  return {
    ambient: lean(SOURCE.ambient, scale(p.deep, 0.5), t),
    key: lean(SOURCE.key, mixRGB(p.text, p.glow, 0.25), t),
    rim: lean(SOURCE.rim, scale(p.accent, 1.1), t),
    fill: lean(SOURCE.fill, scale(p.glow, 0.45), t),
    panel: lean(SOURCE.panel, scale(p.warm, 0.3), t),
    spec: lean(SOURCE.spec, mixRGB([1, 1, 1], p.text, 0.5), t),
  };
}

/** The ray-marcher's lens: a focal length of one for the frame's shorter side */
const halfFovFor = (w: number, h: number) => Math.atan(0.5 * (h / Math.min(w, h)));

export function create(ctx: FxContext, initial: LiquidFormOptions): FxInstance<LiquidFormOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const renderer = createRenderer(ctx, { alpha: true });
  renderer.setClearColor(0x000000, 0);

  const uniforms = {
    uTime: { value: 0 },
    uMorph: { value: opts.morph },
    uNoiseScale: { value: opts.noiseScale },
    uMouse: { value: new Vector2() },
    uMetal: { value: opts.metal },
    uAmbient: { value: raw(SOURCE.ambient) },
    uKey: { value: raw(SOURCE.key) },
    uRimLight: { value: raw(SOURCE.rim) },
    uFill: { value: raw(SOURCE.fill) },
    uPanel: { value: raw(SOURCE.panel) },
    uSpec: { value: raw(SOURCE.spec) },
  };
  const material = new ShaderMaterial({ uniforms, vertexShader: FORM_VERTEX, fragmentShader: FORM_FRAGMENT });
  const geometry = new IcosahedronGeometry(1, 40);
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const camera = new PerspectiveCamera(50, 1, 0.1, 50);
  const lookAt = new Vector3();

  let w = 1;
  let h = 1;
  let time = 0;
  let still = false;
  let swell = 0;
  let kick = 0;
  let sounding = false;
  // The original eased its pointer by 5% a frame
  const mouse = new Vector2();
  const aim = new Vector2();

  const recolour = () => {
    const l = opts.sourcePalette ? SOURCE : roomLights(palette, opts.tint);
    raw(l.ambient, uniforms.uAmbient.value);
    raw(l.key, uniforms.uKey.value);
    raw(l.rim, uniforms.uRimLight.value);
    raw(l.fill, uniforms.uFill.value);
    raw(l.panel, uniforms.uPanel.value);
    raw(l.spec, uniforms.uSpec.value);
  };
  recolour();

  const draw = () => {
    uniforms.uTime.value = time * 0.8;
    uniforms.uMorph.value = opts.morph * (1 + swell * 0.9 + kick * 0.5);
    uniforms.uNoiseScale.value = opts.noiseScale;
    uniforms.uMetal.value = opts.metal;
    uniforms.uMouse.value.copy(mouse);
    const m = opts.mouseAmount;
    camera.position.set(0, 0, opts.camera);
    camera.lookAt(lookAt.set(mouse.x * m, mouse.y * m, 0));
    renderer.render(scene, camera);
  };

  return {
    resize(cssW, cssH, pr) {
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      sizeRenderer(renderer, w, h, pr);
      camera.aspect = w / h;
      camera.fov = (halfFovFor(w, h) * 2 * 180) / Math.PI;
      camera.updateProjectionMatrix();
      if (still) draw();
    },

    render(now, dt) {
      const s = Math.min(64, dt) / 1000;
      time += s * opts.speed;

      const frame = ctx.audio?.(now) ?? null;
      const playing = !!frame?.playing;
      if (playing !== sounding) {
        sounding = playing;
        if (playing) ctx.canvas.dataset.audio = "1";
        else delete ctx.canvas.dataset.audio;
      }
      const want = playing && frame ? Math.min(1, frame.rms * 3 * opts.audioGain) : 0;
      swell += (want - swell) * (1 - Math.pow(want > swell ? 0.01 : 0.2, s));
      if (playing && frame && frame.onset > 0) kick = Math.min(1, opts.audioGain);
      kick *= Math.pow(0.05, s);

      const p = ctx.pointer();
      aim.set(p.inside ? (p.x / w) * 2 - 1 : 0, p.inside ? -((p.y / h) * 2 - 1) : 0);
      mouse.lerp(aim, 1 - Math.pow(0.95, dt / 16.67));
      draw();
    },

    update(next) {
      opts = { ...opts, ...next };
      recolour();
      if (still) draw();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      if (still) draw();
    },

    still() {
      still = true;
      time = 4;
      draw();
    },

    dispose() {
      delete ctx.canvas.dataset.audio;
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
