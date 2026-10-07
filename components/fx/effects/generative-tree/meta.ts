import type { FxMeta } from "@/components/fx/runtime/types";

export type GenerativeTreeOptions = {
  /** Branching generations */
  depth: number;
  /** Pollen drifting up through the canopy */
  particles: number;
  /** Growth speed when nothing drives the progress (lab, harness) */
  speed: number;
  /** How far the branches sway in the wind */
  sway: number;
  sourcePalette: boolean;
};

export const generativeTreeMeta: FxMeta<GenerativeTreeOptions> = {
  id: "generative-tree",
  label: "Generative Tree",
  description:
    "A painterly branching tree. Driven by a section's progress it grows and ungrows with the scroll; left alone it grows, holds and regrows. The pointer pushes wind through it and a click shakes it. Commands: progress (0 to 1), anchors (tip positions for labels), shake.",
  source: { name: "ThreeUI · Generative Tree", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 1,
  pixelBudget: 1.5,
  wantsClicks: true,
  rooms: ["lobby", "workshop", "studio", "notebook", "wall"],
  demoCommands: [
    { label: "shake", name: "shake" },
    { label: "progress 0.3", name: "progress", arg: 0.3 },
    { label: "progress 1", name: "progress", arg: 1 },
  ],
  defaults: { depth: 9, particles: 40, speed: 1, sway: 1, sourcePalette: false },
  controls: [
    { kind: "range", key: "depth", label: "generations", min: 6, max: 11, step: 1 },
    { kind: "range", key: "particles", label: "pollen", min: 0, max: 120, step: 1 },
    { kind: "range", key: "speed", label: "growth speed", min: 0.2, max: 3, step: 0.05 },
    { kind: "range", key: "sway", label: "sway", min: 0, max: 2.5, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
