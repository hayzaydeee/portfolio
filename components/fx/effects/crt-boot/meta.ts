import type { FxMeta } from "@/components/fx/runtime/types";

export type CrtBootOptions = {
  /** Typing speed multiplier */
  typeSpeed: number;
  /** Scanline roll, flicker and bar drift */
  motion: number;
  /** Shown in the boot log's mount line */
  projects: number;
  sourcePalette: boolean;
};

export const crtBootMeta: FxMeta<CrtBootOptions> = {
  id: "crt-boot",
  label: "CRT Boot",
  description:
    "A curved CRT typing out the workshop's boot log: shadow-mask grille, scanlines, chromatic fringe and phosphor halation over a text canvas. Command: done (a callback for when the log finishes).",
  source: { name: "ThreeUI · CRT Background (terminal)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl",
  priority: 2,
  pixelBudget: 2.4,
  rooms: ["workshop"],
  defaults: { typeSpeed: 1, motion: 1, projects: 0, sourcePalette: false },
  controls: [
    { kind: "range", key: "typeSpeed", label: "typing", min: 0.2, max: 3, step: 0.05 },
    { kind: "range", key: "motion", label: "motion", min: 0, max: 2, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
