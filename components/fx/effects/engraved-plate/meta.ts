import type { FxMeta } from "@/components/fx/runtime/types";

export type EngravedPlateOptions = {
  /** Seeds the medallion's rosettes, so every entry carries its own (the page passes its slug) */
  seed: string;
  /** Colour token the plate is engraved in (the page passes its journal's) */
  ink: string;
  /** Where the medallion sits: beside the header on a wide plate, faint behind it on a narrow one */
  medal: "auto" | "right" | "watermark" | "none";
  /** How fast the inner rosette turns, as a multiple of the original's */
  turn: number;
};

export const engravedPlateMeta: FxMeta<EngravedPlateOptions> = {
  id: "engraved-plate",
  label: "Engraved Plate",
  description:
    "An engraved certificate plate: a wave-ruled ground inside a guilloché border, and a lathe-turned medallion of rosettes whose inner ring slowly turns. Each entry's rosettes come from its own seed.",
  source: { name: "ThreeUI · Engraved Certificate (Kinetic Lathe)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 0,
  pixelBudget: 0.8,
  rooms: ["notebook", "lobby", "workshop", "studio", "wall"],
  defaults: { seed: "annotations", ink: "notebook-annotations", medal: "auto", turn: 1 },
  controls: [
    {
      kind: "choice",
      key: "medal",
      label: "medallion",
      options: [
        { value: "auto", label: "auto" },
        { value: "right", label: "beside" },
        { value: "watermark", label: "watermark" },
        { value: "none", label: "none" },
      ],
    },
    { kind: "range", key: "turn", label: "turn", min: 0, max: 3, step: 0.05 },
  ],
};
