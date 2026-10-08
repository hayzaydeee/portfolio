import type { FxMeta } from "@/components/fx/runtime/types";

export type StructureFlowOptions = {
  /** Rotation, as a multiple of the original's */
  speed: number;
  /** World size of a point, as the original's PointsMaterial */
  pointSize: number;
  opacity: number;
  /** The top fade: transparent down to `maskStart`, solid from `maskSolid` (fractions of the height) */
  maskStart: number;
  maskSolid: number;
  /** How far the dome turns toward the pointer */
  parallax: number;
  /** A palette token key to draw in instead of the room glow */
  accent: string;
  sourcePalette: boolean;
};

export const structureFlowMeta: FxMeta<StructureFlowOptions> = {
  id: "structure-flow",
  label: "Structure Flow",
  description:
    "Fifteen thousand points on a slowly turning dome below the horizon, fading in from the top. Leans toward the pointer. A project page's identity field.",
  source: { name: "ThreeUI · Structure Flow", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl2",
  priority: 1,
  pixelBudget: 1.5,
  rooms: ["workshop", "lobby", "studio"],
  defaults: { speed: 1, pointSize: 0.08, opacity: 0.4, maskStart: 0.2, maskSolid: 0.5, parallax: 0.35, accent: "", sourcePalette: false },
  controls: [
    { kind: "range", key: "speed", label: "speed", min: 0, max: 4, step: 0.05 },
    { kind: "range", key: "pointSize", label: "point size", min: 0.02, max: 0.3, step: 0.005 },
    { kind: "range", key: "opacity", label: "opacity", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "maskStart", label: "fade from", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "maskSolid", label: "solid by", min: 0, max: 1, step: 0.01 },
    { kind: "range", key: "parallax", label: "pointer lean", min: 0, max: 1, step: 0.01 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
