import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  Scene,
  SphereGeometry,
  Vector2,
} from "three";
import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB, resolveToken } from "@/components/fx/runtime/palette";
import { seeded } from "@/components/fx/runtime/random";
import { createPointsMaterial, createRenderer, raw, sizeRenderer } from "@/components/fx/runtime/three";
import type { OrbitalSphereOptions } from "./meta";

/**
 * Port of ThreeUI's Orbital Sphere (MIT, Meng To) from three r128 to r186. Same scene: 15,000
 * points on a Fibonacci sphere of radius 2.2, pushed out and coloured by an interference
 * pattern (the troughs dropped), six tilted orbit rings with a slight wobble, and a moon in a
 * halo on every other ring. Wide frames set it to the right as the original does, now at the
 * same fraction of any frame's width, so a banner keeps it clear of the title.
 */

const RADIUS = 2.2;
const COUNT = 15000;
const RINGS = 6;
const RING_STEPS = 90;
const FOV = 45;
const hex = (n: number): RGB => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
const SOURCE = {
  bg: hex(0x050607),
  low: hex(0x701a75),
  high: hex(0xa78bfa),
  ring: hex(0x8b5cf6),
  moon: hex(0xd946ef),
  halo: hex(0xc084fc),
};

type Colours = typeof SOURCE;

export function create(ctx: FxContext, initial: OrbitalSphereOptions): FxInstance<OrbitalSphereOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const renderer = createRenderer(ctx);
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 1000);
  const rand = seeded(1729);

  // place (layout) > lean (pointer) > spin (the original's turning group)
  const place = new Group();
  const lean = new Group();
  const spin = new Group();
  place.add(lean);
  lean.add(spin);
  scene.add(place);

  // Surface: keep the crests, remember how far each point leans toward the bright colour
  const xyz: number[] = [];
  const mix: number[] = [];
  for (let e = 0; e < COUNT; e++) {
    const phi = Math.acos(-1 + (2 * e) / COUNT);
    const theta = Math.sqrt(COUNT * Math.PI) * phi;
    const x = RADIUS * Math.cos(theta) * Math.sin(phi);
    const y = RADIUS * Math.sin(theta) * Math.sin(phi);
    const z = RADIUS * Math.cos(phi);
    const wave = Math.sin(x * 3.5) * Math.cos(y * 3.5) * Math.sin(z * 3.5) + Math.cos(x * 6) * 0.4;
    if (wave <= -0.1) continue;
    const push = 1 + wave * 0.1;
    xyz.push(x * push, y * push, z * push);
    mix.push(wave > 0.5 ? 1 : 0.3);
  }
  const surface = new BufferGeometry();
  surface.setAttribute("position", new Float32BufferAttribute(xyz, 3));
  const colours = new Float32Array(mix.length * 3);
  const colourAttr = new BufferAttribute(colours, 3);
  surface.setAttribute("color", colourAttr);
  const pointsMaterial = createPointsMaterial({ vertexColors: true });
  spin.add(new Points(surface, pointsMaterial));

  const ringMaterial = new LineBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false });
  const moonGeometry = new SphereGeometry(0.025, 16, 16);
  const haloGeometry = new SphereGeometry(0.08, 16, 16);
  const moonMaterial = new MeshBasicMaterial();
  const haloMaterial = new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false });
  const ringGeometries: BufferGeometry[] = [];
  const rings: { line: Line; turn: number }[] = [];
  for (let e = 0; e < RINGS; e++) {
    const r = RADIUS * (1.08 + rand() * 0.2);
    const pts: number[] = [];
    for (let s = 0; s <= RING_STEPS; s++) {
      const a = (s / RING_STEPS) * Math.PI * 2;
      pts.push(Math.cos(a) * r, Math.sin(a) * r, Math.sin(a * 4) * 0.1);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(pts, 3));
    ringGeometries.push(geometry);
    const line = new Line(geometry, ringMaterial);
    line.rotation.x = rand() * Math.PI * 2;
    line.rotation.y = rand() * Math.PI * 2;
    spin.add(line);
    // The original turned children by their index in the group (the points are child 0)
    rings.push({ line, turn: (e + 1) % 2 === 0 ? 1 : -1 });
    if (e % 2 !== 0) {
      const moon = new Mesh(moonGeometry, moonMaterial);
      const a = rand() * Math.PI * 2;
      moon.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      moon.add(new Mesh(haloGeometry, haloMaterial));
      line.add(moon);
    }
  }

  let still = false;
  let fit = 1;
  const buffer = new Vector2();

  const palettes = (): Colours => {
    if (opts.sourcePalette) return SOURCE;
    const high = opts.accent ? resolveToken(opts.accent) : palette.glow;
    return {
      bg: palette.base,
      low: palette.deep,
      high,
      ring: mixRGB(high, palette.deep, 0.35),
      moon: mixRGB(high, palette.text, 0.5),
      halo: high,
    };
  };

  const recolour = () => {
    const c = palettes();
    renderer.setClearColor(raw(c.bg), 1);
    for (let i = 0; i < mix.length; i++) colours.set(mixRGB(c.low, c.high, mix[i]), i * 3);
    colourAttr.needsUpdate = true;
    raw(c.ring, ringMaterial.color);
    raw(c.moon, moonMaterial.color);
    raw(c.halo, haloMaterial.color);
  };

  const apply = () => {
    pointsMaterial.uniforms.uSize.value = opts.particleSize;
    pointsMaterial.uniforms.uOpacity.value = opts.particleOpacity;
    ringMaterial.opacity = opts.orbitOpacity;
    haloMaterial.opacity = opts.haloOpacity;
    place.scale.setScalar(fit * opts.scale);
  };

  const draw = () => {
    renderer.getDrawingBufferSize(buffer);
    pointsMaterial.uniforms.uHeight.value = buffer.y;
    pointsMaterial.uniforms.uScale.value = buffer.y / 2;
    renderer.render(scene, camera);
  };

  recolour();
  apply();

  return {
    resize(w, h, pr) {
      sizeRenderer(renderer, w, h, pr);
      camera.aspect = w / Math.max(1, h);
      if (w >= 1024) {
        camera.position.z = 5.5;
        place.position.z = -2;
        fit = 1.15;
        // The original's x of 2.5 is half the visible half-width at 16:10; keep that fraction
        const depth = camera.position.z - place.position.z;
        const halfWidth = depth * Math.tan(((FOV / 2) * Math.PI) / 180) * camera.aspect;
        place.position.x = halfWidth * 0.5;
        place.position.y = 0;
      } else {
        camera.position.z = 6.5;
        place.position.set(0, -1, -3);
        fit = 1;
      }
      camera.updateProjectionMatrix();
      apply();
      if (still) draw();
    },

    render(_now, dt) {
      const frames = Math.min(50, dt) / 16.67;
      spin.rotation.y += 8e-4 * opts.speed * frames;
      spin.rotation.x += 3e-4 * opts.speed * frames;
      for (const { line, turn } of rings) line.rotation.z += 4e-4 * opts.speed * turn * frames;
      const p = ctx.pointer();
      const tx = p.inside ? (p.x / Math.max(1, ctx.canvas.clientWidth) - 0.5) * 0.6 * opts.parallax : 0;
      const ty = p.inside ? (p.y / Math.max(1, ctx.canvas.clientHeight) - 0.5) * 0.4 * opts.parallax : 0;
      const ease = 1 - Math.pow(0.92, frames);
      lean.rotation.y += (tx - lean.rotation.y) * ease;
      lean.rotation.x += (ty - lean.rotation.x) * ease;
      draw();
    },

    update(next) {
      opts = { ...opts, ...next };
      recolour();
      apply();
      if (still) draw();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      if (still) draw();
    },

    still() {
      still = true;
      spin.rotation.set(0.2, 0.7, 0);
      draw();
    },

    dispose() {
      surface.dispose();
      pointsMaterial.dispose();
      ringGeometries.forEach((g) => g.dispose());
      ringMaterial.dispose();
      moonGeometry.dispose();
      haloGeometry.dispose();
      moonMaterial.dispose();
      haloMaterial.dispose();
      renderer.dispose();
    },
  };
}
