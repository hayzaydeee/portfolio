import type { FxMeta } from "@/components/fx/runtime/types";

export type EmberSealOptions = {
  /** Carved into the seal's face */
  label: string;
  /** Varies where the embers run hot, so two seals side by side burn differently (the page passes the piece's id) */
  seed: string;
  /** Embers along the seal, as a multiple of the original's count for the seal's size */
  heat: number;
  /** Rain falling across the plate, as a multiple */
  rain: number;
  /** Simulation speed */
  speed: number;
};

export const emberSealMeta: FxMeta<EmberSealOptions> = {
  id: "ember-seal",
  label: "Ember Seal",
  description:
    "A wax seal drawn in embers: thousands of short sparks thrown off its scalloped edge, its carved ring and its lettering, bent by a slowly turning curl field, with rain slanting across the dark plate behind it. Every seventeen seconds it loosens into smoke and draws itself back together.",
  source: { name: "ThreeUI · Spark Badge", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 0,
  pixelBudget: 0.4,
  rooms: ["wall", "lobby", "studio"],
  defaults: { label: "hzy", seed: "seal", heat: 1, rain: 1, speed: 1 },
  controls: [
    { kind: "range", key: "heat", label: "embers", min: 0.35, max: 1.6, step: 0.05 },
    { kind: "range", key: "rain", label: "rain", min: 0, max: 1.5, step: 0.05 },
    { kind: "range", key: "speed", label: "speed", min: 0, max: 2, step: 0.05 },
  ],
};
