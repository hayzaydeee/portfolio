import {
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  FrontSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
  type Side,
  type Texture,
  type WebGLRenderer,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  paintBack,
  paintBackFoil,
  paintClothMaps,
  paintContactShadow,
  paintCover,
  paintEdge,
  paintEndpaper,
  paintFrontFoil,
  paintLeaves,
  paintPaper,
  paintSpine,
  paintSpineFoil,
  paintWeave,
  type Fonts,
  type Look,
} from "./textures";

/**
 * One volume, built the way the original builds it: boards with turn-ins and hinge grooves,
 * cover art and a foil layer over each board, endpapers, a page block whose gutter is
 * compressed, six loose leaves on hinges (four printed, two blank) that flex like cloth as
 * they turn, headbands, a ribbon, signatures at the fore-edge and a soft contact shadow.
 */

/** Leaves that turn; their faces are the printed pages */
export const LEAVES = 4;
/** Spreads a reader sees: the title page, three inside, the colophon */
export const SPREADS = LEAVES + 1;
const PAGE_SEGMENTS_X = 18;
const PAGE_SEGMENTS_Y = 8;

export type Flex = {
  curve: number;
  curveVelocity: number;
  twist: number;
  twistVelocity: number;
  surfaces: { geometry: PlaneGeometry; base: Float32Array; direction: 1 | -1 }[];
};

export type Book = {
  index: number;
  root: Group;
  motion: Group;
  frontPivot: Group;
  frontCover: Mesh;
  pagePivots: Group[];
  /** Front and back sheet of each pivot, in pivot order */
  pageSurfaces: Mesh[];
  pageGestureSurfaces: Mesh[];
  hit: Mesh;
  contactShadow: Mesh;
  fadeMaterials: Material[];
  base: { width: number; height: number; depth: number };
  opacity: number;
  lastOffset: number | null;
  /** Paints the printed leaves the first time the volume is taken down */
  printLeaves: () => void;
  dispose: () => void;
};

/** Resources every volume shares; built once per scene */
export type Shared = {
  box: BoxGeometry;
  plane: PlaneGeometry;
  paper: Texture;
  edges: { fore: Texture; head: Texture };
  contact: Texture;
  dispose: () => void;
};

export function texture(renderer: WebGLRenderer, source: HTMLCanvasElement, { colour = true, anisotropy = 16 } = {}) {
  const t = new CanvasTexture(source);
  if (colour) t.colorSpace = SRGBColorSpace;
  t.anisotropy = Math.min(anisotropy, renderer.capabilities.getMaxAnisotropy());
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export function createShared(renderer: WebGLRenderer, paper: string, edge: string): Shared {
  const paperTex = texture(renderer, paintPaper(512, 768, paper));
  const fore = texture(renderer, paintEdge(512, 2048, "fore", edge));
  const head = texture(renderer, paintEdge(2048, 384, "head", edge));
  const contact = texture(renderer, paintContactShadow(), { colour: false, anisotropy: 8 });
  const box = new BoxGeometry(1, 1, 1);
  const plane = new PlaneGeometry(1, 1);
  return {
    box,
    plane,
    paper: paperTex,
    edges: { fore, head },
    contact,
    dispose() {
      [paperTex, fore, head, contact].forEach((t) => t.dispose());
      box.dispose();
      plane.dispose();
    },
  };
}

/** A flat rounded rectangle with UVs across its box, for art and endpapers laid on a board */
function roundedPlane(w: number, h: number, radius: number) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const r = Math.min(radius, hw, hh);
  const shape = new Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  const geometry = new ShapeGeometry(shape, 8);
  const pos = geometry.getAttribute("position");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    uv[i * 2] = (pos.getX(i) + hw) / w;
    uv[i * 2 + 1] = (pos.getY(i) + hh) / h;
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** The text block, its faces drawn in toward the spine where the binding holds them */
function pageBlock(w: number, h: number, d: number, radius: number) {
  const geometry = new RoundedBoxGeometry(w, h, d, 4, radius);
  const pos = geometry.getAttribute("position");
  const half = w * 0.5;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const u = Math.min(1, Math.max(0, (x + half) / w));
    const k = Math.min(1, Math.max(0, u / 0.16));
    const gutter = (1 - k * k * (3 - 2 * k)) * 0.012;
    const ripple = Math.pow(u, 8) * Math.sin(pos.getY(i) * 31) * 0.00055;
    pos.setZ(i, Math.sign(z || 1) * Math.max(0, Math.abs(z) - gutter + ripple));
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

const mesh = (geometry: BufferGeometry, material: Material, name: string, cast = true, receive = true) => {
  const m = new Mesh(geometry, material);
  m.name = name;
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
};

const srgb = (css: string) => new Color().setStyle(css, SRGBColorSpace);

export type VolumeSize = { width: number; height: number; depth: number };

export function buildBook(
  renderer: WebGLRenderer,
  shared: Shared,
  look: Look,
  fonts: Fonts,
  size: VolumeSize,
  index: number,
  shelfDark: Color
): Book {
  const root = new Group();
  root.name = `book-${look.vol.id}`;
  root.userData.index = index;
  const motion = new Group();
  root.add(motion);

  const { width: a, height: n, depth: c } = size;
  const board = 0.032;
  const coverRadius = 0.0045;
  const pageRadius = 0.0025;
  const spineRadius = 0.0015;
  const spineBoard = 0.014;
  const gutter = 0.082;
  const pageW = a - 0.074;
  const pageH = n - 0.068;
  const blockD = c - 0.026;

  const tex = (src: HTMLCanvasElement, opts?: { colour?: boolean; anisotropy?: number }) => texture(renderer, src, opts);
  const owned: Texture[] = [];
  const own = <T extends Texture>(t: T) => {
    owned.push(t);
    return t;
  };

  const cover = own(tex(paintCover(look, 640, 960)));
  const foil = own(tex(paintFrontFoil(look, fonts, 640, 960)));
  const weave = own(tex(paintWeave(look), { colour: false, anisotropy: 12 }));
  weave.wrapS = weave.wrapT = RepeatWrapping;
  weave.repeat.set(5, 8);
  const maps = paintClothMaps(look);
  const clothNormal = own(tex(maps.normal, { colour: false, anisotropy: 12 }));
  const clothRough = own(tex(maps.rough, { colour: false, anisotropy: 12 }));
  for (const t of [clothNormal, clothRough]) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(5, 8);
  }
  const endpaper = own(tex(paintEndpaper(look)));
  const spine = own(tex(paintSpine(look)));
  const spineFoil = own(tex(paintSpineFoil(look, fonts)));
  const back = own(tex(paintBack(look, 512, 768)));
  const backFoil = own(tex(paintBackFoil(look, fonts, 512, 768)));
  const paper = shared.paper;

  const clothColour = srgb(look.cloth);
  const foilColour = srgb(look.foil);
  const paperColour = srgb(look.paper);

  const cloth = new MeshPhysicalMaterial({
    color: clothColour,
    normalMap: clothNormal,
    normalScale: new Vector2(0.34, 0.34),
    roughnessMap: clothRough,
    roughness: 0.98,
    metalness: 0.02,
    bumpMap: weave,
    bumpScale: 0.0045,
    sheen: 0.34,
    sheenRoughness: 0.76,
    sheenColor: foilColour,
    transparent: true,
  });
  const coverArt = new MeshPhysicalMaterial({
    map: cover,
    normalMap: clothNormal,
    normalScale: new Vector2(0.28, 0.28),
    roughnessMap: clothRough,
    bumpMap: weave,
    bumpScale: 0.0035,
    roughness: 0.92,
    metalness: 0.035,
    clearcoat: 0.06,
    clearcoatRoughness: 0.72,
    sheen: 0.26,
    sheenRoughness: 0.78,
    transparent: true,
  });
  // The foil masks double as their own emboss: the original re-uploaded each as a separate bump texture
  const foilLayer = (map: Texture, bumpScale: number, roughness: number, metalness: number, clearcoat: number, side: Side = FrontSide) =>
    new MeshPhysicalMaterial({
      color: foilColour,
      map,
      alphaMap: map,
      bumpMap: map,
      bumpScale,
      roughness,
      metalness,
      // Gilt catches the room's light; a little of its own keeps the type legible in a soft room
      emissive: foilColour,
      emissiveIntensity: 0.16,
      clearcoat,
      clearcoatRoughness: 0.13,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      side,
    });
  const frontFoil = foilLayer(foil, 0.016, 0.3, 0.78, 0.18);
  const spineFoilMat = foilLayer(spineFoil, 0.017, 0.3, 0.76, 0.16, DoubleSide);
  const backFoilMat = foilLayer(backFoil, 0.016, 0.32, 0.74, 0.14, DoubleSide);
  const spineCloth = new MeshPhysicalMaterial({
    map: spine,
    normalMap: clothNormal,
    normalScale: new Vector2(0.3, 0.3),
    roughnessMap: clothRough,
    bumpMap: weave,
    bumpScale: 0.004,
    roughness: 0.95,
    metalness: 0.025,
    sheen: 0.27,
    sheenRoughness: 0.78,
    transparent: true,
    side: DoubleSide,
  });
  const backArt = new MeshPhysicalMaterial({
    map: back,
    normalMap: clothNormal,
    normalScale: new Vector2(0.28, 0.28),
    roughnessMap: clothRough,
    bumpMap: weave,
    bumpScale: 0.0035,
    roughness: 0.96,
    metalness: 0.025,
    sheen: 0.25,
    sheenRoughness: 0.8,
    transparent: true,
    side: DoubleSide,
  });
  const endpaperMat = new MeshPhysicalMaterial({
    color: paperColour.clone().lerp(new Color(1, 1, 1), 0.5),
    map: endpaper,
    bumpMap: paper,
    bumpScale: 0.0018,
    roughness: 0.94,
    metalness: 0,
    sheen: 0.025,
    sheenRoughness: 1,
    side: DoubleSide,
    transparent: true,
  });
  const edgeMat = (map: Texture, bumpScale: number, sheen: number) =>
    new MeshPhysicalMaterial({
      color: 0xffffff,
      map,
      bumpMap: map,
      bumpScale,
      roughness: 0.93,
      metalness: 0,
      sheen,
      sheenRoughness: 1,
      side: DoubleSide,
      transparent: true,
    });
  const foreEdge = edgeMat(shared.edges.fore, 0.0022, 0.018);
  const headEdge = edgeMat(shared.edges.head, 0.0015, 0.014);
  const groove = new MeshPhysicalMaterial({
    color: clothColour.clone().multiplyScalar(0.42),
    roughness: 0.9,
    metalness: 0,
    bumpMap: weave,
    bumpScale: 0.006,
    side: DoubleSide,
    transparent: true,
  });
  const block = new MeshPhysicalMaterial({
    color: paperColour,
    map: paper,
    bumpMap: paper,
    bumpScale: 0.0014,
    roughness: 0.95,
    metalness: 0,
    sheen: 0.025,
    sheenRoughness: 1,
    transparent: true,
  });
  const headband = new MeshPhysicalMaterial({
    color: foilColour.clone().lerp(clothColour, 0.2),
    roughness: 0.58,
    metalness: 0.16,
    sheen: 0.14,
    sheenRoughness: 0.76,
    transparent: true,
  });
  const sheet = () =>
    new MeshPhysicalMaterial({
      color: paperColour.clone().lerp(new Color(1, 1, 1), 0.25),
      map: paper,
      bumpMap: paper,
      bumpScale: 0.0012,
      roughness: 0.96,
      metalness: 0,
      sheen: 0.02,
      sheenRoughness: 1,
      side: FrontSide,
      transparent: true,
    });
  // Printed leaves start on plain stock (the same shader), and take their pages on first inspection
  const printed = Array.from({ length: LEAVES * 2 }, sheet);
  const blank = sheet();
  const signature = new MeshPhysicalMaterial({
    color: paperColour.clone().multiplyScalar(0.36).lerp(paperColour, 0.34),
    roughness: 0.98,
    metalness: 0,
    transparent: true,
  });
  const ribbon = new MeshPhysicalMaterial({
    color: foilColour.clone().lerp(clothColour, 0.28),
    roughness: 0.62,
    metalness: 0.08,
    sheen: 0.36,
    sheenRoughness: 0.68,
    side: DoubleSide,
    transparent: true,
  });

  const boardGeo = new RoundedBoxGeometry(a, n, board, 2, coverRadius);
  const blockGeo = pageBlock(pageW, pageH, blockD, pageRadius);
  const artGeo = roundedPlane(a - 0.007, n - 0.007, 0.0035);
  const endGeo = roundedPlane(a - 0.045, n - 0.045, 0.003);
  const geometries: BufferGeometry[] = [boardGeo, blockGeo, artGeo, endGeo];

  const blockMesh = mesh(blockGeo, block, "page-block");
  blockMesh.position.x = 0.018;
  motion.add(blockMesh);

  const turnIns = (pivot: Group, z: number) => {
    const t = 0.018;
    const sw = a - 0.0126;
    const sh = n - t * 2.2;
    const strips: [number, number, number, number][] = [
      [a * 0.5, n * 0.5 - t * 0.56, sw, t],
      [a * 0.5, -n * 0.5 + t * 0.56, sw, t],
      [t * 0.56, 0, t, sh],
      [a - t * 0.56, 0, t, sh],
    ];
    for (const [x, y, w, h] of strips) {
      const strip = mesh(shared.box, cloth, "turn-in", false, true);
      strip.scale.set(w, h, 0.002);
      strip.position.set(x, y, z);
      pivot.add(strip);
    }
  };

  // Back board, hinged at the spine
  const backPivot = new Group();
  backPivot.position.set(-a * 0.5, 0, -c * 0.5 - board * 0.5);
  const backBoard = mesh(boardGeo, cloth, "back-cover");
  backBoard.position.x = a * 0.5;
  backPivot.add(backBoard);
  const backArtMesh = mesh(artGeo, backArt, "back-art", false, false);
  backArtMesh.position.set(a * 0.5, 0, -board * 0.55);
  backArtMesh.rotation.y = Math.PI;
  backPivot.add(backArtMesh);
  const backFoilMesh = mesh(artGeo, backFoilMat, "back-foil", false, false);
  backFoilMesh.position.set(a * 0.5, 0, -board * 0.605);
  backFoilMesh.rotation.y = Math.PI;
  backPivot.add(backFoilMesh);
  const backEnd = mesh(endGeo, endpaperMat, "back-endpaper", false, true);
  backEnd.position.set(a * 0.5, 0, board * 0.515);
  backPivot.add(backEnd);
  turnIns(backPivot, board * 0.53);
  const backGroove = mesh(shared.plane, groove, "back-groove", false, false);
  backGroove.scale.set(0.012, n * 0.94, 1);
  backGroove.position.set(0.038, 0, -board * 0.535);
  backGroove.rotation.y = Math.PI;
  backPivot.add(backGroove);
  motion.add(backPivot);

  // Front board, the one that opens
  const frontPivot = new Group();
  frontPivot.position.set(-a * 0.5, 0, c * 0.5 + board * 0.5);
  const frontCover = mesh(boardGeo, cloth, "front-cover");
  frontCover.position.x = a * 0.5;
  frontPivot.add(frontCover);
  const coverMesh = mesh(artGeo, coverArt, "cover-art", false, false);
  coverMesh.position.set(a * 0.5, 0, board * 0.55);
  frontPivot.add(coverMesh);
  const foilMesh = mesh(artGeo, frontFoil, "front-foil", false, false);
  foilMesh.position.set(a * 0.5, 0, board * 0.605);
  frontPivot.add(foilMesh);
  const frontEnd = mesh(endGeo, endpaperMat, "front-endpaper", false, true);
  frontEnd.position.set(a * 0.5, 0, -board * 0.515);
  frontEnd.rotation.y = Math.PI;
  frontPivot.add(frontEnd);
  turnIns(frontPivot, -board * 0.53);
  const frontGroove = mesh(shared.plane, groove, "front-groove", false, false);
  frontGroove.scale.set(0.012, n * 0.94, 1);
  frontGroove.position.set(0.038, 0, board * 0.655);
  frontPivot.add(frontGroove);
  motion.add(frontPivot);

  // Six loose leaves on hinges; the top four carry the printed faces
  const pagePivots: Group[] = [];
  const pageSurfaces: Mesh[] = [];
  const leafW = pageW - gutter * 0.42;
  for (let z = 0; z < 6; z += 1) {
    const leaf = 5 - z;
    const front = leaf < LEAVES ? printed[leaf * 2] : blank;
    const rear = leaf < LEAVES ? printed[leaf * 2 + 1] : blank;
    const pivot = new Group();
    pivot.position.set(-a * 0.5 + gutter * 0.65, 0, blockD * 0.5 + 0.0015 + z * 0.0015);
    pivot.userData.leaf = leaf;
    pivot.userData.restZ = pivot.position.z;
    pivot.userData.turnedZ = c * 0.5 + board + 0.004 + leaf * 0.0015;
    const frontGeo = new PlaneGeometry(1, 1, PAGE_SEGMENTS_X, PAGE_SEGMENTS_Y);
    const rearGeo = new PlaneGeometry(1, 1, PAGE_SEGMENTS_X, PAGE_SEGMENTS_Y);
    geometries.push(frontGeo, rearGeo);
    const frontSheet = mesh(frontGeo, front, "page-front", false, true);
    frontSheet.scale.set(leafW, pageH - 0.014, 1);
    frontSheet.position.set(leafW * 0.5, 0, 0.00022);
    frontSheet.userData.face = leaf < LEAVES ? leaf * 2 : -1;
    pivot.add(frontSheet);
    pageSurfaces.push(frontSheet);
    const rearSheet = mesh(rearGeo, rear, "page-back", false, true);
    rearSheet.scale.set(leafW, pageH - 0.014, 1);
    rearSheet.position.set(leafW * 0.5, 0, -0.00022);
    rearSheet.rotation.y = Math.PI;
    rearSheet.userData.face = leaf < LEAVES ? leaf * 2 + 1 : -1;
    pivot.add(rearSheet);
    pageSurfaces.push(rearSheet);
    const flex: Flex = {
      curve: 0,
      curveVelocity: 0,
      twist: 0,
      twistVelocity: 0,
      surfaces: [
        { geometry: frontGeo, base: Float32Array.from(frontGeo.attributes.position.array), direction: 1 },
        { geometry: rearGeo, base: Float32Array.from(rearGeo.attributes.position.array), direction: -1 },
      ],
    };
    pivot.userData.flex = flex;
    motion.add(pivot);
    pagePivots.push(pivot);
  }

  // Flat spine with its foil, the lining behind the block, headbands, ribbon
  const spineGeo = new RoundedBoxGeometry(spineBoard, n - 0.012, c + board * 1.88, 1, spineRadius);
  geometries.push(spineGeo);
  const spineMesh = mesh(spineGeo, spineCloth, "spine");
  spineMesh.position.x = -a * 0.5 - spineBoard * 0.35;
  motion.add(spineMesh);
  const spineFoilMesh = mesh(shared.plane, spineFoilMat, "spine-foil", false, false);
  spineFoilMesh.scale.set(c + board * 1.82, n - 0.018, 1);
  spineFoilMesh.rotation.y = -Math.PI * 0.5;
  spineFoilMesh.position.set(spineMesh.position.x - spineBoard * 0.505, 0, 0);
  motion.add(spineFoilMesh);
  const liningGeo = new RoundedBoxGeometry(gutter * 0.68, n - 0.056, Math.max(0.045, blockD - 0.008), 1, 0.0015);
  geometries.push(liningGeo);
  const lining = mesh(liningGeo, endpaperMat, "spine-lining");
  lining.position.set(-a * 0.5 + gutter * 0.38, 0, 0);
  motion.add(lining);
  const bandGeo = new CylinderGeometry(0.012, 0.012, blockD * 0.88, 12, 1, false);
  geometries.push(bandGeo);
  for (const side of [-1, 1]) {
    const band = mesh(bandGeo, headband, "headband");
    band.rotation.x = Math.PI * 0.5;
    band.position.set(-pageW * 0.5 + 0.046, side * (pageH * 0.5 - 0.004), 0);
    motion.add(band);
  }
  const ribbonGeo = roundedPlane(0.034, pageH * 0.76, 0.002);
  geometries.push(ribbonGeo);
  const ribbonMesh = mesh(ribbonGeo, ribbon, "ribbon", false, true);
  ribbonMesh.position.set(-pageW * 0.5 + 0.09 + (look.seed % 3) * 0.018, -pageH * 0.17, blockD * 0.5 + 0.003);
  ribbonMesh.rotation.z = (look.seed % 2 ? -1 : 1) * 0.014;
  motion.add(ribbonMesh);

  // Signatures showing at the fore-edge, then the cut edges themselves
  for (let s = 0; s < 6; s += 1) {
    const sig = mesh(shared.box, signature, "signature", false, true);
    sig.scale.set(0.0035, 0.00135, blockD * 0.91);
    sig.position.set(0.018 + pageW * 0.5 + 0.001, -pageH * 0.5 + ((s + 1) / 7) * pageH, 0);
    motion.add(sig);
  }
  const fore = mesh(shared.plane, foreEdge, "fore-edge", false, true);
  fore.scale.set(blockD * 0.94, pageH - 0.028, 1);
  fore.rotation.y = Math.PI * 0.5;
  fore.position.set(0.018 + pageW * 0.5 + 0.002, 0, 0);
  motion.add(fore);
  for (const side of [-1, 1]) {
    const edge = mesh(shared.plane, headEdge, side > 0 ? "head-edge" : "tail-edge", false, true);
    edge.scale.set(pageW - 0.035, blockD * 0.94, 1);
    edge.rotation.x = side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
    edge.position.set(0.018, side * (pageH * 0.5 + 0.002), 0);
    motion.add(edge);
  }

  // A generous invisible box for picking the volume off the shelf
  const hitMat = new MeshBasicMaterial({ visible: false });
  const hit = mesh(shared.box, hitMat, "hit", false, false);
  hit.scale.set(a * 1.34, n * 1.2, Math.max(c * 4, 1));
  hit.position.set(-gutter * 0.18, 0, 0.12);
  hit.userData.index = index;
  motion.add(hit);

  const shadowMat = new MeshBasicMaterial({
    color: shelfDark,
    alphaMap: shared.contact,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: DoubleSide,
  });
  const contactShadow = mesh(shared.plane, shadowMat, "contact-shadow", false, false);
  contactShadow.scale.set(a * 1.22, c * 2.05, 1);
  contactShadow.rotation.x = -Math.PI * 0.5;
  contactShadow.position.set(0, -n * 0.5 - 0.022, 0.025);
  root.add(contactShadow);

  const fadeMaterials: Material[] = [
    cloth,
    coverArt,
    frontFoil,
    spineCloth,
    spineFoilMat,
    backArt,
    backFoilMat,
    endpaperMat,
    foreEdge,
    headEdge,
    groove,
    block,
    ...printed,
    blank,
    headband,
    signature,
    ribbon,
  ];

  let leaves: Texture[] | null = null;

  return {
    index,
    root,
    motion,
    frontPivot,
    frontCover,
    pagePivots,
    pageSurfaces,
    pageGestureSurfaces: [...pageSurfaces, blockMesh],
    hit,
    contactShadow,
    fadeMaterials,
    base: { width: a, height: n, depth: c },
    opacity: 1,
    lastOffset: null,
    printLeaves() {
      if (leaves) return;
      leaves = paintLeaves(look, fonts).map((canvas) => tex(canvas));
      printed.forEach((m, i) => {
        m.map = leaves![i];
      });
    },
    dispose() {
      [...fadeMaterials, hitMat, shadowMat].forEach((m) => m.dispose());
      geometries.forEach((g) => g.dispose());
      owned.forEach((t) => t.dispose());
      leaves?.forEach((t) => t.dispose());
    },
  };
}

/** The walnut shelf's two materials, tinted from the room, grained by a shared texture */
export function shelfMaterials(grain: Texture | null) {
  const walnut = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.58, metalness: 0, map: grain });
  const walnutDark = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0, map: grain });
  return { walnut, walnutDark };
}
