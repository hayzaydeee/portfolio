import type { FxMeta } from "@/components/fx/runtime/types";

export type ParticleDriftOptions = {
  /** The characters that drift (the page passes the entry's own letters, or a code set) */
  glyphs: string;
  /** Colour token for the rising beams and the glyphs the pointer catches */
  ink: string;
  /** The glyphs' face: the room's mono or its serif */
  face: "mono" | "serif";
  /** Glyphs and beams per area, as a multiple of the original's */
  density: number;
  /** Drift and beam speed, as a multiple of the original's */
  speed: number;
  /** The fast beams rising through the field */
  beams: boolean;
};

export const DRIFT_DEFAULT_GLYPHS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*()";

export const particleDriftMeta: FxMeta<ParticleDriftOptions> = {
  id: "particle-drift",
  label: "Particle Drift",
  description:
    "Characters drift slowly down through fast rising beams, joined by faint lines where they pass close. The pointer catches the nearest ones: they turn the accent colour, change character and reach for it.",
  source: { name: "ThreeUI · Particle Drift", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 0,
  pixelBudget: 0.8,
  rooms: ["notebook", "lobby", "workshop", "studio", "wall"],
  defaults: { glyphs: DRIFT_DEFAULT_GLYPHS, ink: "notebook-fragments", face: "mono", density: 1, speed: 1, beams: true },
  controls: [
    { kind: "range", key: "density", label: "density", min: 0.2, max: 2, step: 0.05 },
    { kind: "range", key: "speed", label: "speed", min: 0, max: 3, step: 0.05 },
    { kind: "toggle", key: "beams", label: "beams" },
  ],
};
