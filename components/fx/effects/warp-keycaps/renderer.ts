import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  Vector2,
  type Color,
} from "three";
import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB, resolveToken } from "@/components/fx/runtime/palette";
import { loadFont, resolveFontFamily } from "@/components/fx/runtime/fonts";
import { seeded } from "@/components/fx/runtime/random";
import { createRenderer, raw, sizeRenderer } from "@/components/fx/runtime/three";
import type { WarpKeycapsOptions } from "./meta";

/**
 * Port of ThreeUI's Warp Field in its "keycaps" variant (MIT, Meng To) from three r128 to
 * r186. Same scene: a camera at the origin looking down -z, 220 streaks in a ring of radius 20
 * to 820 recycling at z 200, 95 tapered, Lambert-lit keycaps tumbling from z -1200 to 110 with
 * a glyph on each top face, and 750 soft glow points, under exponential fog, lit by an
 * ambient, a key and a fill light and a point light behind the camera. The legends spell the
 * project's own name, and the colours come from its accent and the room.
 *
 * Added: the camera leans toward the pointer, a keycap under it dips and lights as if
 * pressed, and a click (or `command("surge")`) throws the field forward for a moment.
 *
 * Light intensities: r128 scaled punctual and ambient light by PI (its legacy lighting mode,
 * removed in r165), so each is multiplied by PI here to light the keycaps as the original did.
 */

const STREAKS = 220;
const CAPS = 95;
const GLOWS = 750;
const NEAR_Z = 200;
const FAR_Z = -1800;
const CAP_NEAR = 110;
const CAP_FAR = -1200;
/** The original's per-variant speed multiplier for keycaps */
const VARIANT_SPEED = 0.7;
const FOG = 0.001;
const ATLAS_CELL = 128;
const ATLAS_COLS = 6;
const FALLBACK = "HZYWORKSHOP";
/** How long a press takes to spring back, in 60fps frames */
const PRESS_FRAMES = 24;
/** A surge's extra speed at its peak, and how long it takes to settle, in ms */
const SURGE_BOOST = 2.6;
const SURGE_MS = 1300;

const hex = (n: number): RGB => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];

type Colours = {
  bg: RGB;
  streaks: RGB[];
  caps: RGB[];
  emissive: RGB;
  pressed: RGB;
  legends: RGB[];
  ambient: RGB;
  key: RGB;
  fill: RGB;
  point: RGB;
  glow: RGB;
};

const SOURCE: Colours = {
  bg: hex(0x03070c),
  streaks: [0x10b981, 0x34d399, 0xa7f3d0, 0xffffff].map(hex),
  caps: [0x3d4844, 0x505c57, 0x2b3431].map(hex),
  emissive: hex(0x03110b),
  pressed: hex(0x0b5a3f),
  legends: [0x9df5cf, 0xffffff].map(hex),
  ambient: hex(0x0f1a17),
  key: hex(0xf4fffb),
  fill: hex(0x34d399),
  point: hex(0x10b981),
  glow: hex(0x6ee7b7),
};

type Cap = {
  body: Mesh;
  legend: Mesh;
  glyph: number;
  tone: number;
  size: number;
  spin: number;
  swayX: number;
  swayY: number;
  press: number;
};

function glyphsFrom(text: string): string[] {
  const chars = Array.from(new Set(Array.from(text.toUpperCase()).filter((c) => /[A-Z0-9]/.test(c))));
  return (chars.length ? chars : Array.from(FALLBACK)).slice(0, ATLAS_COLS * ATLAS_COLS);
}

/** The original's keycap: a box whose top face is pulled in to 78%, so the sides taper */
function keycapGeometry(w: number, h: number, d: number) {
  const geometry = new BoxGeometry(w, h, d);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) pos.setXYZ(i, pos.getX(i) * 0.78, pos.getY(i), pos.getZ(i) * 0.78);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function glowSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  return new CanvasTexture(canvas);
}

export function create(ctx: FxContext, initial: WarpKeycapsOptions): FxInstance<WarpKeycapsOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  const rand = seeded(4096);
  const family = resolveFontFamily("--font-mono");

  const renderer = createRenderer(ctx);
  const scene = new Scene();
  const fog = new FogExp2(0x000000, FOG);
  scene.fog = fog;
  const camera = new PerspectiveCamera(opts.fov, 1, 0.1, 2000);
  const field = new Group();
  scene.add(field);

  // ── Streaks ──
  const streakPos = new Float32Array(STREAKS * 6);
  const streakCol = new Float32Array(STREAKS * 6);
  const streakTone = new Uint8Array(STREAKS);
  for (let i = 0; i < STREAKS; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 800 + 20;
    const z = (rand() - 0.5) * 2000;
    const len = rand() * 140 + 40;
    streakPos.set([Math.cos(a) * r, Math.sin(a) * r, z, Math.cos(a) * r, Math.sin(a) * r, z + len], i * 6);
    streakTone[i] = Math.floor(rand() * 4);
  }
  const streakGeometry = new BufferGeometry();
  const streakPosAttr = new BufferAttribute(streakPos, 3);
  const streakColAttr = new BufferAttribute(streakCol, 3);
  streakGeometry.setAttribute("position", streakPosAttr);
  streakGeometry.setAttribute("color", streakColAttr);
  const streakMaterial = new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending });
  field.add(new LineSegments(streakGeometry, streakMaterial));

  // ── Legends: a glyph atlas of the project's letters, one plane per glyph ──
  const atlas = document.createElement("canvas");
  atlas.width = atlas.height = ATLAS_CELL * ATLAS_COLS;
  const atlasTexture = new CanvasTexture(atlas);
  atlasTexture.minFilter = LinearFilter;
  atlasTexture.generateMipmaps = false;
  let glyphs: string[] = [];
  let legendGeometries: PlaneGeometry[] = [];

  const drawAtlas = () => {
    const g = atlas.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, atlas.width, atlas.height);
    g.fillStyle = "#ffffff";
    g.font = `700 ${Math.round(ATLAS_CELL * 0.68)}px ${family}, ui-monospace, Menlo, monospace`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    glyphs.forEach((ch, i) => {
      const col = i % ATLAS_COLS;
      const row = Math.floor(i / ATLAS_COLS);
      g.fillText(ch, col * ATLAS_CELL + ATLAS_CELL / 2, row * ATLAS_CELL + ATLAS_CELL * 0.54);
    });
    atlasTexture.needsUpdate = true;
  };

  const buildLegends = () => {
    glyphs = glyphsFrom(opts.text);
    legendGeometries.forEach((geo) => geo.dispose());
    legendGeometries = glyphs.map((_, i) => {
      const geo = new PlaneGeometry(1, 1);
      const uv = geo.attributes.uv;
      const u0 = (i % ATLAS_COLS) / ATLAS_COLS;
      const v0 = 1 - (Math.floor(i / ATLAS_COLS) + 1) / ATLAS_COLS;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / ATLAS_COLS, v0 + uv.getY(k) / ATLAS_COLS);
      uv.needsUpdate = true;
      return geo;
    });
    drawAtlas();
  };
  buildLegends();

  // ── Keycaps ──
  const capGeometry = keycapGeometry(26, 14, 26);
  const capMaterials = [0, 1, 2].map(() => new MeshLambertMaterial({ transparent: true }));
  const pressedMaterials = [0, 1, 2].map(() => new MeshLambertMaterial({ transparent: true }));
  const legendMaterials = [0, 1].map(
    () => new MeshBasicMaterial({ map: atlasTexture, transparent: true, depthWrite: false, side: DoubleSide })
  );
  const caps: Cap[] = [];
  const bodies: Mesh[] = [];

  const placeCap = (cap: Cap, z: number) => {
    const a = rand() * Math.PI * 2;
    const r = rand() * 430 + 130;
    cap.body.position.set(Math.cos(a) * r, Math.sin(a) * r, z);
  };

  for (let i = 0; i < CAPS; i++) {
    const tone = Math.floor(rand() * 3);
    const glyph = Math.floor(rand() * 64);
    const body = new Mesh(capGeometry, capMaterials[tone]);
    const legend = new Mesh(legendGeometries[glyph % legendGeometries.length], legendMaterials[Math.floor(rand() * 2)]);
    legend.scale.set(15, 15, 15);
    legend.position.y = 7.2;
    legend.rotation.x = -Math.PI / 2;
    body.add(legend);
    body.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    const size = rand() * 1.15 + 0.8;
    body.scale.setScalar(size);
    body.userData.cap = i;
    const cap: Cap = {
      body,
      legend,
      glyph,
      tone,
      size,
      spin: (rand() - 0.5) * 0.03,
      swayX: (rand() - 0.5) * 0.026,
      swayY: (rand() - 0.5) * 0.03,
      press: 0,
    };
    placeCap(cap, CAP_FAR + rand() * (CAP_NEAR - CAP_FAR));
    field.add(body);
    caps.push(cap);
    bodies.push(body);
  }

  // ── Lights ──
  const ambient = new AmbientLight(0xffffff, 1 * Math.PI);
  const key = new DirectionalLight(0xffffff, 1.9 * Math.PI);
  key.position.set(0.4, 1, 0.7);
  const fill = new DirectionalLight(0xffffff, 0.45 * Math.PI);
  fill.position.set(-0.7, -0.4, 0.5);
  const point = new PointLight(0xffffff, 0.8 * Math.PI, 900, 0);
  point.position.set(0, 0, 140);
  scene.add(ambient, key, fill, point);

  // ── Glow points ──
  const glowPos = new Float32Array(GLOWS * 3);
  for (let i = 0; i < GLOWS; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 620 + 20;
    glowPos.set([Math.cos(a) * r, Math.sin(a) * r, (rand() - 0.5) * 2000], i * 3);
  }
  const glowGeometry = new BufferGeometry();
  const glowPosAttr = new BufferAttribute(glowPos, 3);
  glowGeometry.setAttribute("position", glowPosAttr);
  const sprite = glowSprite();
  const glowMaterial = new PointsMaterial({
    map: sprite,
    size: 7,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  field.add(new Points(glowGeometry, glowMaterial));

  // ── State ──
  let still = false;
  let w = 1;
  let h = 1;
  let surge = 0;
  let pressedCount = 0;
  const raycaster = new Raycaster();
  const ndc = new Vector2();

  const colours = (): Colours => {
    if (opts.sourcePalette) return SOURCE;
    const accent = opts.accent ? resolveToken(opts.accent) : palette.glow;
    return {
      bg: palette.base,
      streaks: [accent, mixRGB(accent, palette.text, 0.35), mixRGB(accent, palette.text, 0.7), palette.text],
      caps: [mixRGB(palette.surface, palette.text, 0.22), mixRGB(palette.surface, palette.text, 0.3), mixRGB(palette.surface, palette.text, 0.12)],
      emissive: mixRGB(palette.base, accent, 0.08),
      pressed: mixRGB(palette.base, accent, 0.45),
      legends: [mixRGB(accent, palette.text, 0.55), palette.text],
      ambient: mixRGB(palette.base, accent, 0.15),
      key: mixRGB(palette.text, [1, 1, 1], 0.5),
      fill: mixRGB(accent, palette.text, 0.35),
      point: accent,
      glow: mixRGB(accent, palette.text, 0.45),
    };
  };

  const set = (target: Color, rgb: RGB) => raw(rgb, target);

  const recolour = () => {
    const c = colours();
    scene.background = raw(c.bg);
    set(fog.color, c.bg);
    for (let i = 0; i < STREAKS; i++) {
      const col = c.streaks[streakTone[i]];
      streakCol.set(col, i * 6);
      streakCol.set(col, i * 6 + 3);
    }
    streakColAttr.needsUpdate = true;
    capMaterials.forEach((m, i) => {
      set(m.color, c.caps[i]);
      set(m.emissive, c.emissive);
    });
    pressedMaterials.forEach((m, i) => {
      set(m.color, c.caps[i]);
      set(m.emissive, c.pressed);
    });
    legendMaterials.forEach((m, i) => set(m.color, c.legends[i]));
    set(ambient.color, c.ambient);
    set(key.color, c.key);
    set(fill.color, c.fill);
    set(point.color, c.point);
    set(glowMaterial.color, c.glow);
  };

  const apply = () => {
    streakMaterial.opacity = opts.streakOpacity;
    glowMaterial.opacity = opts.streakOpacity;
    for (const m of [...capMaterials, ...pressedMaterials, ...legendMaterials]) m.opacity = opts.tileOpacity;
    if (camera.fov !== opts.fov) {
      camera.fov = opts.fov;
      camera.updateProjectionMatrix();
    }
  };

  const draw = () => renderer.render(scene, camera);

  const startSurge = () => {
    if (still) return;
    surge = 1;
    canvas.dataset.surge = "1";
  };

  const advance = (dt: number) => {
    const frames = Math.min(50, dt) / 16.67;
    if (surge > 0) {
      surge = Math.max(0, surge - Math.min(100, dt) / SURGE_MS);
      if (surge === 0) delete canvas.dataset.surge;
    }
    const boost = 1 + SURGE_BOOST * surge * surge;
    const f = opts.speed * VARIANT_SPEED * boost * frames;

    for (let i = 0; i < STREAKS; i++) {
      const o = i * 6;
      streakPos[o + 2] += f;
      streakPos[o + 5] += f;
      if (streakPos[o + 2] > NEAR_Z) {
        const len = streakPos[o + 5] - streakPos[o + 2];
        streakPos[o + 2] = FAR_Z;
        streakPos[o + 5] = FAR_Z + len;
      }
    }
    streakPosAttr.needsUpdate = true;

    for (let i = 0; i < GLOWS; i++) {
      glowPos[i * 3 + 2] += f * 1.35;
      if (glowPos[i * 3 + 2] > NEAR_Z) glowPos[i * 3 + 2] = FAR_Z;
    }
    glowPosAttr.needsUpdate = true;

    // A keycap under the pointer is pressed; presses spring back over PRESS_FRAMES
    const p = ctx.pointer();
    if (p.inside) {
      ndc.set((p.x / w) * 2 - 1, -(p.y / h) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(bodies, false)[0];
      if (hit) caps[hit.object.userData.cap as number].press = 1;
    }

    let pressed = 0;
    for (const cap of caps) {
      const { body } = cap;
      body.position.z += f;
      body.rotation.x += cap.swayX * frames;
      body.rotation.y += cap.swayY * frames;
      body.rotation.z += cap.spin * frames;
      if (body.position.z > CAP_NEAR) placeCap(cap, CAP_FAR);
      if (cap.press > 0) {
        cap.press = Math.max(0, cap.press - frames / PRESS_FRAMES);
        if (cap.press > 0.2) pressed++;
      }
      body.scale.set(cap.size, cap.size * (1 - 0.4 * cap.press), cap.size);
      body.material = cap.press > 0.2 ? pressedMaterials[cap.tone] : capMaterials[cap.tone];
    }
    if (pressed !== pressedCount) {
      pressedCount = pressed;
      canvas.dataset.pressed = String(pressed);
    }

    // Lean toward the pointer: a small turn of the camera, eased
    const ease = 1 - Math.pow(0.9, frames);
    const yaw = p.inside ? -(p.x / w - 0.5) * 0.14 * opts.parallax : 0;
    const pitch = p.inside ? -(p.y / h - 0.5) * 0.09 * opts.parallax : 0;
    camera.rotation.y += (yaw - camera.rotation.y) * ease;
    camera.rotation.x += (pitch - camera.rotation.x) * ease;
  };

  recolour();
  apply();
  canvas.dataset.pressed = "0";

  const ready = loadFont(700, Math.round(ATLAS_CELL * 0.68), family).then(() => {
    drawAtlas();
    if (still) draw();
  });

  return {
    ready,

    resize(cssW, cssH, pr) {
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      sizeRenderer(renderer, w, h, pr);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (still) draw();
    },

    render(_now, dt) {
      advance(dt);
      draw();
    },

    update(next) {
      const relabel = next.text !== undefined && next.text !== opts.text;
      opts = { ...opts, ...next };
      if (relabel) {
        buildLegends();
        for (const cap of caps) cap.legend.geometry = legendGeometries[cap.glyph % legendGeometries.length];
      }
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
      draw();
    },

    command(name) {
      if (name === "click" || name === "surge") startSurge();
    },

    dispose() {
      delete canvas.dataset.surge;
      delete canvas.dataset.pressed;
      streakGeometry.dispose();
      streakMaterial.dispose();
      capGeometry.dispose();
      legendGeometries.forEach((g) => g.dispose());
      [...capMaterials, ...pressedMaterials, ...legendMaterials].forEach((m) => m.dispose());
      atlasTexture.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      sprite.dispose();
      renderer.dispose();
    },
  };
}
