import type { FxMeta } from "@/components/fx/runtime/types";

export type HzyOrbOptions = {
  /** Lattice cells across the mark */
  density: number;
  motion: "scan" | "sweep" | "diag";
  speed: number;
  sourcePalette: boolean;
  /** Any filled SVG path to sample instead of the HZY mark (e.g. a simple-icons glyph) */
  path: string;
  /** The path's viewBox size; simple-icons draw on 24 */
  viewBox: number;
};

export const hzyOrbMeta: FxMeta<HzyOrbOptions> = {
  id: "hzy-orb",
  label: "HZY Orb",
  description:
    "The HZY mark sampled into a dot lattice that sways in 3D while a crest of light runs through it. Small enough for indicators, loaders and buttons.",
  source: { name: "ThreeUI · Brand Orbs", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 0,
  pixelBudget: 0.3,
  rooms: ["lobby", "workshop", "studio", "notebook", "wall"],
  demoCommands: [{ label: "pulse", name: "pulse" }],
  defaults: { density: 48, motion: "scan", speed: 1, sourcePalette: false, path: "", viewBox: 24 },
  controls: [
    { kind: "range", key: "density", label: "density", min: 24, max: 72, step: 1 },
    {
      kind: "choice",
      key: "motion",
      label: "crest",
      options: [
        { value: "scan", label: "scan" },
        { value: "sweep", label: "sweep" },
        { value: "diag", label: "diagonal" },
      ],
    },
    { kind: "range", key: "speed", label: "speed", min: 0, max: 3, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
