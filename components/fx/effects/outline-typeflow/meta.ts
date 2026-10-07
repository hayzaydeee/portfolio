import type { FxMeta } from "@/components/fx/runtime/types";

export type OutlineTypeflowOptions = {
  /** Text that runs the outline, repeated end to end */
  phrase: string;
  /** Flow speed; hovering speeds it up */
  speed: number;
  /** Glyph size as a share of the short side */
  glyph: number;
  sourcePalette: boolean;
};

export const outlineTypeflowMeta: FxMeta<OutlineTypeflowOptions> = {
  id: "outline-typeflow",
  label: "Outline Typeflow",
  description:
    "The HZY mark's outline sampled as one path, with a sentence flowing its whole length. The pointer lights the type it passes over; a click shoves the letters outward and they settle back.",
  source: { name: "ThreeUI · Text Path Studies (Outline Typeflow)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 0,
  pixelBudget: 0.6,
  wantsClicks: true,
  rooms: ["lobby", "workshop", "studio", "notebook", "wall"],
  demoCommands: [{ label: "kick", name: "kick" }],
  defaults: { phrase: "glad you're here · ", speed: 1, glyph: 0.03, sourcePalette: false },
  controls: [
    { kind: "range", key: "speed", label: "flow", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "glyph", label: "glyph size", min: 0.018, max: 0.05, step: 0.001 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
