import { BufferAttribute, BufferGeometry, Group, PerspectiveCamera, Points, Scene, Vector2 } from "three";
import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { resolveToken } from "@/components/fx/runtime/palette";
import { seeded } from "@/components/fx/runtime/random";
import { createPointsMaterial, createRenderer, raw, sizeRenderer } from "@/components/fx/runtime/three";
import type { StructureFlowOptions } from "./meta";

/**
 * Port of ThreeUI's Structure Flow (MIT, Meng To) from three r128 to r186. Same scene: 15,000
 * points on the upper cap of a sphere of radius 25 sunk 20 below the origin, seen from (0, 5,
 * 30) through a 60° lens, turning about y and z. The original's wrapper faded the top of the
 * canvas with a CSS mask and dimmed it to 0.8; both live in the points shader here. Wider than
 * 16:9, the frame is a strip cut from the 16:9 view (crest a third of the way down), so a
 * banner shows the dome's shoulders at full width instead of a sliver of its top.
 */

const COUNT = 15000;
const RADIUS = 25;
const FOV = 60;
const FRAME_ASPECT = 16 / 9;
const WRAPPER_OPACITY = 0.8;
const SOURCE_BG: RGB = [5 / 255, 6 / 255, 7 / 255];
const SOURCE_POINT: RGB = [1, 1, 1];

export function create(ctx: FxContext, initial: StructureFlowOptions): FxInstance<StructureFlowOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const renderer = createRenderer(ctx);
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 1000);
  camera.position.set(0, 5, 30);

  const rand = seeded(2207);
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(rand() * 0.8 + 0.2);
    positions[i * 3] = RADIUS * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = RADIUS * Math.cos(phi) - 20;
    positions[i * 3 + 2] = RADIUS * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = createPointsMaterial();
  const points = new Points(geometry, material);
  const lean = new Group();
  lean.add(points);
  scene.add(lean);

  let still = false;
  let lensScale = 1;

  const recolour = () => {
    const bg = opts.sourcePalette ? SOURCE_BG : palette.base;
    const dot = opts.sourcePalette ? SOURCE_POINT : opts.accent ? resolveToken(opts.accent) : palette.glow;
    renderer.setClearColor(raw(bg), 1);
    material.uniforms.uColor.value = dot;
  };

  const apply = () => {
    material.uniforms.uSize.value = opts.pointSize;
    material.uniforms.uOpacity.value = opts.opacity * WRAPPER_OPACITY;
    material.uniforms.uMask.value = [opts.maskStart, opts.maskSolid];
  };

  const buffer = new Vector2();
  const draw = () => {
    renderer.getDrawingBufferSize(buffer);
    material.uniforms.uHeight.value = buffer.y;
    material.uniforms.uScale.value = (buffer.y / 2) * lensScale;
    renderer.render(scene, camera);
  };

  recolour();
  apply();

  return {
    resize(w, h, pr) {
      sizeRenderer(renderer, w, h, pr);
      const aspect = w / Math.max(1, h);
      if (aspect > FRAME_ASPECT) {
        const frameH = w / FRAME_ASPECT;
        const top = Math.min(frameH - h, Math.max(0, frameH * 0.5 - h * 0.35));
        camera.setViewOffset(w, frameH, 0, top, w, h);
        // Points size against the full frame's height, as the dome does
        lensScale = frameH / h;
      } else {
        camera.clearViewOffset();
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        lensScale = 1;
      }
      if (still) draw();
    },

    render(_now, dt) {
      const frames = Math.min(50, dt) / 16.67;
      points.rotation.y += 8e-4 * opts.speed * frames;
      points.rotation.z += 2e-4 * opts.speed * frames;
      const p = ctx.pointer();
      const tx = p.inside ? (p.x / Math.max(1, ctx.canvas.clientWidth) - 0.5) * 0.5 * opts.parallax : 0;
      const ty = p.inside ? (p.y / Math.max(1, ctx.canvas.clientHeight) - 0.5) * 0.2 * opts.parallax : 0;
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
      points.rotation.set(0, 0.6, 0.15);
      draw();
    },

    dispose() {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
