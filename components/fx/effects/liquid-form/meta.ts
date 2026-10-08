import type { FxMeta } from "@/components/fx/runtime/types";

export type LiquidFormOptions = {
  speed: number;
  /** How far the surface swells and folds */
  morph: number;
  noiseScale: number;
  /** How far the pointer leans the camera and the key light */
  mouseAmount: number;
  metal: number;
  /** Camera distance; further back, a smaller form */
  camera: number;
  /** How far the studio lights lean into the room's colours */
  tint: number;
  /** How hard the music swells the form */
  audioGain: number;
  sourcePalette: boolean;
};

export const liquidFormMeta: FxMeta<LiquidFormOptions> = {
  id: "liquid-form",
  label: "Liquid Form",
  description:
    "A chrome form that swells and folds on slow noise, lit by a studio's key, rim and fill and a softbox reflected in it. In three as a displaced mesh where the original ray-marched; the music swells it.",
  source: { name: "ThreeUI · Liquid Form (Velox)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl2",
  priority: 0,
  pixelBudget: 0.5,
  audio: true,
  rooms: ["studio", "lobby", "workshop"],
  defaults: { speed: 1, morph: 1, noiseScale: 1, mouseAmount: 0.15, metal: 1, camera: 5.5, tint: 0.5, audioGain: 1, sourcePalette: false },
  controls: [
    { kind: "range", key: "speed", label: "speed", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "morph", label: "morph", min: 0, max: 2.5, step: 0.05 },
    { kind: "range", key: "noiseScale", label: "noise scale", min: 0.3, max: 2.5, step: 0.05 },
    { kind: "range", key: "mouseAmount", label: "pointer lean", min: 0, max: 0.6, step: 0.01 },
    { kind: "range", key: "metal", label: "metal", min: 0.2, max: 2, step: 0.05 },
    { kind: "range", key: "camera", label: "camera distance", min: 4, max: 9, step: 0.1 },
    { kind: "range", key: "tint", label: "room tint", min: 0, max: 1, step: 0.05 },
    { kind: "range", key: "audioGain", label: "audio response", min: 0, max: 2, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
