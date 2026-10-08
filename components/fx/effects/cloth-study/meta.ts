import type { FxMeta } from "@/components/fx/runtime/types";

export type ClothStudyOptions = {
  /** Rows woven into the sheet, separated by " / ", each centred on its own row */
  lines: string;
  /** Letters that fill the weave around the rows, faintly */
  weave: string;
  /** Wind strength, as a multiple of the original's */
  breeze: number;
};

export const clothStudyMeta: FxMeta<ClothStudyOptions> = {
  id: "cloth-study",
  label: "Cloth Study",
  description:
    "A verlet sheet of letters hung from six pegs that shear and stretch with the weave. Wind moves it, a passing pointer brushes it, and a grabbed corner pulls it out of shape.",
  source: { name: "ThreeUI · Text Path Studies II (Cloth)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 0,
  pixelBudget: 0.6,
  rooms: ["notebook", "lobby", "workshop", "studio", "wall"],
  defaults: {
    lines: "reflections / fragments / annotations / responses / build log / cookbook",
    weave: "notebook",
    breeze: 1,
  },
  controls: [{ kind: "range", key: "breeze", label: "breeze", min: 0, max: 3, step: 0.05 }],
  demoCommands: [{ label: "tug", name: "tug" }],
};
