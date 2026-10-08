import type { FxMeta } from "@/components/fx/runtime/types";

export type TrackMeterOptions = {
  /** How hard the analyser drives the bars */
  audioGain: number;
  /** A palette token key for the bars instead of the room glow */
  accent: string;
};

export const trackMeterMeta: FxMeta<TrackMeterOptions> = {
  id: "track-meter",
  label: "Track Meter",
  description: "Five bars reading the live analyser bands (sub to high), for the track that's playing. Settles flat when paused.",
  source: { name: "ThreeUI · Audio Wordmark (bar idiom)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 0,
  pixelBudget: 0.05,
  audio: true,
  rooms: ["studio"],
  defaults: { audioGain: 1, accent: "" },
  controls: [{ kind: "range", key: "audioGain", label: "audio response", min: 0, max: 2, step: 0.05 }],
};
