import type { FxMeta } from "@/components/fx/runtime/types";

export type IgnitionOptions = {
  /** Stars in the tunnel */
  stars: number;
  speed: number;
  sourcePalette: boolean;
};

export const ignitionMeta: FxMeta<IgnitionOptions> = {
  id: "ignition",
  label: "Ignition",
  description:
    "A small star tunnel for the inside of a button: it idles, streaks into warp while the button is primed (hover or focus), and flashes white on press. Commands: warp (true/false), flash.",
  source: { name: "ThreeUI · Ignition Button", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 0,
  pixelBudget: 0.15,
  rooms: ["workshop", "lobby", "studio", "notebook", "wall"],
  demoCommands: [
    { label: "prime", name: "warp", arg: true },
    { label: "release", name: "warp", arg: false },
    { label: "fire", name: "flash" },
  ],
  defaults: { stars: 90, speed: 1, sourcePalette: false },
  controls: [
    { kind: "range", key: "stars", label: "stars", min: 20, max: 200, step: 1 },
    { kind: "range", key: "speed", label: "speed", min: 0, max: 3, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
