import type { FxMeta } from "@/components/fx/runtime/types";

export type CondensationOptions = {
  speed: number;
  /** Share of the original's droplet count */
  dropAmount: number;
  opacity: number;
  sourcePalette: boolean;
};

export const condensationMeta: FxMeta<CondensationOptions> = {
  id: "condensation",
  label: "Condensation",
  description:
    "Droplets bead on glass, swell, and run once they're heavy, swallowing the beads below and splashing at the sill. Drawn on a clear canvas, for behind text.",
  source: { name: "ThreeUI · Condensation", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 0,
  pixelBudget: 1,
  rooms: ["workshop", "lobby", "studio", "notebook", "wall"],
  defaults: { speed: 1, dropAmount: 1, opacity: 0.8, sourcePalette: false },
  controls: [
    { kind: "range", key: "speed", label: "speed", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "dropAmount", label: "droplets", min: 0.2, max: 2, step: 0.05 },
    { kind: "range", key: "opacity", label: "opacity", min: 0, max: 1, step: 0.01 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
