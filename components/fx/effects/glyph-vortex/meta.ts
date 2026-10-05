import type { FxMeta } from "@/components/fx/runtime/types";

export type GlyphVortexOptions = {
  /** Ring rotation speed */
  speed: number;
  /** Ratio between successive ring radii; lower packs more rings */
  ringGrowth: number;
  /** Glyph opacity */
  opacity: number;
  sourcePalette: boolean;
};

export const glyphVortexMeta: FxMeta<GlyphVortexOptions> = {
  id: "glyph-vortex",
  label: "Glyph Vortex",
  description:
    "Room transition: concentric rings of the destination room's name spiral in over the page, hold while it loads, then scatter outward as the new room opens from the centre.",
  source: { name: "ThreeUI · Typography Vortex", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl",
  priority: 3,
  pixelBudget: 2.4,
  rooms: ["lobby", "workshop", "studio", "notebook", "wall"],
  demoCommands: [
    { label: "trip → studio", name: "demo", arg: "studio" },
    { label: "trip → workshop", name: "demo", arg: "workshop" },
    { label: "trip → wall", name: "demo", arg: "wall" },
  ],
  defaults: { speed: 1, ringGrowth: 1.16, opacity: 1, sourcePalette: false },
  controls: [
    { kind: "range", key: "speed", label: "speed", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "ringGrowth", label: "ring spacing", min: 1.12, max: 1.4, step: 0.01 },
    { kind: "range", key: "opacity", label: "glyph opacity", min: 0.2, max: 1, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
