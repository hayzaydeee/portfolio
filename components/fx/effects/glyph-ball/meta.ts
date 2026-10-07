import type { FxMeta } from "@/components/fx/runtime/types";

export type GlyphBallOptions = {
  /** Letters on the sphere */
  count: number;
  /** Resting spin; hovering speeds it up */
  speed: number;
  /** The vocabulary the letters are drawn from, in order */
  text: string;
  sourcePalette: boolean;
};

export const glyphBallMeta: FxMeta<GlyphBallOptions> = {
  id: "glyph-ball",
  label: "Glyph Ball",
  description:
    "Letters spun round a sphere, the far side shrinking away. Click knocks the facing letters loose; they fall, and grow back in the accent before settling.",
  source: { name: "ThreeUI · Text Path Studies (Ball)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 1,
  pixelBudget: 1,
  wantsClicks: true,
  rooms: ["lobby", "workshop", "studio", "notebook", "wall"],
  demoCommands: [{ label: "knock the centre", name: "knock" }],
  defaults: {
    count: 1400,
    speed: 1,
    text: "software music writing utility wellness sports tools northampton nigeria building growing",
    sourcePalette: false,
  },
  controls: [
    { kind: "range", key: "count", label: "letters", min: 400, max: 2400, step: 50 },
    { kind: "range", key: "speed", label: "spin", min: 0, max: 3, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
