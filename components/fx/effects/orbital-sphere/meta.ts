import type { FxMeta } from "@/components/fx/runtime/types";

export type OrbitalSphereOptions = {
  /** Rotation, as a multiple of the original's */
  speed: number;
  /** World size of a surface point */
  particleSize: number;
  particleOpacity: number;
  orbitOpacity: number;
  scale: number;
  haloOpacity: number;
  /** How far the sphere turns toward the pointer */
  parallax: number;
  /** A palette token key for the bright half of the surface, instead of the room glow */
  accent: string;
  sourcePalette: boolean;
};

export const orbitalSphereMeta: FxMeta<OrbitalSphereOptions> = {
  id: "orbital-sphere",
  label: "Orbital Sphere",
  description:
    "A sphere of points shaped by interfering waves, ringed by tilted orbits, three of them carrying a moon in a halo. Turns toward the pointer. A project page's identity field.",
  source: { name: "ThreeUI · Orbital Sphere", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl2",
  priority: 1,
  pixelBudget: 1.5,
  rooms: ["workshop", "lobby", "studio"],
  defaults: {
    speed: 1,
    particleSize: 0.015,
    particleOpacity: 0.8,
    orbitOpacity: 0.25,
    scale: 1,
    haloOpacity: 0.2,
    parallax: 0.35,
    accent: "",
    sourcePalette: false,
  },
  controls: [
    { kind: "range", key: "speed", label: "speed", min: 0, max: 4, step: 0.05 },
    { kind: "range", key: "particleSize", label: "point size", min: 0.005, max: 0.06, step: 0.001 },
    { kind: "range", key: "particleOpacity", label: "points", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "orbitOpacity", label: "orbits", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "haloOpacity", label: "halos", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "scale", label: "scale", min: 0.5, max: 1.6, step: 0.01 },
    { kind: "range", key: "parallax", label: "pointer lean", min: 0, max: 1, step: 0.01 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
