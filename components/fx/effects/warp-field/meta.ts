import type { FxMeta } from "@/components/fx/runtime/types";

export type WarpFieldOptions = {
  /** Units per 60fps frame, as the original */
  speed: number;
  streakOpacity: number;
  tileOpacity: number;
  fov: number;
  /** Fly letter tiles through the streaks */
  letters: boolean;
  /** Where the letters come from (a project's title) */
  text: string;
  /** A palette token key to draw in instead of the room glow */
  accent: string;
  sourcePalette: boolean;
};

export const warpFieldMeta: FxMeta<WarpFieldOptions> = {
  id: "warp-field",
  label: "Warp Field",
  description:
    "Streaks of light rushing past a perspective camera, with letter tiles from a project's own name tumbling through them. A project page's identity field.",
  source: { name: "ThreeUI · Warp Field (letters)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl",
  priority: 1,
  pixelBudget: 1.5,
  rooms: ["workshop", "lobby", "studio"],
  defaults: { speed: 15, streakOpacity: 0.6, tileOpacity: 0.9, fov: 75, letters: true, text: "", accent: "", sourcePalette: false },
  controls: [
    { kind: "range", key: "speed", label: "speed", min: 0, max: 40, step: 0.5 },
    { kind: "range", key: "streakOpacity", label: "streaks", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "tileOpacity", label: "letters", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "fov", label: "field of view", min: 40, max: 110, step: 1 },
    { kind: "toggle", key: "letters", label: "letter tiles" },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
