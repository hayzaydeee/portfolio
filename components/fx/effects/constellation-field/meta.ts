import type { FxMeta } from "@/components/fx/runtime/types";

export type ConstellationFieldOptions = {
  /** Share of the original's node count */
  density: number;
  /** Link distance in CSS px */
  link: number;
  speed: number;
  /** A palette token key (e.g. "workshop-syntax") to draw in instead of the room glow */
  accent: string;
  sourcePalette: boolean;
};

export const constellationFieldMeta: FxMeta<ConstellationFieldOptions> = {
  id: "constellation-field",
  label: "Constellation Field",
  description: "Drifting nodes joined by fading links, gently drawn toward the pointer. A project page's identity field.",
  source: { name: "ThreeUI · Constellation Field", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 1,
  pixelBudget: 1.5,
  rooms: ["workshop", "lobby", "studio", "notebook", "wall"],
  defaults: { density: 1, link: 160, speed: 1, accent: "", sourcePalette: false },
  controls: [
    { kind: "range", key: "density", label: "nodes", min: 0.2, max: 2, step: 0.05 },
    { kind: "range", key: "link", label: "link distance", min: 60, max: 260, step: 5 },
    { kind: "range", key: "speed", label: "drift", min: 0, max: 3, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
