import type { FxMeta } from "@/components/fx/runtime/types";

export type DustMotesOptions = {
  /** Motes per area, as a multiple of the base count */
  density: number;
  /** Strength of the window light: the beam, its patch on the wall, and how brightly the dust shows in it */
  light: number;
  /** How fast the dust drifts, as a multiple of a still afternoon */
  drift: number;
};

export const dustMotesMeta: FxMeta<DustMotesOptions> = {
  id: "dust-motes",
  label: "Dust Motes",
  description:
    "Afternoon light through a four-pane window: a soft beam crossing the room to a bright patch on the wall, and dust drifting through it, lit where the beam catches it and gone where it doesn't. A passing pointer stirs it.",
  source: { name: "ThreeUI · Particle Drift", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 2,
  pixelBudget: 1.5,
  rooms: ["wall", "notebook", "lobby"],
  defaults: { density: 1, light: 1, drift: 1 },
  controls: [
    { kind: "range", key: "density", label: "density", min: 0.2, max: 2.5, step: 0.05 },
    { kind: "range", key: "light", label: "light", min: 0, max: 2, step: 0.05 },
    { kind: "range", key: "drift", label: "drift", min: 0, max: 2.5, step: 0.05 },
  ],
};
