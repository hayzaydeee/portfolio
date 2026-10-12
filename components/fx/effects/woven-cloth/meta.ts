import type { FxMeta } from "@/components/fx/runtime/types";
import type { Motif } from "../journal-motifs";

export type WovenClothOptions = {
  /** Resist-dyed across the three panels (the page passes its journal's name) */
  title: string;
  /** On the vermilion seal at the foot of the centre panel */
  numeral: string;
  /** The journal's mark, as the crest on the centre panel */
  motif: Motif;
  /** Colour token the cloth is dyed in */
  dye: string;
  /** The draft through the doorway, as a multiple of the original's */
  breeze: number;
  /** Tone-mapping exposure, as a multiple of the original's */
  exposure: number;
};

export const wovenClothMeta: FxMeta<WovenClothOptions> = {
  id: "woven-cloth",
  label: "Woven Cloth",
  description:
    "A washi noren hung on a wooden rod before a lit shoji screen: three panels of dyed kozo paper, cut apart below the sleeve, each swaying on its own beat in an indoor draft, the lantern's light coming through the sheet. A passing pointer parts it.",
  source: { name: "ThreeUI · Woven Cloth (washi noren)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl2",
  priority: 1,
  pixelBudget: 1.2,
  rooms: ["notebook"],
  defaults: { title: "Reflections", numeral: "I", motif: "paths", dye: "notebook-reflections", breeze: 1, exposure: 1 },
  controls: [
    { kind: "range", key: "breeze", label: "breeze", min: 0, max: 2.5, step: 0.05 },
    { kind: "range", key: "exposure", label: "exposure", min: 0.5, max: 1.8, step: 0.02 },
  ],
  demoCommands: [{ label: "gust", name: "gust" }],
};
