import type { FxMeta } from "@/components/fx/runtime/types";

export type AudioWordmarkOptions = {
  /** Idle pulse speed, as a multiple of the original's */
  speed: number;
  /** How hard the analyser drives the bars */
  audioGain: number;
  /** A palette token key to draw in instead of the room glow */
  accent: string;
  sourcePalette: boolean;
};

export const audioWordmarkMeta: FxMeta<AudioWordmarkOptions> = {
  id: "audio-wordmark",
  label: "Audio Wordmark",
  description:
    "Two discs of rounded bars: one of bars, one cut through with slots. While music plays the bars follow the spectrum; silent, they breathe on the original's loop.",
  source: { name: "ThreeUI · Audio Wordmark", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 1,
  pixelBudget: 0.6,
  audio: true,
  rooms: ["studio", "lobby", "workshop"],
  defaults: { speed: 1, audioGain: 1, accent: "", sourcePalette: false },
  controls: [
    { kind: "range", key: "speed", label: "idle speed", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "audioGain", label: "audio response", min: 0, max: 2, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
