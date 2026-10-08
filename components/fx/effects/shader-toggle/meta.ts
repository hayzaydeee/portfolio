import type { FxMeta } from "@/components/fx/runtime/types";

export type ShaderToggleOptions = {
  /** The switch's state; the thumb springs to it */
  on: boolean;
  /** Plasma and spark speed */
  speed: number;
  sourcePalette: boolean;
};

export const shaderToggleMeta: FxMeta<ShaderToggleOptions> = {
  id: "shader-toggle",
  label: "Shader Toggle",
  description:
    "A capsule trough of warped plasma, threads and drifting sparks with a lit metal thumb on a spring. The light leans toward the pointer. Drawn behind a real switch.",
  source: { name: "ThreeUI · Skeuomorphic Toggle (shader)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl",
  priority: 1,
  pixelBudget: 0.2,
  rooms: ["studio", "lobby", "workshop"],
  defaults: { on: false, speed: 1, sourcePalette: false },
  controls: [
    { kind: "toggle", key: "on", label: "on" },
    { kind: "range", key: "speed", label: "speed", min: 0, max: 3, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
