import type { FxMeta } from "@/components/fx/runtime/types";

export type WarpKeycapsOptions = {
  /** Units per 60fps frame, as the original */
  speed: number;
  streakOpacity: number;
  /** Keycaps and their legends */
  tileOpacity: number;
  fov: number;
  /** How far the camera turns toward the pointer */
  parallax: number;
  /** Where the legends come from (a project's title) */
  text: string;
  /** A palette token key to light the field in instead of the room glow */
  accent: string;
  sourcePalette: boolean;
};

export const warpKeycapsMeta: FxMeta<WarpKeycapsOptions> = {
  id: "warp-keycaps",
  label: "Warp Field (keycaps)",
  description:
    "Lit, bevelled keycaps carrying the letters of a project's name, tumbling through a tunnel of streaks and glow. Keys dip as the pointer passes over them; a click surges the field. A project page's identity field.",
  source: { name: "ThreeUI · Warp Field (keycaps)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl2",
  priority: 1,
  pixelBudget: 1.5,
  wantsClicks: true,
  rooms: ["workshop", "lobby", "studio"],
  defaults: { speed: 15, streakOpacity: 0.6, tileOpacity: 0.9, fov: 75, parallax: 0.4, text: "", accent: "", sourcePalette: false },
  controls: [
    { kind: "range", key: "speed", label: "speed", min: 0, max: 40, step: 0.5 },
    { kind: "range", key: "streakOpacity", label: "streaks", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "tileOpacity", label: "keycaps", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "fov", label: "field of view", min: 40, max: 110, step: 1 },
    { kind: "range", key: "parallax", label: "pointer lean", min: 0, max: 1, step: 0.01 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
  demoCommands: [{ label: "surge", name: "surge" }],
};
