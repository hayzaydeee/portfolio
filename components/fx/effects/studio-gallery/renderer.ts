import {
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
} from "three";
import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB, resolveToken, rgbToCss } from "@/components/fx/runtime/palette";
import { loadFont, resolveFontFamily } from "@/components/fx/runtime/fonts";
import { createRenderer, sizeRenderer } from "@/components/fx/runtime/three";
import type { GalleryItem, StudioGalleryOptions } from "./meta";

/**
 * Port of ThreeUI's Gallery (MIT, Meng To) from three r149 to r186. Same scene: a 35° camera at
 * z 18 (further back on a stage narrower than it is tall), sixteen open cylinder segments (radius 5, 1.8 tall, 72° of arc) stacked 2.4 apart and
 * turned an eighth of a turn each, so they wind two full turns of a helix; the group turns and
 * bobs. The original hung five stock photos; here each panel is a strip for one project (its
 * artwork, title and meta, or a drawn strip without artwork), projects repeating round the
 * helix.
 *
 * Added: `drag`/`release` spin it with inertia, `pick` raycasts a panel and dispatches
 * `fx:pick` (detail `{ index }`) from the canvas, `focus` turns and lifts the helix until that
 * project's nearest panel faces the camera (the bob settles while it holds there), `select`
 * keeps a project's panels lit. A hovered
 * project lights too. Turning and bobbing are separate clocks here (the original drove both
 * from one), so a focus can hold the turn while the bob carries on.
 */

const PANELS = 16;
const RADIUS = 5;
const HEIGHT = 1.8;
const ARC = Math.PI * 0.4;
const STEP_Y = 2.4;
const TURN_RATE = 0.18;
const STRIP_W = 1024;
const STRIP_H = 292;
/** How long a focused panel holds the front before the helix turns on */
const HOLD_MS = 6000;
const CAMERA_Z = 18;
/** The helix's half-width, as a multiple of its radius, that a narrow stage keeps in view */
const FIT_MARGIN = 1.12;

type Strip = { canvas: HTMLCanvasElement; texture: CanvasTexture; image: HTMLImageElement | null; loaded: boolean };

const wrap = (a: number) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));

export function create(ctx: FxContext, initial: StudioGalleryOptions): FxInstance<StudioGalleryOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  const sans = resolveFontFamily("--font-sans");
  const mono = resolveFontFamily("--font-mono");

  const renderer = createRenderer(ctx, { alpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = CAMERA_Z;
  const helix = new Group();
  scene.add(helix);

  const geometry = new CylinderGeometry(RADIUS, RADIUS, HEIGHT, 64, 1, true, 0, ARC);
  const materials: MeshBasicMaterial[] = [];
  const panels: Mesh[] = [];
  for (let e = 0; e < PANELS; e++) {
    const material = new MeshBasicMaterial({ side: DoubleSide, transparent: true, toneMapped: false });
    const mesh = new Mesh(geometry, material);
    mesh.position.y = (e - 8) * STEP_Y;
    mesh.rotation.y = (e / PANELS) * Math.PI * 4;
    mesh.userData.panel = e;
    helix.add(mesh);
    materials.push(material);
    panels.push(mesh);
  }

  let items: GalleryItem[] = [];
  let strips: Strip[] = [];
  let still = false;
  let spin = 0;
  let bob = 0;
  // The bob settles while a focused panel holds the front, so it rests where it can be clicked
  let bobAmp = 1;
  let spinMark = NaN;
  let lift = 0;
  let liftTarget = 0;
  let velocity = 0;
  let dragging = false;
  let focusSpin: number | null = null;
  let focusItem = -1;
  let holdUntil = 0;
  let clock = 0;
  let selected = -1;
  let hovered = -1;
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  let w = 1;
  let h = 1;

  const itemOf = (panel: number) => (items.length ? panel % items.length : -1);

  const colours = () => {
    const accent: RGB = opts.accent ? resolveToken(opts.accent) : palette.glow;
    return {
      top: mixRGB(palette.surface, palette.deep, 0.35),
      bottom: mixRGB(palette.base, palette.surface, 0.5),
      text: palette.text,
      muted: palette.muted,
      accent,
      art: [mixRGB(palette.base, accent, 0.55), mixRGB(palette.base, palette.warm, 0.35)] as [RGB, RGB],
    };
  };

  /** One project's strip: artwork (or a drawn square) on the left, title and meta beside it */
  const paintStrip = (strip: Strip, item: GalleryItem, index: number) => {
    const g = strip.canvas.getContext("2d");
    if (!g) return;
    const c = colours();
    const bg = g.createLinearGradient(0, 0, 0, STRIP_H);
    bg.addColorStop(0, rgbToCss(c.top));
    bg.addColorStop(1, rgbToCss(c.bottom));
    g.fillStyle = bg;
    g.fillRect(0, 0, STRIP_W, STRIP_H);

    const side = STRIP_H;
    if (strip.image && strip.loaded) {
      const { naturalWidth: iw, naturalHeight: ih } = strip.image;
      const s = Math.min(iw, ih);
      g.drawImage(strip.image, (iw - s) / 2, (ih - s) / 2, s, s, 0, 0, side, side);
    } else {
      // A drawn sleeve: the accent washed diagonally, the title's initial, five resting bars
      const art = g.createLinearGradient(0, 0, side, side);
      art.addColorStop(0, rgbToCss(c.art[0]));
      art.addColorStop(1, rgbToCss(c.art[1]));
      g.fillStyle = art;
      g.fillRect(0, 0, side, side);
      g.fillStyle = rgbToCss(c.text, 0.85);
      g.font = `400 ${Math.round(side * 0.5)}px ${sans}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText((item.title.trim()[0] ?? "♪").toUpperCase(), side / 2, side * 0.46);
      g.fillStyle = rgbToCss(c.accent, 0.9);
      for (let i = 0; i < 5; i++) {
        const bh = side * (0.06 + 0.05 * (((index + 1) * (i + 3)) % 4));
        g.fillRect(side * 0.3 + i * side * 0.09, side * 0.86 - bh, side * 0.05, bh);
      }
    }

    const x = side + 44;
    const maxW = STRIP_W - x - 40;
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.fillStyle = rgbToCss(c.text);
    g.font = `400 72px ${sans}`;
    let title = item.title;
    while (title.length > 1 && g.measureText(title).width > maxW) title = title.slice(0, -1);
    if (title !== item.title) title = `${title.trimEnd()}…`;
    g.fillText(title, x, STRIP_H * 0.5);
    g.fillStyle = rgbToCss(c.accent);
    g.fillRect(x, STRIP_H * 0.6, 64, 3);
    g.fillStyle = rgbToCss(c.muted);
    g.font = `500 28px ${mono}`;
    g.fillText(item.meta, x, STRIP_H * 0.6 + 50);
    strip.texture.needsUpdate = true;
  };

  const repaint = () => strips.forEach((s, i) => paintStrip(s, items[i], i));

  const setItems = (next: GalleryItem[]) => {
    strips.forEach((s) => s.texture.dispose());
    items = next;
    strips = items.map((item, i) => {
      const c = document.createElement("canvas");
      c.width = STRIP_W;
      c.height = STRIP_H;
      const texture = new CanvasTexture(c);
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const strip: Strip = { canvas: c, texture, image: null, loaded: false };
      if (item.artwork) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.decoding = "async";
        img.onload = () => {
          if (strips[i] !== strip) return;
          strip.loaded = true;
          paintStrip(strip, item, i);
          if (still) draw();
        };
        img.src = item.artwork;
        strip.image = img;
      }
      paintStrip(strip, item, i);
      return strip;
    });
    materials.forEach((m, e) => {
      m.map = strips.length ? strips[e % strips.length].texture : null;
      m.needsUpdate = true;
    });
    canvas.dataset.items = String(items.length);
  };

  /** The panel showing `item` nearest the helix's middle (so a lift brings it in view soonest) */
  const panelFor = (item: number) => {
    let best = -1;
    for (let e = 0; e < PANELS; e++) {
      if (itemOf(e) !== item) continue;
      if (best < 0 || Math.abs(e - 8 + lift / STEP_Y) < Math.abs(best - 8 + lift / STEP_Y)) best = e;
    }
    return best;
  };

  const focus = (item: number) => {
    const e = panelFor(item);
    if (e < 0) return;
    // Panel e's arc centre sits at ARC/2 + e·π/4; facing the camera means that plus the spin is 0
    const target = -(ARC / 2 + (e * Math.PI) / 4);
    focusSpin = spin + wrap(target - spin);
    liftTarget = -(e - 8) * STEP_Y;
    velocity = 0;
    holdUntil = clock + HOLD_MS;
    focusItem = item;
    delete canvas.dataset.focus;
  };

  const hitItem = (x: number, y: number) => {
    ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(panels, false)[0];
    return hit ? itemOf(hit.object.userData.panel as number) : -1;
  };

  const shade = () => {
    materials.forEach((m, e) => {
      const item = itemOf(e);
      m.opacity = item === hovered || item === selected ? 1 : opts.opacity;
    });
  };

  const draw = () => {
    helix.rotation.y = spin;
    helix.position.y = Math.sin(bob) * 1.5 * bobAmp + lift;
    helix.scale.setScalar(Math.min(1.35, Math.max(0.7, opts.scale)));
    shade();
    renderer.render(scene, camera);
  };

  const ready = Promise.all([loadFont(400, 72, sans), loadFont(500, 28, mono)]).then(() => {
    repaint();
    if (still) draw();
  });

  return {
    ready,

    resize(cssW, cssH, pr) {
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      sizeRenderer(renderer, w, h, pr);
      camera.aspect = w / h;
      // A stage narrower than it is tall pulls the camera back until the helix's sides fit
      camera.position.z = Math.max(CAMERA_Z, (RADIUS * FIT_MARGIN) / (Math.tan((camera.fov / 2) * (Math.PI / 180)) * camera.aspect));
      camera.updateProjectionMatrix();
      if (still) draw();
    },

    render(_now, dt) {
      const s = Math.min(50, dt) / 1000;
      // The hold runs on elapsed time, uncapped, so a slow device holds for HOLD_MS, not longer
      clock += dt;
      bob += s * opts.speed;
      if (focusSpin !== null) {
        spin += (focusSpin - spin) * (1 - Math.pow(0.004, s));
        if (Math.abs(focusSpin - spin) < 0.01 && !canvas.dataset.focus) canvas.dataset.focus = String(focusItem);
        if (clock > holdUntil) focusSpin = null;
      } else if (!dragging) {
        // The original's turn, plus whatever a release threw (radians a second, decaying)
        spin += (opts.speed * TURN_RATE + velocity) * s;
        velocity *= Math.pow(0.05, s);
      }
      lift += (liftTarget - lift) * (1 - Math.pow(0.01, s));
      bobAmp += ((focusSpin !== null ? 0 : 1) - bobAmp) * (1 - Math.pow(0.02, s));
      // Whole degrees of turn, for the suite to see a drag land
      const deg = Math.round((spin * 180) / Math.PI);
      if (deg !== spinMark) {
        spinMark = deg;
        canvas.dataset.spin = String(deg);
      }

      const p = ctx.pointer();
      const next = p.inside && !dragging ? hitItem(p.x, p.y) : -1;
      if (next !== hovered) {
        hovered = next;
        if (hovered >= 0) canvas.dataset.hover = String(hovered);
        else delete canvas.dataset.hover;
      }
      draw();
    },

    update(next) {
      opts = { ...opts, ...next };
      if (next.accent !== undefined) repaint();
      if (still) draw();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      repaint();
      if (still) draw();
    },

    still() {
      still = true;
      spin = -0.35;
      draw();
    },

    command(name, arg) {
      if (name === "items" && Array.isArray(arg)) setItems(arg as GalleryItem[]);
      else if (name === "drag") {
        const { dx } = arg as { dx: number };
        dragging = true;
        focusSpin = null;
        spin += (dx / Math.max(1, w)) * Math.PI * 1.6;
      } else if (name === "release") {
        const { vx } = (arg ?? { vx: 0 }) as { vx: number };
        dragging = false;
        // Release speed in px/ms, carried on as radians a second
        velocity = Math.max(-6, Math.min(6, ((vx * 1000) / Math.max(1, w)) * Math.PI * 1.6));
      } else if (name === "pick") {
        const { x, y } = arg as { x: number; y: number };
        const index = hitItem(x, y);
        if (index >= 0) canvas.dispatchEvent(new CustomEvent("fx:pick", { bubbles: true, detail: { index } }));
      } else if (name === "focus" && typeof arg === "number") {
        focus(arg);
        if (still) {
          spin = focusSpin ?? spin;
          lift = liftTarget;
          bobAmp = 0;
          canvas.dataset.focus = String(focusItem);
        }
      } else if (name === "select" && typeof arg === "number") {
        selected = arg;
      }
      if (still) draw();
    },

    dispose() {
      for (const key of ["items", "hover", "focus", "spin"]) delete canvas.dataset[key];
      for (const s of strips) {
        s.texture.dispose();
        if (s.image) s.image.onload = null;
      }
      materials.forEach((m) => m.dispose());
      geometry.dispose();
      renderer.dispose();
    },
  };
}
