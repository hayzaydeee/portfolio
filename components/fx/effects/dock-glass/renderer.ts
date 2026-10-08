import {
  BufferGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from "three";
import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB } from "@/components/fx/runtime/palette";
import { createRenderer, raw, sizeRenderer } from "@/components/fx/runtime/three";
import { BACKDROP_FRAGMENT, BACKDROP_VERTEX, GLASS_FRAGMENT, GLASS_VERTEX } from "./shaders";
import type { DockGlassOptions } from "./meta";

/**
 * Port of ThreeUI Animated Top Dock's glass particle field (MIT, Meng To), in three as the
 * original was: spheres, an icosahedron and a torus of glass at different depths, each
 * refracting a bloom backdrop per colour channel, catching two specular keys and a fresnel
 * rim, the far ones hazing into the plate. The group leans toward the pointer.
 *
 * The original laid its shapes out for a wide top bar. The studio's rail is tall and narrow
 * on desktop and wide on phones, so the layout is drawn from the original's generator in the
 * visible frame instead, its sizes scaled to the frame's short side, and redrawn when the
 * frame changes shape.
 */

type Blooms = { base: RGB; a: RGB; b: RGB; c: RGB; d: RGB; p: RGB };

const SOURCE: Blooms = {
  base: [0.085, 0.095, 0.125],
  a: [0.24, 0.42, 0.96],
  b: [0.66, 0.3, 0.88],
  c: [0.14, 0.68, 0.7],
  d: [0.98, 0.6, 0.4],
  p: [0.74, 0.78, 0.96],
};

const scale = ([r, g, b]: RGB, k: number): RGB => [r * k, g * k, b * k];

/**
 * Room blooms sit well below the original's: its plate is a showcase backdrop, ours sits
 * behind nav labels. The base is lifted off the room's near-black all the same, since
 * refraction turns black regions into dark holes.
 */
function roomBlooms(p: RoomPalette): Blooms {
  return {
    base: mixRGB(mixRGB(p.base, p.deep, 0.7), p.glow, 0.06),
    a: scale(p.accent, 0.9),
    b: scale(p.glow, 0.5),
    c: scale(p.warm, 0.32),
    d: scale(mixRGB(p.text, p.glow, 0.5), 0.22),
    p: scale(p.text, 0.28),
  };
}

const MAX = 34;
const LARGE = 8;
const CAMERA_Z = 7.4;
const FOV = 42;
/** The half height the original's sizes were authored against: its bar, at z 0 */
const AUTHORED_HALF = CAMERA_Z * Math.tan(((FOV / 2) * Math.PI) / 180);
const TINTS: RGB[] = [
  [1.04, 1, 1.02],
  [0.97, 1, 1.06],
  [1.05, 0.99, 0.97],
];

/**
 * The original widened its lens for a frame taller than wide. Its shapes sat near the middle
 * of a wide bar; ours fill the frame, so the long side's angle is capped too, or shapes at
 * the ends of the phone's bar stretch into discs.
 */
const MAX_SPAN = 60;
function lensFor(aspect: number): number {
  const deg = Math.PI / 180;
  if (aspect >= 1) return Math.min(FOV, (2 * Math.atan(Math.tan((MAX_SPAN / 2) * deg) / aspect)) / deg);
  return Math.min(MAX_SPAN, FOV / Math.max(0.62, aspect));
}

/** The original's LCG and seed, so a frame of a given shape always holds the same field */
function lcg(seed: number) {
  let h = seed;
  return () => {
    h = (h * 1664525 + 1013904223) % 4294967296;
    return h / 4294967296;
  };
}

type Shape = {
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  origin: Vector3;
  /** The original's radius, which also sets how thick the glass reads */
  size: number;
  bob: number;
  phase: number;
  spin: Vector3;
};

export function create(ctx: FxContext, initial: DockGlassOptions): FxInstance<DockGlassOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const renderer = createRenderer(ctx);

  const backdropUniforms = {
    uRes: { value: new Vector2(1, 1) },
    uTime: { value: 0 },
    uPointer: { value: new Vector2() },
    uBase: { value: new Color() },
    uBloomA: { value: new Color() },
    uBloomB: { value: new Color() },
    uBloomC: { value: new Color() },
    uBloomD: { value: new Color() },
    uBloomP: { value: new Color() },
  };
  const backdropMaterial = new ShaderMaterial({
    uniforms: backdropUniforms,
    vertexShader: BACKDROP_VERTEX,
    fragmentShader: BACKDROP_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const plane = new PlaneGeometry(2, 2);
  const backdrop = new Scene();
  backdrop.add(new Mesh(plane, backdropMaterial));
  const flat = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const target = new WebGLRenderTarget(2, 2, { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat });

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA_Z);
  const group = new Group();
  scene.add(group);
  const geometries = [new SphereGeometry(1, 44, 30), new IcosahedronGeometry(1, 1), new TorusGeometry(0.78, 0.3, 22, 56)];

  const shapes: Shape[] = [];
  for (let i = 0; i < MAX; i++) {
    const material = new ShaderMaterial({
      uniforms: {
        uBackdrop: { value: target.texture },
        uThickness: { value: 0.1 },
        uDispersion: { value: 0.05 },
        uSpecular: { value: 0.85 },
        uRim: { value: 0.5 },
        uHazeNear: { value: CAMERA_Z },
        uHazeFar: { value: CAMERA_Z + 4 },
        uTint: { value: raw(TINTS[i % TINTS.length]) },
        uLight: { value: new Vector3(-0.45, 0.86, 0.62) },
      },
      vertexShader: GLASS_VERTEX,
      fragmentShader: GLASS_FRAGMENT,
    });
    const large = i < LARGE;
    const geometry = geometries[large ? (i === 3 ? 1 : i === 6 ? 2 : 0) : 0];
    const mesh = new Mesh(geometry, material);
    group.add(mesh);
    shapes.push({ mesh, origin: new Vector3(), size: 0, bob: 0, phase: 0, spin: new Vector3() });
  }

  let w = 1;
  let h = 1;
  let unit = 1;
  let laidOut = 0;
  let elapsed = 0;
  let still = false;
  const pointer = new Vector2();
  const aim = new Vector2();

  /** How many shapes are drawn, for the suite */
  const mark = () => {
    ctx.canvas.dataset.shapes = String(Math.max(4, Math.min(MAX, Math.round(opts.count))));
  };

  /** Draw the field into the visible frame: positions in it, sizes from its short side */
  const layout = () => {
    const halfH = CAMERA_Z * Math.tan(((camera.fov / 2) * Math.PI) / 180);
    const halfW = halfH * camera.aspect;
    unit = Math.min(halfW, halfH) / AUTHORED_HALF;
    const rand = lcg(20260826);
    const placed: { x: number; y: number; r: number }[] = [];
    shapes.forEach((s, i) => {
      const large = i < LARGE;
      s.size = large ? 0.4 + rand() * 0.34 : 0.09 + rand() * 0.18;
      const r = s.size * unit;
      s.mesh.scale.setScalar(r);
      for (let tries = 0; tries < 48; tries++) {
        s.origin.set((rand() - 0.5) * 2 * halfW * 0.92, (rand() - 0.5) * 2 * halfH * 0.9, large ? -1.4 + rand() * 2.6 : -3.6 + rand() * 2.4);
        // Large shapes keep clear of each other; small ones may tuck behind
        if (!large || placed.every((p) => Math.hypot(p.x - s.origin.x, p.y - s.origin.y) > (p.r + r) * 1.25 + 0.3 * unit)) break;
      }
      if (large) placed.push({ x: s.origin.x, y: s.origin.y, r });
      s.mesh.position.copy(s.origin);
      s.mesh.rotation.set(rand() * 6.28, rand() * 6.28, rand() * 6.28);
      s.bob = (0.14 + rand() * 0.34) * unit;
      s.phase = rand() * 6.28;
      s.spin.set((rand() - 0.5) * 0.28, (rand() - 0.5) * 0.34, (rand() - 0.5) * 0.2);
    });
    laidOut = camera.aspect;
  };

  const recolour = () => {
    const c = opts.sourcePalette ? SOURCE : roomBlooms(palette);
    raw(c.base, backdropUniforms.uBase.value);
    raw(c.a, backdropUniforms.uBloomA.value);
    raw(c.b, backdropUniforms.uBloomB.value);
    raw(c.c, backdropUniforms.uBloomC.value);
    raw(c.d, backdropUniforms.uBloomD.value);
    raw(c.p, backdropUniforms.uBloomP.value);
    renderer.setClearColor(raw(c.base), 1);
  };
  recolour();

  const draw = (stepMs: number) => {
    const count = Math.max(4, Math.min(MAX, Math.round(opts.count)));
    const t = elapsed * opts.drift;
    shapes.forEach((s, i) => {
      s.mesh.visible = i < count;
      if (!s.mesh.visible) return;
      const u = s.mesh.material.uniforms;
      u.uThickness.value = opts.thickness * (0.55 + s.size * 0.9);
      u.uDispersion.value = opts.dispersion;
      u.uSpecular.value = opts.specular;
      u.uRim.value = opts.rim;
      s.mesh.position.set(
        s.origin.x + Math.sin(t * 0.21 + s.phase) * s.bob * 0.9,
        s.origin.y + Math.cos(t * 0.27 + s.phase * 1.3) * s.bob,
        s.origin.z + Math.sin(t * 0.17 + s.phase * 0.7) * s.bob * 0.5
      );
      // the original turned each shape a fixed step per frame; per 16.7 ms here
      const turn = 0.0075 * opts.drift * (stepMs / 16.67);
      s.mesh.rotation.x += s.spin.x * turn;
      s.mesh.rotation.y += s.spin.y * turn;
      s.mesh.rotation.z += s.spin.z * turn;
    });
    group.rotation.y = pointer.x * 0.14;
    group.rotation.x = -pointer.y * 0.1;
    group.position.x = pointer.x * 0.28 * unit;
    group.position.y = pointer.y * 0.2 * unit;
    backdropUniforms.uTime.value = elapsed;
    backdropUniforms.uPointer.value.copy(pointer);

    renderer.setRenderTarget(target);
    renderer.render(backdrop, flat);
    renderer.setRenderTarget(null);
    renderer.render(backdrop, flat);
    renderer.autoClear = false;
    renderer.render(scene, camera);
    renderer.autoClear = true;
  };

  return {
    resize(cssW, cssH, pr) {
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      sizeRenderer(renderer, w, h, pr);
      const bw = Math.max(1, Math.round(w * pr));
      const bh = Math.max(1, Math.round(h * pr));
      target.setSize(bw, bh);
      backdropUniforms.uRes.value.set(bw, bh);
      camera.aspect = w / h;
      camera.fov = lensFor(camera.aspect);
      camera.updateProjectionMatrix();
      if (Math.abs(camera.aspect - laidOut) / Math.max(camera.aspect, laidOut, 1e-3) > 0.08) layout();
      mark();
      if (still) draw(0);
    },

    render(_now, dt) {
      elapsed += Math.min(96, dt) / 1000;
      const p = ctx.pointer();
      const tx = p.seen && p.inside ? (p.x / w) * 2 - 1 : 0;
      const ty = p.seen && p.inside ? 1 - (p.y / h) * 2 : 0;
      pointer.lerp(aim.set(tx, ty), 1 - Math.pow(1 - 0.045, dt / 16.67));
      draw(Math.min(96, dt));
    },

    update(next) {
      const recolor = next.sourcePalette !== undefined && next.sourcePalette !== opts.sourcePalette;
      opts = { ...opts, ...next };
      if (recolor) recolour();
      mark();
      if (still) draw(0);
    },

    setPalette(next) {
      palette = next;
      recolour();
      if (still) draw(0);
    },

    still() {
      still = true;
      elapsed = 5;
      draw(0);
    },

    dispose() {
      delete ctx.canvas.dataset.shapes;
      shapes.forEach((s) => s.mesh.material.dispose());
      geometries.forEach((g) => g.dispose());
      plane.dispose();
      backdropMaterial.dispose();
      target.dispose();
      renderer.dispose();
    },
  };
}
