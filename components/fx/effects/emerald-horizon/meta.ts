import type { FxMeta } from "@/components/fx/runtime/types";

export type EmeraldHorizonOptions = {
  speed: number;
  waveScale: number;
  variation: number;
  glow: number;
  vignette: number;
  brightness: number;
  /** 0 = horizon below the frame, 1 = resting position */
  rise: number;
  sourcePalette: boolean;
};

export const emeraldHorizonMeta: FxMeta<EmeraldHorizonOptions> = {
  id: "emerald-horizon",
  label: "Emerald Horizon",
  description:
    "A glow rising off an organic, moving horizon. Commands: rise (enter), tint (lerp toward another room), slide (per-section camera).",
  source: { name: "ThreeUI · Emerald Horizon", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl",
  priority: 2,
  pixelBudget: 2.4,
  rooms: ["lobby", "workshop", "studio"],
  demoCommands: [
    { label: "rise from below", name: "rise", arg: { from: 0, to: 1 } },
    { label: "tint → studio", name: "tint", arg: "studio" },
    { label: "tint → workshop", name: "tint", arg: "workshop" },
    { label: "tint → home", name: "tint", arg: null },
    { label: "slide: lift", name: "slide", arg: { lift: 0.25, glow: 1.2, wave: 1.4 } },
    { label: "slide: rest", name: "slide", arg: { lift: 0, glow: 1, wave: 1 } },
  ],
  defaults: {
    speed: 1,
    waveScale: 1,
    variation: 1,
    glow: 1.3,
    vignette: 1,
    brightness: 1,
    rise: 1,
    sourcePalette: false,
  },
  controls: [
    { kind: "range", key: "speed", label: "speed", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "waveScale", label: "wave height", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "variation", label: "variation", min: 0, max: 2, step: 0.05 },
    { kind: "range", key: "glow", label: "glow", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "vignette", label: "vignette", min: 0, max: 1, step: 0.05 },
    { kind: "range", key: "brightness", label: "brightness", min: 0.35, max: 1.65, step: 0.05 },
    { kind: "range", key: "rise", label: "rise", min: 0, max: 1.5, step: 0.01 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
