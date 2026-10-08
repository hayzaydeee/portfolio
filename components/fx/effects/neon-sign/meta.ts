import type { FxMeta } from "@/components/fx/runtime/types";

export type NeonSignOptions = {
  /** Letters the glyph set covers (A B E G H I L N O S T W, space); "/" breaks a line */
  text: string;
  /** Which letter (counting letters only, from 0) flickers; -1 for none */
  flicker: number;
  /** A palette token key for the gas colour instead of the room glow */
  accent: string;
  sourcePalette: boolean;
};

export const neonSignMeta: FxMeta<NeonSignOptions> = {
  id: "neon-sign",
  label: "Neon Sign",
  description:
    "Glass-blown neon tubes drawn stroke by stroke: spill, bloom, a hot core with a specular streak, capped ends and electrodes. One letter stutters now and then.",
  source: { name: "ThreeUI · Neon Typography (Glassblown)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 1,
  pixelBudget: 0.8,
  rooms: ["studio", "lobby", "workshop"],
  defaults: { text: "IN THE LAB", flicker: 3, accent: "", sourcePalette: false },
  controls: [
    { kind: "range", key: "flicker", label: "flickering letter", min: -1, max: 12, step: 1 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
