import type { FxMeta } from "@/components/fx/runtime/types";

export type BellFieldOptions = {
  speed: number;
  pointerAmount: number;
  strikeDuration: number;
  emberAmount: number;
  brightness: number;
  opacity: number;
  idleStrikes: boolean;
  audioReactive: boolean;
  audioGain: number;
  sourcePalette: boolean;
};

export const bellFieldMeta: FxMeta<BellFieldOptions> = {
  id: "bell-field",
  label: "Bell Field",
  description:
    "Chladni-style bell modes: nodal metal lines, strike rings and rising embers. Strikes follow kick onsets while music plays.",
  source: { name: "ThreeUI · Bell Field", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl",
  priority: 2,
  pixelBudget: 2.4,
  wantsClicks: true,
  audio: true,
  rooms: ["studio", "lobby", "workshop"],
  demoCommands: [{ label: "strike", name: "strike", arg: 1 }],
  defaults: {
    speed: 1,
    pointerAmount: 1,
    strikeDuration: 2400,
    emberAmount: 1,
    brightness: 1,
    opacity: 1,
    idleStrikes: true,
    audioReactive: true,
    audioGain: 1,
    sourcePalette: false,
  },
  controls: [
    { kind: "range", key: "speed", label: "speed", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "pointerAmount", label: "pointer pull", min: 0, max: 2, step: 0.05 },
    { kind: "range", key: "strikeDuration", label: "ring duration (ms)", min: 800, max: 5000, step: 100 },
    { kind: "range", key: "emberAmount", label: "embers", min: 0, max: 2, step: 0.05 },
    { kind: "range", key: "brightness", label: "brightness", min: 0.35, max: 1.65, step: 0.05 },
    { kind: "range", key: "opacity", label: "opacity", min: 0, max: 1, step: 0.05 },
    { kind: "range", key: "audioGain", label: "audio response", min: 0, max: 2, step: 0.05 },
    { kind: "toggle", key: "idleStrikes", label: "timed strikes when silent" },
    { kind: "toggle", key: "audioReactive", label: "react to music" },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
