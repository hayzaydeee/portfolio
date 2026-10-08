import type { FxMeta } from "@/components/fx/runtime/types";

export type PlayerGlowOptions = {
  /** How hard the analyser drives the light */
  audioGain: number;
  /** Light left on while nothing plays */
  rest: number;
};

export const playerGlowMeta: FxMeta<PlayerGlowOptions> = {
  id: "player-glow",
  label: "Player Glow",
  description:
    "Light rising off the player bar: five soft lobes from sub on the left to highs on the right, each as tall as its band, the whole of it as bright as the music is loud, flaring on a kick.",
  source: { name: "ThreeUI · Audio Wordmark (analyser idiom)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 0,
  pixelBudget: 0.08,
  audio: true,
  rooms: ["studio"],
  defaults: { audioGain: 1, rest: 0.12 },
  controls: [
    { kind: "range", key: "audioGain", label: "audio response", min: 0, max: 2, step: 0.05 },
    { kind: "range", key: "rest", label: "resting light", min: 0, max: 0.5, step: 0.01 },
  ],
};
