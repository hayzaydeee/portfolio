import type { FxMeta } from "@/components/fx/runtime/types";

export type DockRetroOptions = {
  /** CSS px per drawing-buffer pixel; the canvas is upscaled with nearest-neighbour */
  pixelSize: number;
  speed: number;
  noise: number;
  /** Palette steps the field quantises to */
  levels: number;
  sourcePalette: boolean;
};

export const dockRetroMeta: FxMeta<DockRetroOptions> = {
  id: "dock-retro",
  label: "Dock · Retro Field",
  description:
    "The workshop dock's backdrop: slow fbm weather and a hot horizon, quantised to the room's palette through an 8×8 ordered dither.",
  source: { name: "ThreeUI · Animated Top Dock (retro)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl",
  priority: 3,
  pixelBudget: 0.3,
  rooms: ["workshop", "lobby", "studio"],
  defaults: { pixelSize: 4, speed: 1, noise: 1, levels: 7, sourcePalette: false },
  controls: [
    { kind: "range", key: "pixelSize", label: "pixel size", min: 2, max: 8, step: 1 },
    { kind: "range", key: "speed", label: "speed", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "noise", label: "weather", min: 0, max: 2, step: 0.05 },
    { kind: "range", key: "levels", label: "palette steps", min: 3, max: 8, step: 1 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
