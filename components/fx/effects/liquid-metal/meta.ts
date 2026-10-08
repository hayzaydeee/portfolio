import type { FxMeta } from "@/components/fx/runtime/types";

export type LiquidMetalOptions = {
  /** Space around the key for its bloom, as a multiple of the key's diameter */
  pad: number;
  /** Rim stroke, CSS px */
  stroke: number;
  /** How far the metal leans into the room's glow (0 keeps the original's white light) */
  tint: number;
  /** Outer glow gain */
  glow: number;
  /** Blur on the metal, in key heights: the "molten" knob */
  soften: number;
  /** How hard the music lights the metal and throws ripples */
  audioGain: number;
  sourcePalette: boolean;
};

export const liquidMetalMeta: FxMeta<LiquidMetalOptions> = {
  id: "liquid-metal",
  label: "Liquid Metal",
  description:
    "The player's round key in poured metal: prismatic ribbons that light on hover, focus and while music plays, a rim of light that travels round it, a faceted ripple from every press and every kick, all bloomed into the room.",
  source: { name: "ThreeUI · Liquid Metal Button (play)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl2",
  priority: 3,
  pixelBudget: 0.15,
  audio: true,
  rooms: ["studio"],
  defaults: { pad: 0.75, stroke: 2, tint: 0.35, glow: 0.9, soften: 0.12, audioGain: 1, sourcePalette: false },
  controls: [
    { kind: "range", key: "pad", label: "bloom room", min: 0.4, max: 1.8, step: 0.05 },
    { kind: "range", key: "stroke", label: "rim stroke", min: 1, max: 6, step: 0.25 },
    { kind: "range", key: "tint", label: "room tint", min: 0, max: 1, step: 0.05 },
    { kind: "range", key: "glow", label: "glow", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "soften", label: "soften", min: 0, max: 0.5, step: 0.01 },
    { kind: "range", key: "audioGain", label: "audio gain", min: 0, max: 2, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
  demoCommands: [
    { label: "light", name: "hover", arg: true },
    { label: "dim", name: "hover", arg: false },
    { label: "press", name: "press", arg: { x: 0.12, y: -0.08 } },
  ],
};
