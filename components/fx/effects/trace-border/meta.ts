import type { FxMeta } from "@/components/fx/runtime/types";

export type TraceBorderOptions = {
  /** Corner radius of the traced outline, CSS px */
  radius: number;
  /** Inset from the canvas edge to the track, CSS px */
  inset: number;
  /** Seconds per lap */
  lap: number;
  width: number;
  sourcePalette: boolean;
};

export const traceBorderMeta: FxMeta<TraceBorderOptions> = {
  id: "trace-border",
  label: "Trace Border",
  description:
    "A comet of light lapping a rounded outline: a hot head, a flat core and a long uneven fade, bloomed over a faint track. Sits around anything that is working (a streaming answer, an upload).",
  source: { name: "ThreeUI · Thinking Button", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 0,
  pixelBudget: 0.3,
  rooms: ["workshop", "lobby", "studio", "notebook", "wall"],
  defaults: { radius: 10, inset: 4, lap: 2.7, width: 1.6, sourcePalette: false },
  controls: [
    { kind: "range", key: "radius", label: "radius", min: 0, max: 40, step: 1 },
    { kind: "range", key: "inset", label: "inset", min: 0, max: 16, step: 0.5 },
    { kind: "range", key: "lap", label: "lap (s)", min: 0.8, max: 8, step: 0.1 },
    { kind: "range", key: "width", label: "width", min: 0.5, max: 4, step: 0.1 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};
