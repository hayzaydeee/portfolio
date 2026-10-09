import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  DirectionalLight,
  Euler,
  FogExp2,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PMREMGenerator,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  RectAreaLight,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Texture,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { mixRGB, resolveToken, rgbToCss } from "@/components/fx/runtime/palette";
import { loadFont, resolveFontFamily } from "@/components/fx/runtime/fonts";
import { LEAVES, SPREADS, buildBook, createShared, shelfMaterials, texture, type Book, type Flex, type Shared } from "./book";
import { paintWalnut, type Fonts, type Look, type Motif } from "./textures";
import { SAMPLE_VOLUMES, type BookshelfOptions, type ShelfEvent, type ShelfVolume } from "./meta";

/**
 * Port of ThreeUI's Bookshelf (MIT, Meng To) from three r165 to r186, holding the six
 * journals. Same scene and the same three movements: volumes stand on a walnut shelf in a
 * paper room and slide along it as a loop (the centred one lifts, the one under the pointer
 * cracks its cover and leans toward you); a volume taken down flies to an inspection view
 * while the shelf sinks away, where you orbit it, drag its cover open and drag its leaves
 * over, each leaf flexing like cloth; put back, it flies home. The room's light and walls lean
 * toward the chosen volume's colour.
 *
 * Changed for the site: the volumes are the journals (cloth in their tokens, foil type, the
 * pages printed with the latest entries) and are passed in with `command("volumes", …)`. The
 * page owns every control as real DOM: it hands the renderer an interaction surface over the
 * canvas (`surface`) and drives it with `step`, `select`, `inspect`, `book`, `page`, `close`
 * and `reset`; the renderer reports back with `fx:shelf` events from the canvas (selection,
 * hover, mode, the open spread, a click on a printed entry). Vertical wheel scrolls the page
 * (only a sideways wheel or drag moves the shelf), orbit doesn't zoom, and orbit only takes
 * touch while a volume is out, so the shelf never traps the page's scroll.
 */

const SHELF_TOP = 0.47;
const SPACING = 1.5;
const PAGE_COMMIT = 0.18;
const COVER_OPEN_COMMIT = 0.16;
const COVER_CLOSE_COMMIT = 0.2;
const OPEN_SECONDS = 0.92;
const CLOSE_SECONDS = 0.92;
const NARROW = 820;

const MOTIFS: Record<string, Motif> = {
  reflections: "paths",
  fragments: "modules",
  annotations: "frames",
  responses: "orbits",
  buildlog: "brackets",
  cookbook: "bowl",
};
const MOTIF_ORDER: Motif[] = ["paths", "modules", "frames", "orbits", "brackets", "bowl"];

/** Each volume's board size, so the shelf reads as six different books */
const SIZES = [
  { width: 1.04, height: 1.58, depth: 0.29 },
  { width: 0.98, height: 1.46, depth: 0.22 },
  { width: 1.08, height: 1.62, depth: 0.27 },
  { width: 1.02, height: 1.52, depth: 0.25 },
  { width: 1.12, height: 1.6, depth: 0.28 },
  { width: 1.06, height: 1.48, depth: 0.26 },
];

type Mode = "hero" | "opening" | "detail" | "closing";

const clamp = MathUtils.clamp;
const damp = MathUtils.damp;
const lerp = MathUtils.lerp;
const smooth = (x: number) => x * x * (3 - 2 * x);
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
const wrapIndex = (i: number, n: number) => ((i % n) + n) % n;
/** Six volumes always leave one at the loop's seam, three places out: it fades to nothing there, so its jump to the far end is never seen */
const seamFade = (away: number) => 1 - smooth(clamp((away - 2.2) / 0.75, 0, 1));
const WHITE: RGB = [1, 1, 1];

export function create(ctx: FxContext, initial: BookshelfOptions): FxInstance<BookshelfOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  let reduced = ctx.reducedMotion;
  let still = false;
  let disposed = false;

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure;
  renderer.shadowMap.enabled = opts.shadows;
  // r180 folded PCFSoft into PCF, which softens by the shadow's radius instead
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const fog = new FogExp2(0xffffff, 0.027);
  scene.fog = fog;
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  pmrem.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = opts.environment;

  const camera = new PerspectiveCamera(32, 1, 0.1, 60);
  const shelf = new Group();
  shelf.name = "shelf";
  scene.add(shelf);
  RectAreaLightUniformsLib.init();

  // Camera stops: the shelf view, and the inspection view with the volume set to the left of the panel
  const heroCam = new Vector3();
  const heroTarget = new Vector3();
  const detailBook = new Vector3();
  const detailCam = new Vector3();
  const detailTarget = new Vector3();
  const lookAt = new Vector3();
  let viewOffsetTarget = 0;
  let viewOffset = 0;
  let room = 0;
  let width = 1;
  let height = 1;
  let panelLeft: number | null = null;

  // Room colours: current (eased) and target
  const target = {
    floor: new Color(),
    wall: new Color(),
    shelf: new Color(),
    shelfDark: new Color(),
    shadow: new Color(),
    fog: new Color(),
    hemisphere: new Color(),
    hemisphereGround: new Color(),
    key: new Color(),
    fill: new Color(),
    rim: new Color(),
  };
  let tinting = false;
  let tintedOnce = false;

  const sharedGrain = texture(renderer, paintWalnut(), { anisotropy: 8 });
  sharedGrain.wrapS = sharedGrain.wrapT = RepeatWrapping;
  sharedGrain.repeat.set(3, 1);
  const { walnut, walnutDark } = shelfMaterials(sharedGrain);
  const contactMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false });
  // The paper room glows a little of its own colour, so at this exposure it still meets the page's cream
  const floorMaterial = new MeshStandardMaterial({ roughness: 0.92, metalness: 0, emissiveIntensity: 0.22 });
  const wallMaterial = new MeshStandardMaterial({ roughness: 1, metalness: 0, emissiveIntensity: 0.38 });

  // Lights, as the original rigs them: a shadowing key, a softbox on the cloth, a cool fill,
  // a rake for the foil, a softbox behind, rakes along the spine and the page edges
  const hemisphere = new HemisphereLight(0xffffff, 0xffffff, 0.56);
  scene.add(hemisphere);
  const key = new DirectionalLight(0xffffff, 1.42);
  key.position.set(-4.6, 7.4, 5.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -1.5, near: 1, far: 18 });
  key.shadow.bias = -0.00018;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 3.5;
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);
  const rect = (intensity: number, w: number, h: number, pos: [number, number, number], at: [number, number, number]) => {
    const light = new RectAreaLight(0xffffff, intensity, w, h);
    light.position.set(...pos);
    light.lookAt(...at);
    scene.add(light);
    return light;
  };
  const softKey = rect(5.4, 4.8, 5.6, [-3.2, 5.5, 4.6], [0, 1.45, 0]);
  const fill = new DirectionalLight(0xffffff, 0.3);
  fill.position.set(5.5, 3.6, 4.2);
  scene.add(fill);
  const rim = rect(3.45, 1.6, 4.8, [3.8, 3.6, -2.1], [-0.2, 1.5, 0]);
  const backFill = rect(2.7, 3.8, 4.8, [-1.8, 2.9, -4.5], [-0.1, 1.45, 0]);
  const spineRake = rect(1.9, 0.9, 4.6, [-4.6, 3.2, 1.1], [-0.55, 1.5, 0]);
  const pageRake = rect(2.15, 1.15, 3.8, [4.2, 4.8, 3.1], [0.65, 1.55, 0]);

  let shared: Shared | null = null;
  let books: Book[] = [];
  let volumes: ShelfVolume[] = [];
  let fonts: Fonts | null = null;

  // The room: a paper floor and backdrop, the walnut shelf with its lip, rail and uprights. Built
  // once the shared resources exist, since they carry the unit box and plane
  const roomMeshes: Mesh[] = [];
  const buildRoom = (s: Shared) => {
    const floor = new Mesh(s.plane, floorMaterial);
    floor.receiveShadow = true;
    floor.scale.set(30, 20, 1);
    floor.rotation.x = -Math.PI * 0.5;
    floor.position.y = -0.02;
    scene.add(floor);
    const wall = new Mesh(s.plane, wallMaterial);
    wall.receiveShadow = true;
    wall.scale.set(28, 14, 1);
    wall.position.set(0, 5.5, -3.3);
    scene.add(wall);
    roomMeshes.push(floor, wall);
    const board = (material: MeshStandardMaterial, sc: [number, number, number], p: [number, number, number]) => {
      const m = new Mesh(s.box, material);
      m.castShadow = true;
      m.receiveShadow = true;
      m.scale.set(...sc);
      m.position.set(...p);
      shelf.add(m);
      roomMeshes.push(m);
    };
    board(walnut, [17, 0.28, 1.08], [0, 0.33, -0.03]);
    board(walnutDark, [17.05, 0.075, 1.14], [0, 0.205, 0.02]);
    board(walnut, [17, 0.17, 0.2], [0, 0.68, -0.52]);
    board(walnutDark, [0.2, 3.8, 0.72], [-7.65, 2.05, -0.28]);
    board(walnutDark, [0.2, 3.8, 0.72], [7.65, 2.05, -0.28]);
    contactMaterial.alphaMap = s.contact;
    contactMaterial.needsUpdate = true;
    const contact = new Mesh(s.plane, contactMaterial);
    contact.scale.set(16, 0.85, 1);
    contact.rotation.x = -Math.PI * 0.5;
    contact.position.set(0, 0.49, 0.06);
    shelf.add(contact);
    roomMeshes.push(contact);
  };

  // Carousel and inspection state, named after the original's roles
  let mode: Mode = "hero";
  let progress = 0;
  let carouselTarget = 0;
  let carousel = 0;
  let selected = 0;
  let hovered = -1;
  let wheelSnap = 0;
  let following = false;
  let active: Book | null = null;
  let open = false;
  let coverHover = false;
  let page = 0;
  let pointerDirty = false;
  // Draws only while something moves (see `frame`); any input keeps it awake a little longer.
  // Counted in frame time, not wall time, so a slow device still finishes every settle
  let awake = 0;
  let draws = 0;
  // Set once the programs are compiled and the textures uploaded; nothing draws before
  let warmed = false;
  const ndc = new Vector2(3, 3);
  const raycaster = new Raycaster();

  const gesture = {
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    progress: 0,
    peak: 0,
    committed: false,
    velocity: 0,
    verticalBias: 0,
    lastProgress: 0,
    lastTime: 0,
    direction: 0,
    kind: null as null | "cover-open" | "cover-close" | "page",
  };
  const click = { active: false, pointerId: -1, startX: 0, startY: 0, moved: false, allowClick: false };
  const drag = { active: false, pointerId: -1, startX: 0, lastX: 0, moved: false, base: 0 };

  // Scratch for the flights
  const fromPos = new Vector3();
  const fromQuat = new Quaternion();
  const fromScale = new Vector3();
  const motionFromPos = new Vector3();
  const motionFromQuat = new Quaternion();
  const motionRest = new Vector3();
  const motionRestQuat = new Quaternion();
  const camFrom = new Vector3();
  const lookFrom = new Vector3();
  const shelfFrom = new Vector3();
  const shelfAway = new Vector3(0, -4.2, -3);
  const shelfHome = new Vector3();
  const detailQuat = new Quaternion().setFromEuler(new Euler(0.055, -0.14, 0));
  const homeQuat = new Quaternion();
  const homeScale = new Vector3(1.09, 1.09, 1.09);
  const detailScale = new Vector3();
  const homePos = new Vector3();
  let offsetFrom = 0;

  const controls = new OrbitControls(camera);
  controls.enabled = false;
  controls.enableDamping = !reduced;
  controls.dampingFactor = 0.075;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.enableZoom = false;
  controls.minDistance = 2.8;
  controls.maxDistance = 7.2;
  controls.minPolarAngle = Math.PI * 0.24;
  controls.maxPolarAngle = Math.PI * 0.76;

  let surface: HTMLElement | null = null;

  const emit = (detail: ShelfEvent) => canvas.dispatchEvent(new CustomEvent("fx:shelf", { bubbles: true, detail }));
  const setCursor = (cursor: "" | "pointer" | "grab" | "grabbing") => {
    if (!surface) return;
    if (cursor) surface.dataset.cursor = cursor;
    else delete surface.dataset.cursor;
  };

  const n = () => books.length || 1;

  /** Whether the inspected volume sits left of a side panel; without one it centres */
  const beside = () => width >= NARROW && panelLeft !== null;

  const layoutCamera = () => {
    const narrow = width < NARROW;
    heroCam.set(0, narrow ? 2.02 : 1.92, narrow ? 8.7 : 8.1);
    heroTarget.set(0, narrow ? 1.57 : 1.55, 0);
    const side = beside();
    detailBook.set(side ? -2.25 : 0, side ? 1.56 : 2.3, side ? 0 : 0.15);
    detailCam.set(side ? -0.52 : 0, side ? 1.78 : 2.46, side ? 5.25 : 5.7);
    detailTarget.copy(detailBook);
    if (!side || panelLeft === null) {
      viewOffsetTarget = 0;
      room = width;
      return;
    }
    const left = panelLeft > 0 ? panelLeft : width * 0.64;
    const gap = clamp(width * 0.035, 32, 56);
    room = Math.max(width * 0.42, left - gap);
    const k = clamp((width - NARROW) / 620, 0, 1);
    viewOffsetTarget = Math.max(0, width * 0.5 - room * lerp(0.55, 0.615, k));
  };

  /** The inspected volume's scale: about 72% of the room left of the panel, on a wide stage */
  const detailFit = () => {
    const span = 2 * Math.abs(detailCam.z - detailBook.z) * Math.tan(MathUtils.degToRad(camera.fov * 0.5));
    if (active && !beside()) {
      // Centred, the open spread (two boards wide) has to fit the view's width, which on a phone is the tight side
      const across = span * camera.aspect;
      return clamp((across * 0.9) / (active.base.width * 2.1), 0.45, 0.82);
    }
    if (!active) return 0.82;
    const pxPerUnit = height / Math.max(span, 1e-3);
    const bookPx = active.base.width * pxPerUnit * 1.16;
    return clamp((room * 0.72) / Math.max(bookPx, 1), 0.9, 1.32);
  };

  const applyViewOffset = () => {
    if (Math.abs(viewOffset) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(width, height, viewOffset, 0, width, height);
  };

  // Room colours -------------------------------------------------------------

  const setTarget = (c: Color, rgb: RGB) => c.setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);

  const clothOf = (vol: ShelfVolume | undefined): RGB => (vol ? resolveToken(vol.color) : palette.accent);
  const foilRGB = (): RGB => mixRGB(palette.base, palette.accent, 0.3);

  const applyRoom = (index: number) => {
    const cloth = clothOf(volumes[index]);
    const t = opts.tint;
    const shelfRGB = mixRGB(palette.accent, palette.text, 0.38);
    const shelfDarkRGB = mixRGB(shelfRGB, palette.text, 0.5);
    setTarget(target.wall, mixRGB(palette.base, cloth, t));
    setTarget(target.floor, mixRGB(palette.surface, cloth, t * 0.7));
    setTarget(target.shelf, shelfRGB);
    setTarget(target.shelfDark, shelfDarkRGB);
    setTarget(target.shadow, shelfDarkRGB);
    setTarget(target.fog, mixRGB(palette.base, cloth, t));
    setTarget(target.hemisphere, mixRGB(palette.base, WHITE, 0.55));
    setTarget(target.hemisphereGround, shelfRGB);
    setTarget(target.key, mixRGB(WHITE, palette.glow, 0.14));
    setTarget(target.fill, mixRGB(WHITE, palette.deep, 0.12));
    setTarget(target.rim, foilRGB());
    if (!tintedOnce || reduced) {
      tintedOnce = true;
      snapRoom();
    } else {
      tinting = true;
    }
  };

  const roomPairs = (): [Color, Color][] => [
    [floorMaterial.color, target.floor],
    [wallMaterial.color, target.wall],
    [walnut.color, target.shelf],
    [walnutDark.color, target.shelfDark],
    [contactMaterial.color, target.shadow],
    [fog.color, target.fog],
    [hemisphere.color, target.hemisphere],
    [hemisphere.groundColor, target.hemisphereGround],
    [key.color, target.key],
    [softKey.color, target.key],
    [fill.color, target.fill],
    [rim.color, target.rim],
    [backFill.color, target.fill],
    [spineRake.color, target.key],
    [pageRake.color, target.hemisphere],
  ];

  const snapRoom = () => {
    for (const [c, t] of roomPairs()) c.copy(t);
    tinting = false;
    glowRoom();
  };

  const glowRoom = () => {
    floorMaterial.emissive.copy(floorMaterial.color);
    wallMaterial.emissive.copy(wallMaterial.color);
  };

  const easeRoom = (dt: number) => {
    if (!tinting) return;
    const k = 1 - Math.exp(-dt * 5.5);
    let worst = 0;
    for (const [c, t] of roomPairs()) {
      const dr = c.r - t.r;
      const dg = c.g - t.g;
      const db = c.b - t.b;
      worst = Math.max(worst, dr * dr + dg * dg + db * db);
      c.lerp(t, k);
    }
    glowRoom();
    if (worst < 25e-7) snapRoom();
  };

  // Volumes ------------------------------------------------------------------

  const lookFor = (vol: ShelfVolume, index: number): Look => {
    const cloth = clothOf(vol);
    return {
      vol,
      seed: 11 + index * 11,
      cloth: rgbToCss(cloth),
      foil: rgbToCss(foilRGB()),
      ink: rgbToCss(mixRGB(palette.text, cloth, 0.35)),
      paper: rgbToCss(palette.base),
      motif: MOTIFS[vol.id] ?? MOTIF_ORDER[index % MOTIF_ORDER.length],
    };
  };

  const placeOnShelf = (book: Book, index: number) => {
    let offset = index - carousel;
    offset -= Math.round(offset / n()) * n();
    const away = Math.abs(offset);
    const near = 1 - clamp(away, 0, 1);
    const fade = seamFade(away);
    book.root.position.set(offset * SPACING, SHELF_TOP + book.base.height * 0.5 + near * 0.15, 0.13 + near * 0.24 - Math.min(away, 2.8) * 0.07);
    book.root.rotation.set(0, -offset * 0.105, -offset * 0.018);
    book.root.scale.setScalar(1 + near * 0.09);
    book.motion.position.y = 0;
    book.motion.rotation.set(0, 0, 0);
    book.frontPivot.rotation.y = 0;
    for (const pivot of book.pagePivots) {
      pivot.rotation.y = 0;
      pivot.rotation.z = 0;
      pivot.position.z = pivot.userData.restZ as number;
      flexPage(pivot, 0, 0, true);
    }
    setOpacity(book, fade);
    book.lastOffset = offset;
  };

  const setOpacity = (book: Book, value: number) => {
    book.opacity = value;
    for (const m of book.fadeMaterials) m.opacity = value;
    book.contactShadow.visible = true;
    (book.contactShadow.material as MeshBasicMaterial).opacity = value * 0.24;
    book.hit.userData.pickable = value > 0.12;
  };

  const buildBooks = () => {
    if (!fonts || !volumes.length || disposed) return;
    shared ??= createShared(renderer, rgbToCss(palette.base), rgbToCss(mixRGB(palette.base, palette.surface, 0.5)));
    if (!roomMeshes.length) buildRoom(shared);
    for (const b of books) {
      b.root.removeFromParent();
      b.dispose();
    }
    const shadowDark = new Color();
    setTarget(shadowDark, mixRGB(mixRGB(palette.accent, palette.text, 0.38), palette.text, 0.5));
    books = volumes.map((vol, i) => {
      const book = buildBook(renderer, shared!, lookFor(vol, i), fonts!, SIZES[i % SIZES.length], i, shadowDark);
      shelf.add(book.root);
      return book;
    });
    active = null;
    mode = "hero";
    selected = clamp(selected, 0, books.length - 1);
    carousel = carouselTarget = selected;
    books.forEach((b, i) => placeOnShelf(b, i));
    canvas.dataset.volumes = String(books.length);
    canvas.dataset.source = volumes === SAMPLE_VOLUMES ? "sample" : "page";
    select(selected, true);
    resize();
  };

  // Selection ----------------------------------------------------------------

  function select(index: number, force = false) {
    const next = wrapIndex(index, n());
    if (next === selected && !force) return;
    selected = next;
    canvas.dataset.selected = String(selected);
    applyRoom(selected);
    emit({ type: "select", index: selected });
  }

  const setMode = (next: Mode) => {
    mode = next;
    canvas.dataset.mode = next === "hero" ? "shelf" : next;
    emit({ type: "mode", mode: next === "hero" ? "shelf" : next });
  };

  const reportBook = () => {
    canvas.dataset.open = open ? "1" : "0";
    canvas.dataset.page = String(page);
    emit({ type: "book", open, page, spreads: SPREADS });
  };

  const goTo = (index: number) => {
    if (mode !== "hero") return;
    following = false;
    const base = Math.round(carouselTarget);
    let delta = index - wrapIndex(base, n());
    if (delta > n() / 2) delta -= n();
    if (delta < -n() / 2) delta += n();
    carouselTarget = base + delta;
    select(index);
    kick();
  };

  const step = (direction: number) => {
    if (mode !== "hero") return;
    following = false;
    carouselTarget = Math.round(carouselTarget) + direction;
    select(wrapIndex(Math.round(carouselTarget), n()));
    kick();
  };

  /** After a close, the loop's target lands on the selected volume by the shortest way round */
  const settleCarousel = () => {
    const base = Math.round(carouselTarget);
    let delta = selected - wrapIndex(base, n());
    if (delta > n() / 2) delta -= n();
    if (delta < -n() / 2) delta += n();
    carouselTarget = base + delta;
    carousel = carouselTarget;
  };

  // Opening and closing a volume --------------------------------------------

  const setOpen = (value: boolean) => {
    if (mode !== "detail" || open === value) return;
    cancelGesture();
    open = value;
    if (!open) page = 0;
    coverHover = false;
    setCursor("");
    reportBook();
    kick();
  };

  const turn = (direction: number) => {
    if (mode !== "detail" || !open) return;
    const next = clamp(page + direction, 0, SPREADS - 1);
    if (next === page) return;
    page = next;
    reportBook();
    kick();
  };

  const inspect = () => {
    if (mode !== "hero" || !books.length) return;
    setMode("opening");
    progress = 0;
    open = false;
    coverHover = false;
    page = 0;
    resetClick();
    endDrag();
    active = books[selected];
    active.printLeaves();
    active.contactShadow.visible = false;
    setHover(-1);
    active.root.updateWorldMatrix(true, true);
    active.root.matrixWorld.decompose(fromPos, fromQuat, fromScale);
    camFrom.copy(camera.position);
    lookFrom.copy(lookAt);
    shelfFrom.copy(shelf.position);
    motionFromPos.copy(active.motion.position);
    motionFromQuat.copy(active.motion.quaternion);
    offsetFrom = viewOffset;
    scene.add(active.root);
    active.root.position.copy(fromPos);
    active.root.quaternion.copy(fromQuat);
    active.root.scale.copy(fromScale);
    applyViewOffset();
    controls.enabled = false;
    reportBook();
    if (reduced) finishOpening();
    kick();
  };

  const flyOut = (t: number) => {
    if (!active) return;
    const e = smoother(clamp(t, 0, 1));
    const s = smoother(clamp(t / 0.68, 0, 1));
    detailScale.setScalar(detailFit());
    shelf.position.lerpVectors(shelfFrom, shelfAway, s);
    active.root.position.lerpVectors(fromPos, detailBook, e);
    active.root.quaternion.slerpQuaternions(fromQuat, detailQuat, e);
    active.root.scale.lerpVectors(fromScale, detailScale, e);
    active.motion.position.lerpVectors(motionFromPos, motionRest, e);
    active.motion.quaternion.slerpQuaternions(motionFromQuat, motionRestQuat, e);
    camera.position.lerpVectors(camFrom, detailCam, e);
    lookAt.lerpVectors(lookFrom, detailTarget, e);
    viewOffset = lerp(offsetFrom, viewOffsetTarget, e);
    applyViewOffset();
    camera.lookAt(lookAt);
  };

  const finishOpening = () => {
    if (!active) return;
    flyOut(1);
    setMode("detail");
    progress = 1;
    controls.target.copy(detailTarget);
    if (surface) controls.connect(surface);
    controls.enabled = true;
    controls.enableDamping = !reduced;
    controls.update();
    reportBook();
  };

  const close = () => {
    if (mode !== "detail" || !active) return;
    cancelGesture();
    resetClick();
    setMode("closing");
    progress = 0;
    open = false;
    coverHover = false;
    page = 0;
    setCursor("");
    controls.enabled = false;
    if (controls.domElement) controls.disconnect();
    fromPos.copy(active.root.position);
    fromQuat.copy(active.root.quaternion);
    fromScale.copy(active.root.scale);
    motionFromPos.copy(active.motion.position);
    motionFromQuat.copy(active.motion.quaternion);
    camFrom.copy(camera.position);
    lookFrom.copy(controls.target);
    shelfFrom.copy(shelf.position);
    offsetFrom = viewOffset;
    lookAt.copy(lookFrom);
    settleCarousel();
    homePos.set(0, SHELF_TOP + active.base.height * 0.5 + 0.15, 0.37);
    books.forEach((b, i) => {
      if (b !== active && b.root.parent === shelf) placeOnShelf(b, i);
    });
    reportBook();
    if (reduced) finishClosing();
    kick();
  };

  const flyHome = (t: number) => {
    if (!active) return;
    const e = smoother(clamp(t, 0, 1));
    const s = smoother(clamp((t - 0.24) / 0.76, 0, 1));
    shelf.position.lerpVectors(shelfFrom, shelfHome, s);
    active.root.position.lerpVectors(fromPos, homePos, e);
    active.root.quaternion.slerpQuaternions(fromQuat, homeQuat, e);
    active.root.scale.lerpVectors(fromScale, homeScale, e);
    active.motion.position.lerpVectors(motionFromPos, motionRest, e);
    active.motion.quaternion.slerpQuaternions(motionFromQuat, motionRestQuat, e);
    camera.position.lerpVectors(camFrom, heroCam, e);
    lookAt.lerpVectors(lookFrom, heroTarget, e);
    viewOffset = lerp(offsetFrom, 0, e);
    applyViewOffset();
    camera.lookAt(lookAt);
  };

  const finishClosing = () => {
    if (!active) return;
    flyHome(1);
    shelf.attach(active.root);
    placeOnShelf(active, selected);
    active.contactShadow.visible = true;
    controls.target.copy(heroTarget);
    active = null;
    delete canvas.dataset.bookBox;
    delete canvas.dataset.rightPage;
    setMode("hero");
    progress = 0;
  };

  const resetView = () => {
    if (mode !== "detail") return;
    camera.position.copy(detailCam);
    controls.target.copy(detailTarget);
    controls.update();
    kick();
  };

  // Leaves -------------------------------------------------------------------

  /** Bend a leaf: a sine bow across the page plus a lift toward the fore-edge, and a twist when dragged off-axis */
  function flexPage(pivot: Group, curveTarget: number, dt: number, instant = false, twistTarget = 0) {
    const flex = pivot.userData.flex as Flex | undefined;
    if (!flex) return;
    const snap = instant || reduced;
    const h = Math.min(dt, 0.033);
    let curve = curveTarget;
    let twist = twistTarget;
    if (snap) {
      flex.curveVelocity = 0;
      flex.twistVelocity = 0;
    } else {
      const ca = (curveTarget - flex.curve) * 178 - flex.curveVelocity * 19;
      const ta = (twistTarget - flex.twist) * 210 - flex.twistVelocity * 21;
      flex.curveVelocity = clamp(flex.curveVelocity + ca * h, -1.8, 1.8);
      flex.twistVelocity = clamp(flex.twistVelocity + ta * h, -1.6, 1.6);
      curve = clamp(flex.curve + flex.curveVelocity * h, -0.025, 0.19);
      twist = clamp(flex.twist + flex.twistVelocity * h, -0.12, 0.12);
      if (Math.abs(curveTarget - curve) < 2e-5 && Math.abs(flex.curveVelocity) < 8e-4) {
        curve = curveTarget;
        flex.curveVelocity = 0;
      }
      if (Math.abs(twistTarget - twist) < 2e-5 && Math.abs(flex.twistVelocity) < 8e-4) {
        twist = twistTarget;
        flex.twistVelocity = 0;
      }
    }
    const settled =
      Math.abs(curve - flex.curve) < 1e-5 && Math.abs(curveTarget - curve) < 1e-5 && Math.abs(twist - flex.twist) < 1e-5 && Math.abs(twistTarget - twist) < 1e-5;
    if (!snap && settled) return;
    flex.curve = curve;
    flex.twist = twist;
    for (const { geometry, base, direction } of flex.surfaces) {
      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        const o = i * 3;
        const x = base[o];
        const y = base[o + 1];
        const u = direction > 0 ? x + 0.5 : 0.5 - x;
        const bow = Math.sin(Math.PI * u) * 0.84 + u * u * 0.16;
        const skew = twist * y * Math.pow(u, 1.35);
        const ripple = twist * Math.sin(u * Math.PI * 2) * (1 - Math.min(1, Math.abs(y) * 1.65)) * 0.09;
        pos.setXYZ(i, x, y, (curve * bow * (1 + y * 0.14) + skew + ripple) * direction);
      }
      pos.needsUpdate = true;
      geometry.computeVertexNormals();
    }
  }

  /** Pose the inspected volume: the cover's swing and each leaf's turn, following a drag if one is under way */
  const poseBook = (book: Book, dt: number, openness: number) => {
    const r = clamp(openness, 0, 1);
    const speed = reduced ? 1000 : 10.5;
    const ajar = mode === "detail" && !open && coverHover && !reduced ? -0.16 : 0;
    book.frontPivot.rotation.y = damp(book.frontPivot.rotation.y, r > 0 ? (-Math.PI + 0.055) * r : ajar, speed, dt);
    const count = book.pagePivots.length;
    book.pagePivots.forEach((pivot, d) => {
      const leaf = count - 1 - d;
      let angle = 0;
      let z = pivot.userData.restZ as number;
      let lean = 0;
      let lift = 0;
      let twist = 0;
      if (leaf < LEAVES) {
        const turned = leaf < page;
        const rest = -0.038 + leaf * 0.008;
        const over = -Math.PI + 0.085 + leaf * 0.014;
        angle = turned ? over : rest;
        z = turned ? (pivot.userData.turnedZ as number) : (pivot.userData.restZ as number);
        if (gesture.active && gesture.kind === "page" && gesture.direction !== 0) {
          const moving = gesture.direction > 0 ? page : page - 1;
          if (leaf === moving) {
            const e = smooth(gesture.progress);
            const arc = Math.sin(Math.PI * e);
            const speedK = clamp(Math.abs(gesture.velocity) / 5.5, 0, 1);
            const signed = clamp(gesture.velocity / 5.5, -1, 1);
            angle = gesture.direction > 0 ? lerp(rest, over, e) : lerp(over, rest, e);
            z =
              gesture.direction > 0
                ? lerp(pivot.userData.restZ as number, pivot.userData.turnedZ as number, e)
                : lerp(pivot.userData.turnedZ as number, pivot.userData.restZ as number, e);
            lean = gesture.direction * arc * (0.014 + gesture.verticalBias * 0.026);
            lift = arc * (0.032 + speedK * 0.064);
            twist = arc * (gesture.verticalBias * 0.08 + signed * gesture.direction * 0.03);
          }
        }
        const restZ = pivot.userData.restZ as number;
        pivot.position.z = damp(pivot.position.z, restZ + (z - restZ) * r, speed, dt);
      } else {
        angle = -0.006 + (leaf - LEAVES) * 0.003;
        pivot.position.z = damp(pivot.position.z, pivot.userData.restZ as number, speed, dt);
      }
      pivot.rotation.y = damp(pivot.rotation.y, angle * r, speed, dt);
      pivot.rotation.z = damp(pivot.rotation.z, lean * r, speed, dt);
      const swing = clamp(Math.abs(pivot.rotation.y) / Math.PI, 0, 1);
      const bend = r > 0 ? r * (0.004 + Math.sin(Math.PI * swing) * 0.082 + lift) : 0;
      flexPage(pivot, bend, dt, false, twist * r);
    });
  };

  const openness = () => {
    if (gesture.active && gesture.kind === "cover-open") return smooth(gesture.progress);
    if (!open) return 0;
    return gesture.active && gesture.kind === "cover-close" ? 1 - smooth(gesture.progress) : 1;
  };

  /** Centred, the volume slides right as it opens, so the spread rather than the closed book sits in the middle */
  const spreadShift = () => (active && !beside() ? active.base.width * 0.5 * active.root.scale.x * openness() : 0);

  // Picking ------------------------------------------------------------------

  const pointerAt = (e: PointerEvent | MouseEvent) => {
    if (!surface) return;
    wake(600);
    const r = surface.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    pointerDirty = true;
  };

  const pickVolume = () => {
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(
      books.map((b) => b.hit),
      false
    );
    const hit = hits.find((h) => h.object.userData.pickable !== false);
    return hit ? (hit.object.userData.index as number) : -1;
  };

  const overActive = () => {
    if (mode !== "detail" || !active) return false;
    active.root.updateWorldMatrix(true, true);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(active.hit, false).length > 0;
  };

  const overPages = () => {
    if (mode !== "detail" || !active || !open) return null;
    active.root.updateWorldMatrix(true, true);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(active.pageGestureSurfaces, false)[0] ?? null;
  };

  const overCover = () => {
    if (mode !== "detail" || !active || page !== 0) return null;
    active.root.updateWorldMatrix(true, true);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(active.frontCover, false)[0] ?? null;
  };

  const setHover = (index: number) => {
    if (hovered === index) return;
    hovered = index;
    if (index >= 0) canvas.dataset.hover = String(index);
    else delete canvas.dataset.hover;
    if (mode === "hero") setCursor(index >= 0 ? "pointer" : "");
    emit({ type: "hover", index });
  };

  const updateHover = () => {
    pointerDirty = false;
    if (mode === "detail" && active) {
      setHover(-1);
      if (open) {
        coverHover = false;
        setCursor(gesture.active ? "grabbing" : overPages() || overCover() ? "grab" : "");
      } else {
        coverHover = !!overCover();
        setCursor(coverHover ? "grab" : "");
      }
      return;
    }
    coverHover = false;
    if (mode !== "hero" || drag.moved) {
      setHover(-1);
      return;
    }
    setHover(pickVolume());
  };

  // Gestures: cover and leaves in the inspection view ------------------------

  const resetGesture = () => {
    const id = gesture.pointerId;
    Object.assign(gesture, {
      active: false,
      pointerId: -1,
      progress: 0,
      peak: 0,
      committed: false,
      velocity: 0,
      verticalBias: 0,
      lastProgress: 0,
      lastTime: 0,
      direction: 0,
      kind: null,
    });
    controls.enabled = mode === "detail";
    if (surface && id >= 0 && surface.hasPointerCapture?.(id)) surface.releasePointerCapture(id);
  };

  /** A committed leaf throws its flex on: the faster the flick, the more it billows as it lands */
  const flick = (direction: number) => {
    if (!active || direction === 0) return;
    const leaf = direction > 0 ? page : page - 1;
    const pivot = active.pagePivots[active.pagePivots.length - 1 - leaf];
    const flex = pivot?.userData.flex as Flex | undefined;
    if (!flex) return;
    const speedK = clamp(Math.abs(gesture.velocity) / 5.5, 0.12, 1);
    flex.curveVelocity = clamp(flex.curveVelocity + speedK * 0.46, -1.8, 1.8);
    flex.twistVelocity = clamp(
      flex.twistVelocity + gesture.verticalBias * 0.38 + clamp(gesture.velocity / 5.5, -1, 1) * direction * 0.14,
      -1.6,
      1.6
    );
  };

  const finishGesture = (commit: boolean) => {
    if (!gesture.active) return false;
    const direction = gesture.direction;
    const closing = commit && gesture.kind === "cover-close" && gesture.committed;
    const opening = commit && gesture.kind === "cover-open" && gesture.committed;
    const turning = commit && gesture.kind === "page" && gesture.committed && direction !== 0;
    if (turning) flick(direction);
    resetGesture();
    if (closing) setOpen(false);
    else if (opening) setOpen(true);
    else if (turning) turn(direction);
    kick();
    return closing || opening || turning;
  };

  function cancelGesture() {
    finishGesture(false);
  }

  function resetClick() {
    Object.assign(click, { active: false, pointerId: -1, moved: false, allowClick: false });
  }

  const trackVelocity = (e: PointerEvent, dy: number) => {
    const t = e.timeStamp || performance.now();
    const dt = clamp((t - gesture.lastTime) / 1000, 0.008, 0.08);
    const v = clamp((gesture.progress - gesture.lastProgress) / dt, -8, 8);
    gesture.velocity = lerp(gesture.velocity, v, 0.42);
    gesture.verticalBias = lerp(gesture.verticalBias, clamp(dy / 180, -1, 1), 0.36);
    gesture.lastProgress = gesture.progress;
    gesture.lastTime = t;
  };

  const followGesture = (e: PointerEvent) => {
    pointerAt(e);
    const dx = e.clientX - gesture.startX;
    const dy = e.clientY - gesture.startY;
    const ax = Math.abs(dx);
    if (gesture.kind === "cover-open" || gesture.kind === "cover-close") {
      const opening = gesture.kind === "cover-open";
      const along = opening ? -dx : dx;
      gesture.direction = 0;
      gesture.progress = ax >= 3 && ax >= Math.abs(dy) * 0.72 ? clamp(Math.max(0, along) / 140, 0, 1) : 0;
      gesture.peak = Math.max(gesture.peak, gesture.progress);
      if (gesture.peak >= (opening ? COVER_OPEN_COMMIT : COVER_CLOSE_COMMIT)) gesture.committed = true;
      trackVelocity(e, dy);
      return;
    }
    if (ax < 3 || ax < Math.abs(dy) * 0.72) {
      gesture.progress = 0;
    } else {
      if (gesture.direction === 0 && ax >= 6) {
        const want = dx < 0 ? 1 : -1;
        const can = want > 0 ? page < SPREADS - 1 : page > 0;
        gesture.direction = can ? want : 0;
      }
      const along = gesture.direction > 0 ? -dx : dx;
      gesture.progress = gesture.direction !== 0 ? clamp(Math.max(0, along) / 150, 0, 1) : 0;
      gesture.peak = Math.max(gesture.peak, gesture.progress);
      if (gesture.peak >= PAGE_COMMIT) gesture.committed = true;
    }
    trackVelocity(e, dy);
  };

  /** Which printed page a click landed on, as an entry number (faces 1..6 carry entries) */
  const clickedEntry = () => {
    if (!active || !open) return -1;
    active.root.updateWorldMatrix(true, true);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(active.pageSurfaces, false)[0];
    const face = (hit?.object.userData.face as number | undefined) ?? -1;
    return face >= 1 && face <= 6 ? face - 1 : -1;
  };

  // Surface listeners ---------------------------------------------------------

  const onClickDown = (e: PointerEvent) => {
    if (mode !== "detail" || open || e.button !== 0 || e.isPrimary === false) return;
    pointerAt(e);
    click.allowClick = false;
    if (overActive()) Object.assign(click, { active: true, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false });
  };
  const onClickMove = (e: PointerEvent) => {
    if (!click.active || e.pointerId !== click.pointerId) return;
    if (Math.hypot(e.clientX - click.startX, e.clientY - click.startY) > 16) click.moved = true;
  };
  const onClickEnd = (e: PointerEvent) => {
    if (!click.active || e.pointerId !== click.pointerId) return;
    click.allowClick = e.type === "pointerup" && !click.moved;
    click.active = false;
    click.pointerId = -1;
  };

  const onGestureDown = (e: PointerEvent) => {
    if (mode !== "detail" || !active || e.button !== 0 || e.isPrimary === false) return;
    pointerAt(e);
    const cover = overCover();
    const pages = open ? overPages() : null;
    if (!cover && !pages) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    Object.assign(gesture, {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      progress: 0,
      peak: 0,
      committed: false,
      velocity: 0,
      verticalBias: 0,
      lastProgress: 0,
      lastTime: e.timeStamp || performance.now(),
      direction: 0,
      kind: cover ? (open ? "cover-close" : "cover-open") : "page",
    });
    controls.enabled = false;
    setCursor("grabbing");
    surface?.setPointerCapture?.(e.pointerId);
    kick();
  };
  const onGestureMove = (e: PointerEvent) => {
    if (!gesture.active || e.pointerId !== gesture.pointerId) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    followGesture(e);
    kick();
  };
  const onGestureEnd = (e: PointerEvent) => {
    if (!gesture.active || e.pointerId !== gesture.pointerId) return;
    if (e.cancelable) e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === "pointerup") followGesture(e);
    const kind = gesture.kind;
    const travel = Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY);
    const tapCover = e.type === "pointerup" && kind === "cover-open" && !gesture.committed && travel <= 12;
    const tapPage = e.type === "pointerup" && kind === "page" && !gesture.committed && travel <= 8;
    if (gesture.committed) finishGesture(true);
    else if (tapCover) {
      resetGesture();
      click.allowClick = false;
      setOpen(true);
    } else {
      if (kind === "cover-open") click.allowClick = false;
      if (tapPage) {
        const entry = clickedEntry();
        if (entry >= 0) emit({ type: "entry", index: entry });
      }
      cancelGesture();
    }
  };
  const onWindowUp = (e: PointerEvent) => {
    if (!gesture.active || e.pointerId !== gesture.pointerId) return;
    if (e.type === "pointerup") followGesture(e);
    finishGesture(true);
  };

  // A sideways drag along the shelf in the browsing view
  const pxPerVolume = () => {
    const dist = Math.max(1, heroCam.z - 0.3);
    const worldW = 2 * dist * Math.tan(MathUtils.degToRad(camera.fov * 0.5)) * camera.aspect;
    return (width / worldW) * SPACING;
  };
  const onDragDown = (e: PointerEvent) => {
    if (mode !== "hero" || e.button !== 0 || e.isPrimary === false) return;
    Object.assign(drag, { active: true, pointerId: e.pointerId, startX: e.clientX, lastX: e.clientX, moved: false, base: carouselTarget });
  };
  const onDragMove = (e: PointerEvent) => {
    pointerAt(e);
    if (!drag.active || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > 6) {
      drag.moved = true;
      surface?.setPointerCapture?.(e.pointerId);
      setHover(-1);
      setCursor("grabbing");
    }
    if (drag.moved) {
      carouselTarget = drag.base - dx / pxPerVolume();
      drag.lastX = e.clientX;
      kick();
    }
  };
  function endDrag() {
    if (!drag.active) return;
    const moved = drag.moved;
    drag.active = false;
    if (surface && drag.pointerId >= 0 && surface.hasPointerCapture?.(drag.pointerId)) surface.releasePointerCapture(drag.pointerId);
    drag.pointerId = -1;
    if (moved) {
      following = false;
      carouselTarget = Math.round(carouselTarget);
      select(wrapIndex(carouselTarget, n()));
      setCursor("");
      kick();
    }
  }
  const onDragEnd = (e: PointerEvent) => {
    if (!drag.active || e.pointerId !== drag.pointerId) return;
    endDrag();
    // The click that follows this pointerup comes in the same task: let it see the drag, then forget it
    setTimeout(() => {
      drag.moved = false;
    }, 0);
  };

  const onPointerLeave = () => {
    wake(600);
    ndc.set(3, 3);
    pointerDirty = false;
    coverHover = false;
    setHover(-1);
    if (!gesture.active) setCursor("");
  };

  const onClick = (e: MouseEvent) => {
    if (mode === "detail" && !open && e.button === 0) {
      if (!click.allowClick) return;
      click.allowClick = false;
      pointerAt(e);
      if (!overActive()) return;
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (mode !== "hero" || e.button !== 0 || drag.moved) return;
    pointerAt(e);
    const index = pickVolume();
    if (index < 0) return;
    e.preventDefault();
    goTo(index);
    inspect();
  };

  const onWheel = (e: WheelEvent) => {
    if (mode !== "hero" || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    carouselTarget += clamp(e.deltaX * 0.0022, -0.72, 0.72);
    wheelSnap = 0.14;
    following = true;
    kick();
  };

  const listeners: [keyof HTMLElementEventMap, EventListener, AddEventListenerOptions?][] = [
    ["pointermove", onDragMove as EventListener],
    ["pointerleave", onPointerLeave as EventListener],
    ["click", onClick as EventListener],
    ["pointerdown", onDragDown as EventListener],
    ["pointerup", onDragEnd as EventListener],
    ["pointercancel", onDragEnd as EventListener],
    ["pointerdown", onClickDown as EventListener, { capture: true }],
    ["pointermove", onClickMove as EventListener, { capture: true }],
    ["pointerup", onClickEnd as EventListener, { capture: true }],
    ["pointercancel", onClickEnd as EventListener, { capture: true }],
    ["lostpointercapture", onClickEnd as EventListener, { capture: true }],
    ["pointerdown", onGestureDown as EventListener, { capture: true }],
    ["pointermove", onGestureMove as EventListener, { capture: true }],
    ["pointerup", onGestureEnd as EventListener, { capture: true }],
    ["pointercancel", onGestureEnd as EventListener, { capture: true }],
    ["lostpointercapture", onGestureEnd as EventListener, { capture: true }],
    ["wheel", onWheel as EventListener, { passive: false }],
  ];

  const unbind = () => {
    delete canvas.dataset.surface;
    if (!surface) return;
    for (const [type, fn, o] of listeners) surface.removeEventListener(type, fn, o);
    window.removeEventListener("pointerup", onWindowUp);
    window.removeEventListener("pointercancel", onWindowUp);
    if (controls.domElement) controls.disconnect();
    delete surface.dataset.cursor;
    surface = null;
  };

  const bind = (el: HTMLElement) => {
    unbind();
    surface = el;
    canvas.dataset.surface = "1";
    for (const [type, fn, o] of listeners) el.addEventListener(type, fn, o);
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowUp);
    if (mode === "detail") controls.connect(el);
  };

  // Frame -----------------------------------------------------------------------

  const stepShelf = (dt: number, t: number) => {
    if (mode === "hero") {
      carousel = reduced ? carouselTarget : damp(carousel, carouselTarget, 9.5, dt);
      if (Math.abs(carousel - carouselTarget) < 5e-4) carousel = carouselTarget;
      if (wheelSnap > 0) {
        wheelSnap -= dt;
        if (wheelSnap <= 0) carouselTarget = Math.round(carouselTarget);
      }
      // The selection follows the loop only while a wheel or drag moves it; a commanded move
      // has already chosen its volume, and passing others on the way mustn't flip it back
      const centred = wrapIndex(Math.round(carousel), n());
      if (following && centred !== selected && !drag.moved) select(centred);
    }
    books.forEach((book, i) => {
      if (book.root.parent !== shelf) return;
      let offset = i - carousel;
      offset -= Math.round(offset / n()) * n();
      const away = Math.abs(offset);
      const jumped = book.lastOffset !== null && Math.abs(offset - book.lastOffset) > n() * 0.5;
      const near = 1 - clamp(away, 0, 1);
      const x = offset * SPACING;
      const y = SHELF_TOP + book.base.height * 0.5 + near * 0.15;
      const z = 0.13 + near * 0.24 - Math.min(away, 2.8) * 0.07;
      const k = reduced ? 1000 : 12;
      // A volume wrapping round the loop jumps to the far end hidden, then fades in
      if (jumped) {
        book.root.position.x = x;
        book.opacity = 0;
      }
      book.lastOffset = offset;
      book.root.position.x = damp(book.root.position.x, x, k, dt);
      book.root.position.y = damp(book.root.position.y, y, k, dt);
      book.root.position.z = damp(book.root.position.z, z, k, dt);
      book.root.rotation.y = damp(book.root.rotation.y, -offset * 0.105, k, dt);
      book.root.rotation.z = damp(book.root.rotation.z, -offset * 0.018, k, dt);
      book.root.scale.setScalar(damp(book.root.scale.x, 1 + near * 0.09, k, dt));
      const fade = seamFade(away);
      setOpacity(book, reduced ? fade : damp(book.opacity, fade, 18, dt));
      const lifted = hovered === i && mode === "hero" && !reduced;
      const settle = reduced ? 1000 : 13;
      book.frontPivot.rotation.y = damp(book.frontPivot.rotation.y, lifted ? -0.085 : 0, settle, dt);
      for (const pivot of book.pagePivots) {
        pivot.rotation.y = damp(pivot.rotation.y, 0, settle, dt);
        pivot.rotation.z = damp(pivot.rotation.z, 0, settle, dt);
        flexPage(pivot, 0, dt);
      }
      const bob = reduced ? 0 : Math.sin(t * 0.72 + i * 0.8) * 0.012 * near;
      book.motion.position.y = damp(book.motion.position.y, bob + (lifted ? 0.035 : 0), 9, dt);
      book.motion.rotation.x = damp(book.motion.rotation.x, lifted ? ndc.y * 0.035 : 0, 10, dt);
      book.motion.rotation.y = damp(book.motion.rotation.y, lifted ? -ndc.x * 0.035 : 0, 10, dt);
    });
  };

  const stepMode = (dt: number) => {
    if (mode === "opening") {
      progress = Math.min(1, progress + dt / OPEN_SECONDS);
      flyOut(progress);
      if (active) poseBook(active, dt, 0);
      if (progress >= 1) finishOpening();
    } else if (mode === "closing") {
      progress = Math.min(1, progress + dt / CLOSE_SECONDS);
      flyHome(progress);
      if (active) poseBook(active, dt, 0);
      if (progress >= 1) finishClosing();
    } else if (mode === "hero") {
      shelf.position.y = damp(shelf.position.y, 0, 10, dt);
      shelf.position.z = damp(shelf.position.z, 0, 10, dt);
      camera.position.x = damp(camera.position.x, heroCam.x, 8, dt);
      camera.position.y = damp(camera.position.y, heroCam.y, 8, dt);
      camera.position.z = damp(camera.position.z, heroCam.z, 8, dt);
      lookAt.copy(heroTarget);
      viewOffset = 0;
      applyViewOffset();
      camera.lookAt(heroTarget);
    }
  };

  /**
   * The original drew every frame for a centimetre of idle bob. Here the shelf draws while
   * anything moves (the loop, a flight, a drag or gesture, the room easing to a new colour,
   * orbit damping) and for a moment after any input, then holds its last frame: the scene is
   * still when you are, and the GPU rests.
   */
  const frame = (now: number, dt: number, force = false) => {
    if (disposed || !books.length || !warmed) return;
    const busy = mode === "opening" || mode === "closing" || gesture.active || drag.active || tinting || awake > 0;
    if (!busy && !force) return;
    awake -= dt;
    const t = now / 1000;
    if (pointerDirty) updateHover();
    stepShelf(dt, t);
    stepMode(dt);
    easeRoom(dt);
    if (mode === "detail" && active) {
      if (gesture.active) gesture.velocity = damp(gesture.velocity, 0, 9, dt);
      if (controls.update()) wake(400);
      poseBook(active, dt, openness());
      if (!beside()) active.root.position.x = damp(active.root.position.x, detailBook.x + spreadShift(), reduced ? 1000 : 8, dt);
    }
    renderer.render(scene, camera);
    canvas.dataset.draws = String(++draws);
    if (mode === "detail") reportLayout();
  };

  // Where the inspected volume sits on screen, for the page and the suite: its box, and the
  // centre of the open spread's right-hand page (a click there opens that entry)
  const box = new Box3();
  const corner = new Vector3();
  const toScreen = (v: Vector3) => {
    v.project(camera);
    return [Math.round(((v.x + 1) / 2) * width), Math.round(((1 - v.y) / 2) * height)];
  };
  const reportLayout = () => {
    if (!active) return;
    // Every part but the generous pick box
    box.makeEmpty();
    for (const child of active.motion.children) if (child !== active.hit) box.expandByObject(child);
    let l = Infinity;
    let t = Infinity;
    let r = -Infinity;
    let b = -Infinity;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      const [x, y] = toScreen(corner);
      l = Math.min(l, x);
      r = Math.max(r, x);
      t = Math.min(t, y);
      b = Math.max(b, y);
    }
    canvas.dataset.bookBox = `${l},${t},${r},${b}`;
    const sheet = open && page < LEAVES ? active.pageSurfaces[(active.pagePivots.length - 1 - page) * 2] : null;
    if (sheet) {
      sheet.getWorldPosition(corner);
      canvas.dataset.rightPage = toScreen(corner).join(",");
    } else delete canvas.dataset.rightPage;
  };

  function wake(ms = 1000) {
    awake = Math.max(awake, ms / 1000);
  }

  /** Reduced motion has no ticker: draw now, with a step long enough for every damp to land */
  function kick(ms = 1000) {
    wake(ms);
    if (still) frame(performance.now(), 0.05, true);
  }
  controls.addEventListener("change", () => {
    wake(600);
    if (still && mode === "detail") renderer.render(scene, camera);
  });

  function resize() {
    layoutCamera();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (mode === "hero") {
      camera.position.copy(heroCam);
      lookAt.copy(heroTarget);
      viewOffset = 0;
      applyViewOffset();
      camera.lookAt(heroTarget);
    } else if (mode === "detail" && active) {
      active.root.scale.setScalar(detailFit());
      active.root.position.copy(detailBook);
      active.root.position.x += spreadShift();
      lookAt.copy(detailTarget);
      viewOffset = viewOffsetTarget;
      applyViewOffset();
      camera.position.copy(detailCam);
      controls.target.copy(detailTarget);
      controls.update();
    }
    // Nothing moves on a resize: one frame at the new size
    kick(1);
  }

  const serif = resolveFontFamily("--font-serif");
  const mono = resolveFontFamily("--font-mono");
  const script = resolveFontFamily("--font-script");
  const ready = Promise.all([
    loadFont(400, 100, serif),
    loadFont("italic 400", 30, serif),
    loadFont(500, 16, mono),
    loadFont(400, 20, script),
  ]).then(async () => {
    if (disposed) return;
    fonts = { serif, mono, script };
    // A page sends its volumes as the stage goes live, long before the fonts land; the lab sends none
    if (!volumes.length) volumes = SAMPLE_VOLUMES;
    buildBooks();
    // Nothing draws until every program is compiled (off the main thread where the driver
    // allows) and every texture is on the GPU, a few at a time, so the room's arrival keeps
    // moving instead of stalling on one long first frame
    try {
      await renderer.compileAsync(scene, camera);
    } catch {
      // the first frame compiles whatever is left
    }
    const textures = new Set<Texture>();
    scene.traverse((o) => {
      const material = (o as Mesh).material as Material | Material[] | undefined;
      for (const m of Array.isArray(material) ? material : material ? [material] : []) {
        for (const value of Object.values(m)) if ((value as Texture | null)?.isTexture) textures.add(value as Texture);
      }
    });
    let uploaded = 0;
    for (const t of textures) {
      if (disposed) return;
      renderer.initTexture(t);
      if (++uploaded % 6 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (disposed) return;
    warmed = true;
    canvas.dataset.ready = "1";
    kick(1);
  });

  setMode("hero");

  return {
    ready,

    resize(cssW, cssH, pr) {
      const w = Math.max(1, cssW);
      const h = Math.max(1, cssH);
      renderer.setPixelRatio(pr);
      // The runtime lowers the pixel ratio when frames run slow: same layout, same pose, one frame at the new resolution
      if (w === width && h === height) {
        renderer.setSize(width, height, false);
        kick(1);
        return;
      }
      width = w;
      height = h;
      resize();
    },

    render(_now, dt) {
      frame(_now, Math.min(dt / 1000, 0.05));
    },

    update(next) {
      opts = { ...opts, ...next };
      renderer.toneMappingExposure = opts.exposure;
      scene.environmentIntensity = opts.environment;
      if (renderer.shadowMap.enabled !== opts.shadows) {
        renderer.shadowMap.enabled = opts.shadows;
        scene.traverse((o) => {
          const m = (o as Mesh).material as { needsUpdate?: boolean } | undefined;
          if (m) m.needsUpdate = true;
        });
      }
      if (next.tint !== undefined && books.length) applyRoom(selected);
      kick();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      if (shared) {
        shared.dispose();
        shared = null;
        for (const m of roomMeshes) m.removeFromParent();
        roomMeshes.length = 0;
      }
      buildBooks();
      kick();
    },

    still() {
      still = true;
      reduced = true;
      controls.enableDamping = false;
      carousel = carouselTarget;
      frame(performance.now(), 0.05, true);
    },

    command(name, arg) {
      if (name === "volumes" && Array.isArray(arg)) {
        volumes = arg as ShelfVolume[];
        // The first build waits on the fonts in `ready`; later sets rebuild in place
        if (books.length) buildBooks();
      } else if (name === "surface") {
        if (arg instanceof HTMLElement) bind(arg);
        else unbind();
      } else if (name === "panel") {
        panelLeft = typeof arg === "number" ? arg : null;
        resize();
      } else if (name === "select" && typeof arg === "number") goTo(arg);
      else if (name === "step" && typeof arg === "number") step(Math.sign(arg));
      else if (name === "inspect") inspect();
      else if (name === "close") close();
      else if (name === "book") setOpen(typeof arg === "boolean" ? arg : !open);
      else if (name === "page" && typeof arg === "number") turn(Math.sign(arg));
      else if (name === "reset") resetView();
      // Each action wakes the shelf itself; state (volumes, surface, panel) needs at most one frame
    },

    dispose() {
      disposed = true;
      unbind();
      controls.dispose();
      for (const key of ["mode", "selected", "hover", "open", "page", "volumes", "source", "surface", "ready", "draws", "bookBox", "rightPage"]) delete canvas.dataset[key];
      for (const b of books) b.dispose();
      books = [];
      shared?.dispose();
      [walnut, walnutDark, contactMaterial, floorMaterial, wallMaterial].forEach((m) => m.dispose());
      sharedGrain.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
}
