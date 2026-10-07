import type { FxMeta } from "@/components/fx/runtime/types";

export type DotMatrixOptions = {
  speed: number;
  /** Dots across the short side */
  gridScale: number;
  pulseSpeed: number;
  /** How far each dot swells at the top of its pulse */
  radius: number;
  /** How far the grid leans toward the pointer */
  mouseAmount: number;
  opacity: number;
  sourcePalette: boolean;
};

export const dotMatrixMeta: FxMeta<DotMatrixOptions> = {
  id: "dot-matrix",
  label: "Dot Matrix",
  description: "A breathing grid of syntax-coloured dots that leans toward the pointer and fades out from the centre. The workshop's editor backdrop.",
  source: { name: "ThreeUI · Dot Matrix", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl",
  priority: 2,
  pixelBudget: 2.4,
  rooms: ["workshop", "lobby", "studio"],
  defaults: { speed: 1, gridScale: 60, pulseSpeed: 0.4, radius: 0.15, mouseAmount: 0.04, opacity: 0.35, sourcePalette: false },
  controls: [
    { kind: "range", key: "speed", label: "speed", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "gridScale", label: "grid", min: 20, max: 120, step: 1 },
    { kind: "range", key: "pulseSpeed", label: "pulse", min: 0, max: 2, step: 0.05 },
    { kind: "range", key: "radius", label: "swell", min: 0, max: 0.35, step: 0.01 },
    { kind: "range", key: "mouseAmount", label: "lean", min: 0, max: 0.2, step: 0.005 },
    { kind: "range", key: "opacity", label: "opacity", min: 0, max: 1, step: 0.01 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
